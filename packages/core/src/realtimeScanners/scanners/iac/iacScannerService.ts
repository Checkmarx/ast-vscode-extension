
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData, IacHoverData, ContainersHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxIacResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/iacRealtime/CxIac";

import path from "path";
import { cx } from "../../../cx";
import fs from "fs";
import { minimatch } from "minimatch";
import { CxRealtimeEngineStatus } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { IgnoreFileManager } from "../../common/ignoreFileManager";
import { logScanResults } from "../common";
import { ThemeUtils } from "../../../utils/themeUtils";

export class IacScannerService extends BaseScannerService {
	private themeChangeListener: vscode.Disposable | undefined;
	private diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
	private iacHoverData = new Map<string, IacHoverData[]>();
	private decorationsMap = {
		critical: new Map<string, vscode.DecorationOptions[]>(),
		high: new Map<string, vscode.DecorationOptions[]>(),
		medium: new Map<string, vscode.DecorationOptions[]>(),
		low: new Map<string, vscode.DecorationOptions[]>(),
		ignored: new Map<string, vscode.DecorationOptions[]>()
	};

	private decorationTypes = {
		critical: this.createDecoration("realtimeEngines/critical_severity.svg", "12px"),
		high: this.createDecoration("realtimeEngines/high_severity.svg"),
		medium: this.createDecoration("realtimeEngines/medium_severity.svg"),
		low: this.createDecoration("realtimeEngines/low_severity.svg"),
		ignored: this.createDecoration(ThemeUtils.selectIconByTheme('Ignored_light.svg', "Ignored.svg")),
	};

	private createDecoration(
		iconName: string,
		size: string = "auto"
	): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.file(
				path.join(__dirname, "..", "..", "..", "media", "icons", iconName)
			),
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			gutterIconSize: size,
		});
	}

	constructor() {
		const config: IScannerConfig = {
			engineName: constants.iacRealtimeScannerEngineName,
			configSection: constants.getIacRealtimeScanner(),
			activateKey: constants.activateIacRealtimeScanner,
			enabledMessage: constants.iacRealtimeScannerStart,
			disabledMessage: constants.iacRealtimeScannerDisabled,
			errorMessage: constants.errorIacScanRealtime
		};
		super(config);

		// Set up theme change listener using common method
		this.themeChangeListener = BaseScannerService.createThemeChangeHandler(this, 'Ignored_light.svg');
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
			const ignoredPackagesFile = ignoreManager.getIgnoredPackagesCount() > 0
				? ignoreManager.getIgnoredPackagesTempFile()
				: undefined;

			const scanResults = await cx.iacScanResults(tempFilePath, this.getContainersManagementTool(), ignoredPackagesFile || "");

			let fullScanResults = scanResults;
			if (ignoreManager.getIgnoredPackagesCount() > 0) {
				fullScanResults = await cx.iacScanResults(tempFilePath, this.getContainersManagementTool(), "");
			}

			logScanResults("iac", fullScanResults);

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
				const fileEntry = this.findActiveFileEntry(entry, relativePath);
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

			this.decorationsMap.ignored.set(filePath, ignoredDecorations);
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
			diagnostic.source = constants.getCxAi();
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
		this.decorationsMap.critical.set(filePath, criticalDecorations);
		this.decorationsMap.high.set(filePath, highDecorations);
		this.decorationsMap.medium.set(filePath, mediumDecorations);
		this.decorationsMap.low.set(filePath, lowDecorations);

		if (diagnostics.length > 0) {
			this.diagnosticCollection.set(uri, diagnostics);
		}

		this.applyDecorations(uri);
	}

	private applyDecorations(uri: vscode.Uri): void {
		const editors = vscode.window.visibleTextEditors.filter((editor) => editor.document.uri.toString() === uri.toString());

		for (const editor of editors) {
			const filePath = editor.document.uri.fsPath;

			editor.setDecorations(this.decorationTypes.critical, this.decorationsMap.critical.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.high, this.decorationsMap.high.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.medium, this.decorationsMap.medium.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.low, this.decorationsMap.low.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.ignored, this.decorationsMap.ignored.get(filePath) || []);
		}
	}

	public clearScanData(uri: vscode.Uri): void {
		const filePath = uri.fsPath;
		this.diagnosticCollection.delete(uri);
		this.diagnosticsMap.delete(filePath);
		this.iacHoverData.clear();
		Object.values(this.decorationsMap).forEach(map => map.delete(filePath));
	}

	public getHoverData(): Map<string, IacHoverData[]> {
		return this.iacHoverData;
	}

	public getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
		return this.diagnosticsMap;
	}

	dispose(): void {
		super.dispose();

		this.diagnosticsMap.clear();
		this.iacHoverData.clear();
		Object.values(this.decorationsMap).forEach(map => map.clear());
	}


	public hasAnySeverityDecorations(): boolean {
		return (
			this.decorationsMap.critical.size > 0 ||
			this.decorationsMap.high.size > 0 ||
			this.decorationsMap.medium.size > 0 ||
			this.decorationsMap.low.size > 0
		);
	}

	public hasAnyDecorationsAtLine(uri: vscode.Uri, lineNumber: number): boolean {
		const filePath = uri.fsPath;
		const decorationMaps = [
			this.decorationsMap.critical,
			this.decorationsMap.high,
			this.decorationsMap.medium,
			this.decorationsMap.low,
			this.decorationsMap.ignored
		];

		return decorationMaps.some(map => {
			const decorations = map.get(filePath) || [];
			return decorations.some(decoration => decoration.range.start.line === lineNumber);
		});
	}

	private removeGutterAtLine(filePath: string, lineNumber: number): void {
		const decorationMaps = [
			this.decorationsMap.critical,
			this.decorationsMap.high,
			this.decorationsMap.medium,
			this.decorationsMap.low,
			this.decorationsMap.ignored
		];

		decorationMaps.forEach(map => {
			const decorations = map.get(filePath) || [];
			const filtered = decorations.filter(decoration => decoration.range.start.line !== lineNumber);
			map.set(filePath, filtered);
		});
	}

	private getAnyRangeAtLine(filePath: string, lineNumber: number): vscode.Range | undefined {
		const decorationMaps = [
			this.decorationsMap.critical,
			this.decorationsMap.high,
			this.decorationsMap.medium,
			this.decorationsMap.low,
			this.decorationsMap.ignored
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
		let key: keyof typeof this.decorationsMap;
		switch (severity.toLowerCase()) {
			case CxRealtimeEngineStatus.critical.toLowerCase():
				key = 'critical';
				break;
			case CxRealtimeEngineStatus.high.toLowerCase():
				key = 'high';
				break;
			case CxRealtimeEngineStatus.medium.toLowerCase():
				key = 'medium';
				break;
			case CxRealtimeEngineStatus.low.toLowerCase():
				key = 'low';
				break;
			case 'ignored':
				key = 'ignored';
				break;
			default:
				key = 'low';
		}
		const map = this.decorationsMap[key];
		const decorations = map.get(filePath) || [];
		decorations.push(decoration);
		map.set(filePath, decorations);
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
