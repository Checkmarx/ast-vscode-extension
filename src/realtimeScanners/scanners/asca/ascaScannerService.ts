/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData, AscaHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import path from "path";
import CxAsca from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/asca/CxAsca";
import { cx } from "../../../cx";
import fs from "fs";
import { IgnoreFileManager } from "../../common/ignoreFileManager";

export class AscaScannerService extends BaseScannerService {
	private diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
	private ascaHoverData = new Map<string, AscaHoverData>();
	private criticalDecorations = new Map<string, vscode.DecorationOptions[]>();
	private highDecorations = new Map<string, vscode.DecorationOptions[]>();
	private mediumDecorations = new Map<string, vscode.DecorationOptions[]>();
	private lowDecorations = new Map<string, vscode.DecorationOptions[]>();
	private ignoredDecorations = new Map<string, vscode.DecorationOptions[]>();

	private documentOpenListener: vscode.Disposable | undefined;
	private editorChangeListener: vscode.Disposable | undefined;

	private decorationTypes = {
		malicious: this.createDecoration("malicious.svg"),
		ok: this.createDecoration("realtimeEngines/green_check.svg"),
		unknown: this.createDecoration("realtimeEngines/question_mark.svg"),
		critical: this.createDecoration("realtimeEngines/critical_severity.svg", "12px"),
		high: this.createDecoration("realtimeEngines/high_severity.svg"),
		medium: this.createDecoration("realtimeEngines/medium_severity.svg"),
		low: this.createDecoration("realtimeEngines/low_severity.svg"),
		ignored: this.createDecoration("Ignored.svg"),
		underline: vscode.window.createTextEditorDecorationType({
			textDecoration: "underline wavy #f14c4c",
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		}),
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
			engineName: constants.ascaRealtimeScannerEngineName,
			configSection: constants.ascaRealtimeScanner,
			activateKey: constants.activateAscaRealtimeScanner,
			enabledMessage: constants.ascaRealtimeScannerStart,
			disabledMessage: constants.ascaRealtimeScannerDisabled,
			errorMessage: constants.errorAscaScanRealtime
		};
		super(config);

		this.registerHoverDataMap(this.ascaHoverData);
	}

	shouldScanFile(document: vscode.TextDocument): boolean {
		if (!super.shouldScanFile(document)) {
			return false;
		}

		const fileExtension = path.extname(document.uri.fsPath).toLowerCase();
		return constants.ascaSupportedExtensions.includes(fileExtension);
	}

	private saveFile(
		tempFolder: string,
		originalFilePath: string,
		content: string
	): string {
		const originalExt = path.extname(originalFilePath);
		const baseName = path.basename(originalFilePath, originalExt);
		const hash = this.generateFileHash(originalFilePath);
		const tempFileName = `${baseName}-${hash}${originalExt}`;
		const tempFilePath = path.join(tempFolder, tempFileName);
		fs.writeFileSync(tempFilePath, content);
		return tempFilePath;
	}

	public async scan(document: vscode.TextDocument, logs: Logs): Promise<void> {
		if (!this.shouldScanFile(document)) {
			return;
		}

		const filePath = document.uri.fsPath;
		logs.info("Scanning ASCA in file: " + filePath);

		const tempFolder = this.getTempSubFolderPath(document, constants.ascaRealtimeScannerDirectory);

		let tempFilePath: string | undefined;

		try {
			this.createTempFolder(tempFolder);
			tempFilePath = this.saveFile(
				tempFolder,
				filePath,
				document.getText()
			);

			const ignoreManager = IgnoreFileManager.getInstance();
			ignoreManager.setScannedFilePath(filePath, tempFilePath);

			const fullScanResults = await cx.scanAsca(tempFilePath, "");

			if (fullScanResults.error) {
				logs.warn("ASCA Warning: " + (fullScanResults.error.description ?? fullScanResults.error));
				return;
			}

			if (ignoreManager.getIgnoredPackagesCount() > 0) {
				ignoreManager.removeMissingAsca(fullScanResults.scanDetails, filePath);
			}
			const ignoredPackagesFile = ignoreManager.getIgnoredPackagesTempFile();
			const scanResults = await cx.scanAsca(tempFilePath, ignoredPackagesFile || "");

			this.updateProblems<CxAsca>(scanResults, document.uri);

			if (ignoreManager.getIgnoredPackagesCount() > 0) {
				this.cleanupIgnoredEntries(fullScanResults.scanDetails, filePath);
			}


			const ignoredData = ignoreManager.getIgnoredPackagesData();
			const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
			const ignoredDecorations: vscode.DecorationOptions[] = [];


			const ascaLocations = new Map<string, number[]>();
			fullScanResults.scanDetails.forEach(result => {
				const key = `${result.ruleName}:${result.ruleId}`;
				const lines = ascaLocations.get(key) || [];
				lines.push(result.line - 1);
				ascaLocations.set(key, lines);
			});

			Object.entries(ignoredData).forEach(([packageKey, entry]) => {
				if (entry.type !== constants.ascaRealtimeScannerEngineName) { return; }

				const expectedPackageKey = `${entry.PackageName}:${entry.ruleId}:${relativePath}`;
				if (packageKey !== expectedPackageKey) { return; }

				const fileEntry = entry.files.find(f => f.path === relativePath && f.active);
				if (!fileEntry) { return; }

				const key = `${entry.PackageName}:${entry.ruleId}`;
				const lines = ascaLocations.get(key) || [];

				lines.forEach(line => {
					const adjustedLine = line;
					const range = new vscode.Range(
						new vscode.Position(adjustedLine, 0),
						new vscode.Position(adjustedLine, 1000)
					);
					ignoredDecorations.push({ range });

					const hoverKey = `${filePath}:${adjustedLine}`;
					if (!this.ascaHoverData.has(hoverKey)) {
						this.ascaHoverData.set(hoverKey, {
							ruleName: entry.PackageName,
							description: entry.description || '',
							severity: entry.severity || 'medium',
							remediationAdvise: entry.description || '',
							filePath: filePath,
							ruleId: entry.ruleId,
							location: { line: adjustedLine, startIndex: 0, endIndex: 1000 }
						});
					}
				});
			});

			this.ignoredDecorations.set(filePath, ignoredDecorations);
			this.applyDecorations(document.uri);

			logs.info(`${scanResults.scanDetails.length} security best practice violations were found in ${filePath}`);
		} catch (error) {
			console.error(error);
			logs.error(this.config.errorMessage + `: ${error}`);
			this.clearScanData(document.uri);
			this.applyDecorations(document.uri);
		} finally {
			this.deleteTempFile(tempFilePath);
		}
	}

	private hasSecretsAtLine(uri: vscode.Uri, lineNumber: number): boolean {
		const secretsCollection = this.getOtherScannerCollection(constants.secretsScannerEngineName);
		if (secretsCollection) {
			const secretsDiagnostics = vscode.languages.getDiagnostics(uri).filter(diagnostic => {
				const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
				return diagnosticData?.cxType === constants.secretsScannerEngineName;
			});

			if (secretsDiagnostics.some(diagnostic => diagnostic.range.start.line === lineNumber)) {
				return true;
			}
		}
		return false;
	}

	updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void {
		const scanResults = problems as unknown as CxAsca;
		const filePath = uri.fsPath;

		const diagnostics: vscode.Diagnostic[] = [];
		this.diagnosticCollection.delete(uri);

		const criticalDecorations: vscode.DecorationOptions[] = [];
		const highDecorations: vscode.DecorationOptions[] = [];
		const mediumDecorations: vscode.DecorationOptions[] = [];
		const lowDecorations: vscode.DecorationOptions[] = [];

		for (const result of scanResults.scanDetails) {
			if (this.hasSecretsAtLine(uri, result.line - 1)) {
				continue;
			}

			const problemText = result.problematicLine;
			const startIndex = problemText.length - problemText.trimStart().length;

			const range = new vscode.Range(
				new vscode.Position(result.line - 1, startIndex),
				new vscode.Position(result.line - 1, problemText.length)
			);

			const diagnostic = new vscode.Diagnostic(
				range,
				result.ruleName,
				vscode.DiagnosticSeverity.Error
			);

			diagnostic.source = constants.cxAi;
			(diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
				cxType: 'asca',
				item: {
					ruleName: result.ruleName,
					description: result.description || result.remediationAdvise,
					severity: result.severity,
					remediationAdvise: result.remediationAdvise,
					location: {
						line: result.line - 1,
						startIndex: startIndex,
						endIndex: problemText.length
					}
				}
			};

			diagnostics.push(diagnostic);

			// Store hover data
			const key = `${filePath}:${result.line - 1}`;
			this.ascaHoverData.set(key, {
				ruleName: result.ruleName,
				description: result.description || result.remediationAdvise,
				severity: result.severity,
				remediationAdvise: result.remediationAdvise,
				filePath: filePath,
				ruleId: result.ruleId,
				location: {
					line: result.line - 1,
					startIndex: startIndex,
					endIndex: problemText.length
				}
			});

			const decoration = { range };
			switch (result.severity.toUpperCase()) {
				case 'CRITICAL':
					criticalDecorations.push(decoration);
					break;
				case 'HIGH':
					highDecorations.push(decoration);
					break;
				case 'MEDIUM':
					mediumDecorations.push(decoration);
					break;
				case 'LOW':
					lowDecorations.push(decoration);
					break;
			}
		}

		this.diagnosticsMap.set(filePath, diagnostics);
		this.diagnosticCollection.set(uri, diagnostics);

		this.criticalDecorations.set(filePath, criticalDecorations);
		this.highDecorations.set(filePath, highDecorations);
		this.mediumDecorations.set(filePath, mediumDecorations);
		this.lowDecorations.set(filePath, lowDecorations);

		this.applyDecorations(uri);
	}

	public async clearProblems(): Promise<void> {
		await super.clearProblems();
		this.diagnosticsMap.clear();
		this.ascaHoverData.clear();
		this.criticalDecorations.clear();
		this.highDecorations.clear();
		this.mediumDecorations.clear();
		this.lowDecorations.clear();
		this.ignoredDecorations.clear();
	}

	public dispose(): void {
		if (this.documentOpenListener) {
			this.documentOpenListener.dispose();
		}

		if (this.editorChangeListener) {
			this.editorChangeListener.dispose();
		}
	}

	public clearScanData(uri: vscode.Uri): void {
		const filePath = uri.fsPath;
		this.diagnosticsMap.delete(filePath);
		this.diagnosticCollection.delete(uri);
		this.ascaHoverData.delete(filePath);
		this.criticalDecorations.delete(filePath);
		this.highDecorations.delete(filePath);
		this.mediumDecorations.delete(filePath);
		this.lowDecorations.delete(filePath);
		this.ignoredDecorations.delete(filePath);
	}

	public async initializeScanner(): Promise<void> {
		this.documentOpenListener = vscode.workspace.onDidOpenTextDocument(
			this.onDocumentOpen.bind(this)
		);
		this.editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
			this.onEditorChange.bind(this)
		);
	}

	private onDocumentOpen(document: vscode.TextDocument): void {
		if (this.shouldScanFile(document)) {
			this.applyDecorations(document.uri);
		}
	}

	private onEditorChange(editor: vscode.TextEditor | undefined): void {
		if (editor && this.shouldScanFile(editor.document)) {
			this.applyDecorations(editor.document.uri);
		}
	}

	private applyDecorations(uri: vscode.Uri): void {
		const editor = vscode.window.visibleTextEditors.find(
			e => e.document.uri.toString() === uri.toString()
		);
		if (!editor) {
			return;
		}

		const filePath = uri.fsPath;
		const criticalDecorations = this.criticalDecorations.get(filePath) || [];
		const highDecorations = this.highDecorations.get(filePath) || [];
		const mediumDecorations = this.mediumDecorations.get(filePath) || [];
		const lowDecorations = this.lowDecorations.get(filePath) || [];

		editor.setDecorations(this.decorationTypes.critical, criticalDecorations);
		editor.setDecorations(this.decorationTypes.high, highDecorations);
		editor.setDecorations(this.decorationTypes.medium, mediumDecorations);
		editor.setDecorations(this.decorationTypes.low, lowDecorations);
		editor.setDecorations(this.decorationTypes.ignored, this.ignoredDecorations.get(filePath) || []);
	}

	// Getter for hover data to be used by the command
	getHoverData(): Map<string, AscaHoverData> {
		return this.ascaHoverData;
	}

	// Getter for diagnostics map to be used by the command
	getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
		return this.diagnosticsMap;
	}

	private updateIgnoredDecorationLine(filePath: string, oldLine: number, newLine: number): void {
		const ignoredDecorations = this.ignoredDecorations.get(filePath) || [];

		const oldDecorationIndex = ignoredDecorations.findIndex(decoration =>
			decoration.range.start.line === oldLine
		);

		if (oldDecorationIndex !== -1) {
			const oldDecoration = ignoredDecorations[oldDecorationIndex];
			ignoredDecorations.splice(oldDecorationIndex, 1);

			const newRange = new vscode.Range(
				new vscode.Position(newLine, oldDecoration.range.start.character),
				new vscode.Position(newLine, oldDecoration.range.end.character)
			);
			ignoredDecorations.push({ range: newRange });

			this.ignoredDecorations.set(filePath, ignoredDecorations);

			const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath);
			if (editor) {
				editor.setDecorations(this.decorationTypes.ignored, ignoredDecorations);
			}
		}
	}

	private updateHoverDataLine(filePath: string, oldLine: number, newLine: number): void {
		const oldKey = `${filePath}:${oldLine}`;
		const newKey = `${filePath}:${newLine}`;

		const hoverData = this.ascaHoverData.get(oldKey);
		if (hoverData) {
			hoverData.location.line = newLine;

			this.ascaHoverData.set(newKey, hoverData);
			this.ascaHoverData.delete(oldKey);
		}
	}

	private removeIgnoredDecorationAtLine(filePath: string, line: number): void {
		const ignoredDecorations = this.ignoredDecorations.get(filePath) || [];

		const filteredDecorations = ignoredDecorations.filter(decoration =>
			decoration.range.start.line !== line
		);

		this.ignoredDecorations.set(filePath, filteredDecorations);

		const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath);
		if (editor) {
			editor.setDecorations(this.decorationTypes.ignored, filteredDecorations);
		}


		const hoverKey = `${filePath}:${line}`;
		this.ascaHoverData.delete(hoverKey);
	}

	private cleanupIgnoredEntries(fullScanResults: unknown[], currentFilePath: string): void {
		const ignoreManager = IgnoreFileManager.getInstance();
		const ignoredData = ignoreManager.getIgnoredPackagesData();
		const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', currentFilePath);


		const existingFindingsByRule = new Map<string, number[]>();
		fullScanResults.forEach(result => {
			const scanDetail = result as { ruleName: string; ruleId: number; line: number };
			const ruleKey = `${scanDetail.ruleName}:${scanDetail.ruleId}`;
			if (!existingFindingsByRule.has(ruleKey)) {
				existingFindingsByRule.set(ruleKey, []);
			}
			existingFindingsByRule.get(ruleKey)!.push(scanDetail.line - 1);
		});


		const activeEntries = Object.entries(ignoredData)
			.filter(([, entry]) => entry.type === constants.ascaRealtimeScannerEngineName)
			.flatMap(([packageKey, entry]) =>
				entry.files
					.filter(file => file.active && file.path === relativePath)
					.map(file => ({
						packageKey,
						entry,
						file,
						currentLine: file.line - 1
					}))
			);

		activeEntries.forEach(item => {
			const ruleKey = `${item.entry.PackageName}:${item.entry.ruleId}`;
			const availableLines = existingFindingsByRule.get(ruleKey);

			if (availableLines && availableLines.length > 0) {
				if (!availableLines.includes(item.currentLine)) {
					const newLine = availableLines[0];
					const success = ignoreManager.updatePackageLineNumber(item.packageKey, currentFilePath, newLine + 1);

					if (success) {
						this.updateIgnoredDecorationLine(currentFilePath, item.currentLine, newLine);
						this.updateHoverDataLine(currentFilePath, item.currentLine, newLine);
					}
				}
			} else {
				ignoreManager.removePackageEntry(item.packageKey, relativePath);
				this.removeIgnoredDecorationAtLine(currentFilePath, item.currentLine);
			}
		});
	}

}
