
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData, IacHoverData, ContainersHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxIacResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/iacRealtime/CxIac";

import path from "path";
import { cx } from "../../../cx";
import fs from "fs";
import { minimatch } from "minimatch";
import { createHash } from "crypto";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { IgnoreFileManager } from "../../common/ignoreFileManager";

export class IacScannerService extends BaseScannerService {
	private diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
	private iacHoverData = new Map<string, IacHoverData[]>();
	private criticalDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private highDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private mediumDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private lowDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private ignoredDecorations: Map<string, vscode.DecorationOptions[]> = new Map();

	private documentOpenListener: vscode.Disposable | undefined;
	private editorChangeListener: vscode.Disposable | undefined;

	private decorationTypes = {
		critical: this.createDecoration("realtimeEngines/critical_severity.svg", "12px"),
		high: this.createDecoration("realtimeEngines/high_severity.svg"),
		medium: this.createDecoration("realtimeEngines/medium_severity.svg"),
		low: this.createDecoration("realtimeEngines/low_severity.svg"),
		ignored: this.createDecoration("Ignored.svg")
	};

	private createDecoration(
		iconName: string,
		size: string = "auto"
	): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.file(
				path.join(__dirname, "..", "..", "..", "..", "media", "icons", iconName)
			),
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			gutterIconSize: size,
		});
	}

	constructor() {
		const config: IScannerConfig = {
			engineName: constants.iacRealtimeScannerEngineName,
			configSection: constants.iacRealtimeScanner,
			activateKey: constants.activateIacRealtimeScanner,
			enabledMessage: constants.iacRealtimeScannerStart,
			disabledMessage: constants.iacRealtimeScannerDisabled,
			errorMessage: constants.errorIacScanRealtime
		};
		super(config);
	}

	shouldScanFile(document: vscode.TextDocument): boolean {
		if (!super.shouldScanFile(document)) {
			return false;
		}

		const filePath = document.uri.fsPath;
		const normalizedPath = filePath.replace(/\\/g, "/");

		const matchesIacPattern = constants.iacSupportedPatterns.some((pattern) =>
			minimatch(normalizedPath, pattern, { nocase: true })
		);

		if (matchesIacPattern) {
			return true;
		}

		const fileExtension = path.extname(filePath).toLowerCase();
		if (constants.iacSupportedExtensions.includes(fileExtension)) {
			return true;
		}

		return false;
	}

	protected generateFileHash(input: string): string {
		const now = new Date();
		const timeSuffix = `${now.getMinutes()}${now.getSeconds()}`;
		return createHash("sha256")
			.update(input + timeSuffix)
			.digest("hex")
			.substring(0, 16);

	}




	private createSubFolderAndSaveFile(
		tempFolder: string,
		originalFilePath: string,
		content: string
	): { tempFilePath: string; tempSubFolder: string } {
		const originalFileName = path.basename(originalFilePath);

		const hash = this.generateFileHash(originalFilePath);
		const iacFolder = path.join(tempFolder, `${originalFileName}-${hash}`);
		if (!fs.existsSync(iacFolder)) {
			fs.mkdirSync(iacFolder, { recursive: true });
		}

		const tempFilePath = path.join(iacFolder, originalFileName);
		fs.writeFileSync(tempFilePath, content);
		return { tempFilePath, tempSubFolder: iacFolder };
	}

	private getContainersManagementTool(): string {
		const containersManagementTool = vscode.workspace
			.getConfiguration(this.config.configSection)
			.get("Containers Management Tool") as string;

		return containersManagementTool;
	}

	public async scan(document: vscode.TextDocument, logs: Logs): Promise<void> {
		if (!this.shouldScanFile(document)) {
			return;
		}

		const keysToDelete: string[] = [];
		for (const key of this.iacHoverData.keys()) {
			if (key.startsWith(`${document.uri.fsPath}:`)) {
				keysToDelete.push(key);
			}
		}
		keysToDelete.forEach(key => this.iacHoverData.delete(key));

		const filePath = await this.getFullPathWithOriginalCasing(document.uri);

		logs.info("Scanning IaC in file: " + filePath);

		const tempFolder = this.getTempSubFolderPath(document, constants.iacRealtimeScannerDirectory);

		let tempFilePath: string | undefined;
		let tempSubFolder: string | undefined;

		try {
			this.createTempFolder(tempFolder);

			const saveResult = this.createSubFolderAndSaveFile(tempFolder, filePath, document.getText());
			tempFilePath = saveResult.tempFilePath;
			tempSubFolder = saveResult.tempSubFolder;

			const ignoreManager = IgnoreFileManager.getInstance();
			ignoreManager.setScannedFilePath(filePath, tempFilePath);
			const ignoredPackagesFile = ignoreManager.getIgnoredPackagesTempFile();

			const scanResults = await cx.iacScanResults(tempFilePath, this.getContainersManagementTool(), ignoredPackagesFile || "");

			let fullScanResults = scanResults;
			if (ignoreManager.getIgnoredPackagesCount() > 0) {
				fullScanResults = await cx.iacScanResults(tempFilePath, this.getContainersManagementTool(), "");
			}

			ignoreManager.removeMissingIac(fullScanResults, filePath);

			this.updateProblems(scanResults, document.uri);

			const ignoredData = ignoreManager.getIgnoredPackagesData();
			const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
			const ignoredDecorations: vscode.DecorationOptions[] = [];

			const activeLineNumbers = new Set<number>();
			scanResults.forEach(result => {
				result.locations.forEach(loc => activeLineNumbers.add(loc.line));
			});

			const containerDiagnostics = vscode.languages.getDiagnostics(document.uri).filter(diagnostic => {
				const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
				return diagnosticData?.cxType === constants.containersRealtimeScannerEngineName;
			});

			const iacLocations = new Map<string, number[]>();
			fullScanResults.forEach(result => {
				if (result.similarityID) {
					const key = `${result.title}:${result.similarityID}:${relativePath}`;
					const lines = iacLocations.get(key) || [];
					result.locations.forEach(loc => lines.push(loc.line));
					iacLocations.set(key, lines);
				}
			});

			Object.entries(ignoredData).forEach(([, entry]) => {
				if (entry.type !== constants.iacRealtimeScannerEngineName) { return; }
				const fileEntry = entry.files.find(f => f.path === relativePath && f.active);
				if (!fileEntry) { return; }

				const key = `${entry.PackageName}:${entry.similarityId}:${relativePath}`;
				const lines = iacLocations.get(key) || [];

				lines.forEach(line => {
					const hasActiveIacFindings = activeLineNumbers.has(line);
					const hasActiveContainerFindings = containerDiagnostics.some(diag => diag.range.start.line === line);

					if (!hasActiveIacFindings && !hasActiveContainerFindings) {
						const adjustedLine = line;
						const range = new vscode.Range(
							new vscode.Position(adjustedLine, 0),
							new vscode.Position(adjustedLine, 1000)
						);
						ignoredDecorations.push({ range });

						const hoverKey = `${filePath}:${adjustedLine}`;
						if (!this.iacHoverData.has(hoverKey)) {
							this.iacHoverData.set(hoverKey, [{
								similarityId: entry.similarityId,
								title: entry.PackageName,
								description: entry.description,
								severity: entry.severity,
								filePath,
								originalFilePath: filePath,
								location: { line: adjustedLine, startIndex: 0, endIndex: 1000 },
								fileType: path.extname(filePath).substring(1),
								expectedValue: "",
								actualValue: ""
							}]);
						}
					}
				});
			});

			this.ignoredDecorations.set(filePath, ignoredDecorations);
			this.applyDecorations(document.uri);

		} catch (error) {
			this.storeAndApplyResults(
				filePath,
				document.uri,
				[],
				[],
				[],
				[],
				[]
			);
			console.error(error);
			logs.error(this.config.errorMessage + `: ${error.message}`);
		} finally {
			if (tempSubFolder) {
				this.deleteTempFolder(tempSubFolder);
			}
		}
	}

	updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void {
		const scanResults = problems as CxIacResult[];
		const filePath = uri.fsPath;

		const diagnostics: vscode.Diagnostic[] = [];
		this.diagnosticCollection.delete(uri);

		const criticalDecorations: vscode.DecorationOptions[] = [];
		const highDecorations: vscode.DecorationOptions[] = [];
		const mediumDecorations: vscode.DecorationOptions[] = [];
		const lowDecorations: vscode.DecorationOptions[] = [];

		const resultsByLine = new Map<number, CxIacResult[]>();

		for (const result of scanResults) {
			const location = result.locations[0];
			const lineNumber = location.line;

			if (!resultsByLine.has(lineNumber)) {
				resultsByLine.set(lineNumber, []);
			}
			resultsByLine.get(lineNumber)!.push(result);
		}

		for (const [lineNumber, lineResults] of resultsByLine) {
			const location = lineResults[0].locations[0];
			const range = new vscode.Range(
				new vscode.Position(location.line, location.startIndex),
				new vscode.Position(location.line, location.endIndex)
			);

			const fileExtension = path.extname(uri.fsPath).toLowerCase();
			const fileType = constants.iacSupportedPatterns.some(pattern =>
				minimatch(uri.fsPath.replace(/\\/g, "/"), pattern, { nocase: true })
			) ? 'dockerfile' : fileExtension.substring(1);

			const key = `${uri.fsPath}:${range.start.line}`;
			const hoverProblems: IacHoverData[] = lineResults.map(result => ({
				similarityId: result.similarityID,
				title: result.title,
				description: result.description,
				severity: result.severity,
				expectedValue: result.expectedValue,
				actualValue: result.actualValue,
				filePath: result.filepath,
				originalFilePath: uri.fsPath,
				location: result.locations[0],
				fileType: fileType
			}));

			this.iacHoverData.set(key, hoverProblems);

			const problemCount = lineResults.length;
			const titleMessage = problemCount === 1
				? lineResults[0].title
				: `${problemCount} IaC vulnerabilities detected on this line`;

			let highestSeverity = this.getHighestSeverity(lineResults.map(r => r.severity));

			const diagnostic = new vscode.Diagnostic(range, titleMessage, vscode.DiagnosticSeverity.Error);
			diagnostic.source = constants.cxAi;
			(diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
				cxType: constants.iacRealtimeScannerEngineName,
				item: {
					similarityId: problemCount === 1 ? lineResults[0].similarityID : undefined,
					title: problemCount === 1 ? lineResults[0].title : titleMessage,
					description: problemCount === 1 ? lineResults[0].description : titleMessage,
					severity: highestSeverity,
					filePath: lineResults[0].filepath,
					location: lineResults[0].locations[0],
					expectedValue: lineResults[0].expectedValue,
					actualValue: lineResults[0].actualValue,
					fileType
				}
			};

			diagnostics.push(diagnostic);

			highestSeverity = this.getHighestSeverity([highestSeverity, this.exsistContainersSeverityAtLine(uri, lineNumber)]);

			const decoration = { range };
			switch (highestSeverity) {
				case CxRealtimeEngineStatus.critical:
					criticalDecorations.push(decoration);
					break;
				case CxRealtimeEngineStatus.high:
					highDecorations.push(decoration);
					break;
				case CxRealtimeEngineStatus.medium:
					mediumDecorations.push(decoration);
					break;
				case CxRealtimeEngineStatus.low:
					lowDecorations.push(decoration);
					break;
				default:
					break;
			}
		}

		this.storeAndApplyResults(
			filePath,
			uri,
			diagnostics,
			criticalDecorations,
			highDecorations,
			mediumDecorations,
			lowDecorations,
		);
	}

	private exsistContainersSeverityAtLine(uri: vscode.Uri, lineNumber: number): string {
		const containersCollection = this.getOtherScannerCollection(constants.containersRealtimeScannerEngineName);
		if (containersCollection) {
			const containersDiagnostics = vscode.languages.getDiagnostics(uri).filter(diagnostic => {
				const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
				return diagnosticData?.cxType === constants.containersRealtimeScannerEngineName;
			});
			const containersAtLine = containersDiagnostics.filter(diagnostic => diagnostic.range.start.line === lineNumber);
			if (containersAtLine[0]) {
				return ((containersAtLine[0] as vscode.Diagnostic & { data?: CxDiagnosticData }).data.item as ContainersHoverData).status;
			}
			return undefined;
		}
	}

	private storeAndApplyResults(
		filePath: string,
		uri: vscode.Uri,
		diagnostics: vscode.Diagnostic[],
		criticalDecorations: vscode.DecorationOptions[],
		highDecorations: vscode.DecorationOptions[],
		mediumDecorations: vscode.DecorationOptions[],
		lowDecorations: vscode.DecorationOptions[],
	): void {
		this.diagnosticsMap.set(filePath, diagnostics);
		this.criticalDecorationsMap.set(filePath, criticalDecorations);
		this.highDecorationsMap.set(filePath, highDecorations);
		this.mediumDecorationsMap.set(filePath, mediumDecorations);
		this.lowDecorationsMap.set(filePath, lowDecorations);

		if (diagnostics.length > 0) {
			this.diagnosticCollection.set(uri, diagnostics);
		}

		this.applyDecorations(uri);
	}

	private applyDecorations(uri: vscode.Uri): void {
		const editors = vscode.window.visibleTextEditors.filter((editor) => editor.document.uri.toString() === uri.toString());

		for (const editor of editors) {
			const filePath = editor.document.uri.fsPath;

			editor.setDecorations(this.decorationTypes.critical, this.criticalDecorationsMap.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.high, this.highDecorationsMap.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.medium, this.mediumDecorationsMap.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.low, this.lowDecorationsMap.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.ignored, this.ignoredDecorations.get(filePath) || []);
		}
	}

	public clearScanData(uri: vscode.Uri): void {
		const filePath = uri.fsPath;
		this.diagnosticCollection.delete(uri);
		this.diagnosticsMap.delete(filePath);
		this.iacHoverData.clear();
		this.criticalDecorationsMap.delete(filePath);
		this.highDecorationsMap.delete(filePath);
		this.mediumDecorationsMap.delete(filePath);
		this.lowDecorationsMap.delete(filePath);
		this.ignoredDecorations.delete(filePath);
	}

	public getHoverData(): Map<string, IacHoverData[]> {
		return this.iacHoverData;
	}

	public getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
		return this.diagnosticsMap;
	}

	public initializeScanner(): void {
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				this.applyDecorations(editor.document.uri);
			}
		});
	}

	dispose(): void {
		this.documentOpenListener?.dispose();
		this.editorChangeListener?.dispose();

		Object.values(this.decorationTypes).forEach((decoration) => {
			decoration.dispose();
		});

		this.diagnosticsMap.clear();
		this.iacHoverData.clear();
		this.criticalDecorationsMap.clear();
		this.highDecorationsMap.clear();
		this.mediumDecorationsMap.clear();
		this.lowDecorationsMap.clear();
		this.ignoredDecorations.clear();
	}


	public hasAnySeverityDecorations(): boolean {
		return (
			this.criticalDecorationsMap.size > 0 ||
			this.highDecorationsMap.size > 0 ||
			this.mediumDecorationsMap.size > 0 ||
			this.lowDecorationsMap.size > 0
		);
	}

	public hasAnyDecorationsAtLine(uri: vscode.Uri, lineNumber: number): boolean {
		const filePath = uri.fsPath;
		const decorationMaps = [
			this.criticalDecorationsMap,
			this.highDecorationsMap,
			this.mediumDecorationsMap,
			this.lowDecorationsMap,
			this.ignoredDecorations
		];

		return decorationMaps.some(map => {
			const decorations = map.get(filePath) || [];
			return decorations.some(decoration => decoration.range.start.line === lineNumber);
		});
	}

	private removeGutterAtLine(filePath: string, lineNumber: number): void {
		const decorationMaps = [
			this.criticalDecorationsMap,
			this.highDecorationsMap,
			this.mediumDecorationsMap,
			this.lowDecorationsMap,
			this.ignoredDecorations
		];

		decorationMaps.forEach(map => {
			const decorations = map.get(filePath) || [];
			const filtered = decorations.filter(decoration => decoration.range.start.line !== lineNumber);
			map.set(filePath, filtered);
		});
	}

	private getAnyRangeAtLine(filePath: string, lineNumber: number): vscode.Range | undefined {
		const decorationMaps = [
			this.criticalDecorationsMap,
			this.highDecorationsMap,
			this.mediumDecorationsMap,
			this.lowDecorationsMap,
			this.ignoredDecorations
		];

		for (const map of decorationMaps) {
			const decorations = map.get(filePath) || [];
			const decoration = decorations.find(d => d.range.start.line === lineNumber);
			if (decoration) {
				return decoration.range;
			}
		}

		return new vscode.Range(
			new vscode.Position(lineNumber, 0),
			new vscode.Position(lineNumber, 1000)
		);
	}

	private pushGutter(filePath: string, severity: string, range: vscode.Range): void {
		const decoration = { range };

		switch (severity.toUpperCase()) {
			case CxRealtimeEngineStatus.critical.toUpperCase(): {
				const criticalDecorations = this.criticalDecorationsMap.get(filePath) || [];
				criticalDecorations.push(decoration);
				this.criticalDecorationsMap.set(filePath, criticalDecorations);
				break;
			}
			case CxRealtimeEngineStatus.high.toUpperCase(): {
				const highDecorations = this.highDecorationsMap.get(filePath) || [];
				highDecorations.push(decoration);
				this.highDecorationsMap.set(filePath, highDecorations);
				break;
			}
			case CxRealtimeEngineStatus.medium.toUpperCase(): {
				const mediumDecorations = this.mediumDecorationsMap.get(filePath) || [];
				mediumDecorations.push(decoration);
				this.mediumDecorationsMap.set(filePath, mediumDecorations);
				break;
			}
			case CxRealtimeEngineStatus.low.toUpperCase(): {
				const lowDecorations = this.lowDecorationsMap.get(filePath) || [];
				lowDecorations.push(decoration);
				this.lowDecorationsMap.set(filePath, lowDecorations);
				break;
			}
			case "IGNORED": {
				const ignoredDecorations = this.ignoredDecorations.get(filePath) || [];
				ignoredDecorations.push(decoration);
				this.ignoredDecorations.set(filePath, ignoredDecorations);
				break;
			}
			default: {
				const defaultDecorations = this.lowDecorationsMap.get(filePath) || [];
				defaultDecorations.push(decoration);
				this.lowDecorationsMap.set(filePath, defaultDecorations);
				break;
			}
		}
	}



	public recomputeGutterForLine(uri: vscode.Uri, lineNumber: number): void {
		const filePath = uri.fsPath;

		this.removeGutterAtLine(filePath, lineNumber);

		const range = this.getAnyRangeAtLine(filePath, lineNumber);
		if (!range) {
			return;
		}

		const iacSeverity = this.getIacSeverityFromDiagnostics(uri, lineNumber);

		const containersSeverity = this.exsistContainersSeverityAtLine(uri, lineNumber);

		let finalSeverity: string | undefined;
		if (iacSeverity && containersSeverity) {
			finalSeverity = this.getHighestSeverity([iacSeverity, containersSeverity]);
		} else if (iacSeverity) {
			finalSeverity = iacSeverity;
		} else if (containersSeverity) {
			finalSeverity = containersSeverity;
		}

		if (!finalSeverity) {
			const hasIgnoredEntries = this.hasIgnoredEntriesOnLine(filePath, lineNumber);
			if (hasIgnoredEntries) {
				finalSeverity = "ignored";
			}
		}

		if (finalSeverity) {
			this.pushGutter(filePath, finalSeverity, range);
		}

		this.applyDecorations(uri);
	}

	private hasIgnoredEntriesOnLine(filePath: string, lineNumber: number): boolean {
		const ignoreManager = IgnoreFileManager.getInstance();
		const ignoredData = ignoreManager.getIgnoredPackagesData();
		const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);

		const lineNumber1Based = lineNumber + 1;

		const hasIgnoredContainers = Object.values(ignoredData).some(entry => {
			if (entry.type !== constants.containersRealtimeScannerEngineName) {
				return false;
			}
			return entry.files.some(file =>
				file.path === relativePath &&
				file.active &&
				file.line === lineNumber1Based
			);
		});

		const hasIgnoredIac = Object.values(ignoredData).some(entry => {
			if (entry.type !== constants.iacRealtimeScannerEngineName) {
				return false;
			}
			return entry.files.some(file =>
				file.path === relativePath &&
				file.active &&
				file.line === lineNumber1Based
			);
		});

		return hasIgnoredContainers || hasIgnoredIac;
	}

	private getIacSeverityFromDiagnostics(uri: vscode.Uri, lineNumber: number): string | undefined {
		const iacDiagnostics = vscode.languages.getDiagnostics(uri).filter(diagnostic => {
			const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
			return diagnosticData?.cxType === constants.iacRealtimeScannerEngineName;
		});

		const iacAtLine = iacDiagnostics.filter(diagnostic => diagnostic.range.start.line === lineNumber);
		if (iacAtLine.length > 0) {
			const severities = iacAtLine.map(diag => {
				const diagnosticData = (diag as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
				const item = diagnosticData?.item as any;
				return item?.severity || CxRealtimeEngineStatus.low;
			});
			return this.getHighestSeverity(severities);
		}

		return undefined;
	}
}
