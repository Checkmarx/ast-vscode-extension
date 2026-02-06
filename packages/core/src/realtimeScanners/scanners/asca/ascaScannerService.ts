/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData, AscaHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import path from "path";
import CxAsca from "@checkmarx/ast-cli-javascript-wrapper/dist/main/asca/CxAsca";
import { cx } from "../../../cx";
import fs from "fs";
import { IgnoreFileManager } from "../../common/ignoreFileManager";
import { logScanResults } from "../common";
import { ThemeUtils } from "../../../utils/themeUtils";

export class AscaScannerService extends BaseScannerService {
	private themeChangeListener: vscode.Disposable | undefined;
	private diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
	private ascaHoverData = new Map<string, AscaHoverData[]>();
	private decorationsMap = {
		critical: new Map<string, vscode.DecorationOptions[]>(),
		high: new Map<string, vscode.DecorationOptions[]>(),
		medium: new Map<string, vscode.DecorationOptions[]>(),
		low: new Map<string, vscode.DecorationOptions[]>(),
		ignored: new Map<string, vscode.DecorationOptions[]>(),
	};


	private decorationTypes = {
		critical: this.createDecoration("realtimeEngines/critical_severity.svg", "12px"),
		high: this.createDecoration("realtimeEngines/high_severity.svg"),
		medium: this.createDecoration("realtimeEngines/medium_severity.svg"),
		low: this.createDecoration("realtimeEngines/low_severity.svg"),
		ignored: this.createDecoration(ThemeUtils.selectIconByTheme('Ignored_light.svg', "Ignored.svg")),
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
				path.join(__dirname, "..", "..", "..", "media", "icons", iconName)
			),
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			gutterIconSize: size,
		});
	}

	constructor() {
		const config: IScannerConfig = {
			engineName: constants.ascaRealtimeScannerEngineName,
			configSection: constants.getAscaRealtimeScanner(),
			activateKey: constants.activateAscaRealtimeScanner,
			enabledMessage: constants.ascaRealtimeScannerStart,
			disabledMessage: constants.ascaRealtimeScannerDisabled,
			errorMessage: constants.errorAscaScanRealtime
		};
		super(config);

		this.registerHoverDataMap(this.ascaHoverData);

		// Set up theme change listener using common method
		this.themeChangeListener = BaseScannerService.createThemeChangeHandler(this, 'Ignored_light.svg');
	}

	shouldScanFile(document: vscode.TextDocument): boolean {
		if (!super.shouldScanFile(document)) {
			return false;
		}

		const fileExtension = path.extname(document.uri.fsPath).toLowerCase();
		return constants.ascaSupportedExtensions.includes(fileExtension);
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
			// Pass full results to updateProblems for proper ignored handling
			this.updateProblems<CxAsca>(fullScanResults, document.uri);

			if (ignoreManager.getIgnoredPackagesCount() > 0) {
				this.cleanupIgnoredEntries(fullScanResults.scanDetails, filePath);
			}

			logScanResults("asca", fullScanResults.scanDetails);

			logs.info(`${fullScanResults.scanDetails.length} security best practice violations were found in ${filePath} (${fullScanResults.scanDetails.filter(r => !this.isAscaResultIgnored(r, filePath)).length} active, ${fullScanResults.scanDetails.filter(r => this.isAscaResultIgnored(r, filePath)).length} ignored)`);
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

	private isAscaResultIgnored(result: any, filePath: string): boolean {
		const ignoreManager = IgnoreFileManager.getInstance();
		if (!ignoreManager) {
			return false;
		}

		const ignoreData = ignoreManager.getIgnoredPackagesData();
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
		if (!workspaceFolder) {
			return false;
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath).replace(/\\/g, '/');
		const packageKey = `${result.ruleName}:${result.ruleId}:${relativePath}`;

		const ignoreEntry = ignoreData[packageKey];
		if (!ignoreEntry || ignoreEntry.type !== constants.ascaRealtimeScannerEngineName) {
			return false;
		}

		// Check if there's an active file entry for this path and line
		const fileEntry = ignoreEntry.files.find(f =>
			f.path === relativePath &&
			f.active &&
			f.line === result.line
		);

		return !!fileEntry;
	}

	protected getHighestSeverity(severities: string[]): string {
		const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

		for (const severity of severityOrder) {
			if (severities.some(s => s.toUpperCase() === severity)) {
				return severity;
			}
		}

		return severities[0] || 'LOW';
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

		const resultsByLine = new Map<number, any[]>();

		for (const result of scanResults.scanDetails) {
			const lineNumber = result.line - 1;

			if (this.hasSecretsAtLine(uri, lineNumber)) {
				continue;
			}

			// Skip ignored results
			if (this.isAscaResultIgnored(result, filePath)) {
				continue;
			}

			if (!resultsByLine.has(lineNumber)) {
				resultsByLine.set(lineNumber, []);
			}
			resultsByLine.get(lineNumber)!.push(result);
		}

		for (const [lineNumber, lineResults] of resultsByLine) {
			const firstResult = lineResults[0];
			const problemText = firstResult.problematicLine;
			const startIndex = problemText.length - problemText.trimStart().length;

			const range = new vscode.Range(
				new vscode.Position(lineNumber, startIndex),
				new vscode.Position(lineNumber, problemText.length)
			);

			const problemCount = lineResults.length;
			const titleMessage = problemCount === 1
				? lineResults[0].ruleName
				: `${problemCount} ASCA violations detected on this line`;

			const diagnostic = new vscode.Diagnostic(
				range,
				titleMessage,
				vscode.DiagnosticSeverity.Error
			);

			diagnostic.source = constants.getCxAi();
			(diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
				cxType: 'asca',
				item: {
					ruleName: problemCount === 1 ? lineResults[0].ruleName : titleMessage,
					description: problemCount === 1 ? (lineResults[0].description || lineResults[0].remediationAdvise) : titleMessage,
					severity: this.getHighestSeverity(lineResults.map(r => r.severity)),
					remediationAdvise: problemCount === 1 ? lineResults[0].remediationAdvise : undefined,
					location: {
						line: lineNumber,
						startIndex: startIndex,
						endIndex: problemText.length
					}
				}
			};

			diagnostics.push(diagnostic);

			const key = `${filePath}:${lineNumber}`;
			const hoverProblems: AscaHoverData[] = lineResults.map(result => ({
				ruleName: result.ruleName,
				description: result.description || result.remediationAdvise,
				severity: result.severity,
				remediationAdvise: result.remediationAdvise,
				filePath: filePath,
				ruleId: result.ruleId,
				location: {
					line: lineNumber,
					startIndex: startIndex,
					endIndex: problemText.length
				}
			}));

			this.ascaHoverData.set(key, hoverProblems);

			const highestSeverity = this.getHighestSeverity(lineResults.map(r => r.severity));
			const decoration = { range };
			switch (highestSeverity.toUpperCase()) {
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

		// Handle ignored results - create ignored decorations
		const ignoredDecorations: vscode.DecorationOptions[] = [];
		const ignoredResultsByLine = new Map<number, any[]>();

		// Check for ignored results
		for (const result of scanResults.scanDetails) {
			const lineNumber = result.line - 1;

			if (this.hasSecretsAtLine(uri, lineNumber)) {
				continue;
			}

			// Only include ignored results here
			if (this.isAscaResultIgnored(result, filePath)) {
				if (!ignoredResultsByLine.has(lineNumber)) {
					ignoredResultsByLine.set(lineNumber, []);
				}
				ignoredResultsByLine.get(lineNumber)!.push(result);
			}
		}

		// Create ignored decorations and hover data for ignored results
		for (const [lineNumber, ignoredResults] of ignoredResultsByLine) {
			const firstResult = ignoredResults[0];
			const problemText = firstResult.problematicLine;
			const startIndex = problemText.length - problemText.trimStart().length;

			const range = new vscode.Range(
				new vscode.Position(lineNumber, startIndex),
				new vscode.Position(lineNumber, problemText.length)
			);

			ignoredDecorations.push({ range });

			// Store hover data for ignored results too
			const key = `${filePath}:${lineNumber}`;
			if (!this.ascaHoverData.has(key)) {
				const hoverProblems: AscaHoverData[] = ignoredResults.map(result => ({
					ruleName: result.ruleName,
					description: result.description || result.remediationAdvise,
					severity: result.severity,
					remediationAdvise: result.remediationAdvise,
					filePath: filePath,
					ruleId: result.ruleId,
					location: {
						line: lineNumber,
						startIndex: startIndex,
						endIndex: problemText.length
					}
				}));

				this.ascaHoverData.set(key, hoverProblems);
			}
		}

		this.diagnosticsMap.set(filePath, diagnostics);
		this.diagnosticCollection.set(uri, diagnostics);

		this.decorationsMap.critical.set(filePath, criticalDecorations);
		this.decorationsMap.high.set(filePath, highDecorations);
		this.decorationsMap.medium.set(filePath, mediumDecorations);
		this.decorationsMap.low.set(filePath, lowDecorations);
		this.decorationsMap.ignored.set(filePath, ignoredDecorations);

		this.applyDecorations(uri);
	}

	public async clearProblems(): Promise<void> {
		await super.clearProblems();
		this.diagnosticsMap.clear();
		this.ascaHoverData.clear();
		Object.values(this.decorationsMap).forEach(map => map.clear());
	}


	public clearScanData(uri: vscode.Uri): void {
		const filePath = uri.fsPath;
		this.diagnosticsMap.delete(filePath);
		this.diagnosticCollection.delete(uri);

		const keysToDelete: string[] = [];
		for (const key of this.ascaHoverData.keys()) {
			if (key.startsWith(`${filePath}:`)) {
				keysToDelete.push(key);
			}
		}
		keysToDelete.forEach(key => {
			this.ascaHoverData.delete(key);
		});

		Object.values(this.decorationsMap).forEach(map => map.delete(filePath));
	}

	private applyDecorations(uri: vscode.Uri): void {
		const editor = vscode.window.visibleTextEditors.find(
			e => e.document.uri.toString() === uri.toString()
		);
		if (!editor) {
			return;
		}

		const filePath = uri.fsPath;
		const get = (key: keyof typeof this.decorationsMap) => this.decorationsMap[key].get(filePath) || [];
		editor.setDecorations(this.decorationTypes.critical, get('critical'));
		editor.setDecorations(this.decorationTypes.high, get('high'));
		editor.setDecorations(this.decorationTypes.medium, get('medium'));
		editor.setDecorations(this.decorationTypes.low, get('low'));
		editor.setDecorations(this.decorationTypes.ignored, get('ignored'));
	}

	// Getter for hover data to be used by the command
	getHoverData(): Map<string, AscaHoverData[]> {
		return this.ascaHoverData;
	}

	// Getter for diagnostics map to be used by the command
	getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
		return this.diagnosticsMap;
	}

	private updateIgnoredDecorationLine(filePath: string, oldLine: number, newLine: number): void {
		const ignoredDecorations = this.decorationsMap.ignored.get(filePath) || [];

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

			this.decorationsMap.ignored.set(filePath, ignoredDecorations);

			const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath);
			if (editor) {
				editor.setDecorations(this.decorationTypes.ignored, ignoredDecorations);
			}
		}
	}

	private updateHoverDataLine(filePath: string, oldLine: number, newLine: number): void {
		const oldKey = `${filePath}:${oldLine}`;
		const newKey = `${filePath}:${newLine}`;

		const hoverDataArray = this.ascaHoverData.get(oldKey);
		if (hoverDataArray) {
			// Update the line number in each hover data item
			hoverDataArray.forEach(hoverData => {
				if (hoverData.location) {
					hoverData.location.line = newLine;
				}
			});

			this.ascaHoverData.set(newKey, hoverDataArray);
			this.ascaHoverData.delete(oldKey);
		}
	}

	private removeIgnoredDecorationAtLine(filePath: string, line: number): void {
		const ignoredDecorations = this.decorationsMap.ignored.get(filePath) || [];

		const filteredDecorations = ignoredDecorations.filter(decoration =>
			decoration.range.start.line !== line
		);

		this.decorationsMap.ignored.set(filePath, filteredDecorations);

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
