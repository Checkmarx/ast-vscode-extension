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

export class AscaScannerService extends BaseScannerService {
	private diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
	private ascaHoverData = new Map<string, AscaHoverData>();
	private criticalDecorations = new Map<string, vscode.DecorationOptions[]>();
	private highDecorations = new Map<string, vscode.DecorationOptions[]>();
	private mediumDecorations = new Map<string, vscode.DecorationOptions[]>();
	private lowDecorations = new Map<string, vscode.DecorationOptions[]>();

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

			const scanResults = await cx.scanAsca(tempFilePath);

			if (scanResults.error) {
				logs.warn("ASCA Warning: " + (scanResults.error.description ?? scanResults.error));
				return;
			}

			this.updateProblems<CxAsca>(scanResults, document.uri);
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
	}

	// Getter for hover data to be used by the command
	getHoverData(): Map<string, AscaHoverData> {
		return this.ascaHoverData;
	}

	// Getter for diagnostics map to be used by the command
	getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
		return this.diagnosticsMap;
	}
}
