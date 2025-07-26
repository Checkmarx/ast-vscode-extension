/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import { IgnoreFileManager } from "../../common/ignoreFileManager";
import { minimatch } from "minimatch";
import path from "path";
import CxSecretsResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/secrets/CxSecrets";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { cx } from "../../../cx";
import fs from "fs";

export class SecretsScannerService extends BaseScannerService {
	private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
	private criticalDecorations: Map<string, vscode.DecorationOptions[]> = new Map();
	private highDecorations: Map<string, vscode.DecorationOptions[]> = new Map();
	private mediumDecorations: Map<string, vscode.DecorationOptions[]> = new Map();
	private ignoredDecorations: Map<string, vscode.DecorationOptions[]> = new Map();

	private documentOpenListener: vscode.Disposable | undefined;
	private editorChangeListener: vscode.Disposable | undefined;
	public secretsHoverData: Map<string, any> = new Map();

	private createDecoration(iconName: string, size: string = "auto"): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.file(
				path.join(__dirname, "..", "..", "..", "..", "media", "icons", iconName)
			),
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			gutterIconSize: size
		});
	}

	private decorationTypes = {
		critical: this.createDecoration("realtimeEngines/critical_severity.svg", "12px"),
		high: this.createDecoration("realtimeEngines/high_severity.svg"),
		medium: this.createDecoration("realtimeEngines/medium_severity.svg"),
		ignored: this.createDecoration("Ignored.svg")
	};

	constructor() {
		const config: IScannerConfig = {
			engineName: constants.secretsScannerEngineName,
			configSection: constants.secretsScanner,
			activateKey: constants.activateSecretsScanner,
			enabledMessage: constants.secretsScannerStart,
			disabledMessage: constants.secretsScannerDisabled,
			errorMessage: constants.errorSecretsScanRealtime,
		};
		super(config);
	}

	shouldScanFile(document: vscode.TextDocument): boolean {
		if (!super.shouldScanFile(document)) {
			return false;
		}
		const filePath = document.uri.fsPath.replace(/\\/g, "/");
		return !constants.supportedManifestFilePatterns.some(pattern => minimatch(filePath, pattern));
	}

	private saveFile(tempFolder: string, originalFilePath: string, content: string): string {
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
		logs.info("Scanning for secrets in file: " + filePath);

		const tempFolder = this.getTempSubFolderPath(document, constants.secretsScannerDirectory);
		let tempFilePath: string | undefined;
		try {
			this.createTempFolder(tempFolder);
			tempFilePath = this.saveFile(tempFolder, filePath, document.getText());

			const ignoreManager = IgnoreFileManager.getInstance();
			ignoreManager.setScannedFilePath(filePath, tempFilePath);
			const ignoredPackagesFile = ignoreManager.getIgnoredPackagesTempFile();

			const scanResults = await cx.secretsScanResults(tempFilePath, ignoredPackagesFile || "");

			this.updateProblems<CxSecretsResult[]>(scanResults, document.uri);

			let fullScanResults: CxSecretsResult[] = scanResults;
			if (ignoreManager.getIgnoredPackagesCount() > 0) {
				fullScanResults = await cx.secretsScanResults(tempFilePath, "");
			}

			ignoreManager.removeMissingSecrets(fullScanResults, filePath);

			const ignoredData = ignoreManager.getIgnoredPackagesData();
			const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
			const ignoredDecorations: vscode.DecorationOptions[] = [];

			Object.entries(ignoredData).forEach(([, entry]) => {
				if (entry.type !== constants.secretsScannerEngineName) { return; }
				const fileEntry = entry.files.find(f => f.path === relativePath && f.active);
				if (!fileEntry || fileEntry.line === undefined) { return; }

				const adjustedLine = Math.max(0, fileEntry.line - 1);

				const range = new vscode.Range(
					new vscode.Position(adjustedLine, 0),
					new vscode.Position(adjustedLine, 1000)
				);
				ignoredDecorations.push({ range });

				const hoverKey = `${filePath}:${adjustedLine}`;
				if (!this.secretsHoverData.has(hoverKey)) {
					this.secretsHoverData.set(hoverKey, {
						title: entry.PackageName,
						description: entry.description,
						severity: entry.severity,
						filePath,
						location: { line: adjustedLine, startIndex: 0, endIndex: 1000 }
					});
				}
			});

			this.ignoredDecorations.set(filePath, ignoredDecorations);
			this.applyDecorations(document.uri);

		} catch (error) {
			console.error(error);
			logs.error(this.config.errorMessage + `: ${error}`);
		} finally {
			this.deleteTempFile(tempFilePath);
		}
	}

	updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void {
		const secretsProblems = problems as CxSecretsResult[];
		const filePath = uri.fsPath;
		const diagnostics: vscode.Diagnostic[] = [];
		const criticalDecorations: vscode.DecorationOptions[] = [];
		const highDecorations: vscode.DecorationOptions[] = [];
		const mediumDecorations: vscode.DecorationOptions[] = [];

		for (const problem of secretsProblems) {
			if (problem.locations.length === 0) { continue; }
			const location = problem.locations[0];
			const range = new vscode.Range(
				new vscode.Position(location.line, location.startIndex),
				new vscode.Position(location.line, location.endIndex)
			);
			const key = `${filePath}:${location.line}`;
			this.secretsHoverData.set(key, {
				title: problem.title,
				description: problem.description,
				severity: problem.severity,
				location,
				filePath
			});

			const severityMap = {
				critical: vscode.DiagnosticSeverity.Error,
				high: vscode.DiagnosticSeverity.Error,
				medium: vscode.DiagnosticSeverity.Warning
			};

			const diagnostic = new vscode.Diagnostic(range, `Secrets have been detected: ${problem.title}`, severityMap[problem.severity]);
			diagnostic.source = constants.cxAi;
			(diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
				cxType: constants.secretsScannerEngineName,
				item: {
					title: problem.title,
					description: problem.description,
					severity: problem.severity,
					location,
					filePath
				}
			};

			diagnostics.push(diagnostic);

			const decoration = { range };
			switch (problem.severity) {
				case CxRealtimeEngineStatus.critical:
					criticalDecorations.push(decoration);
					break;
				case CxRealtimeEngineStatus.high:
					highDecorations.push(decoration);
					break;
				case CxRealtimeEngineStatus.medium:
					mediumDecorations.push(decoration);
					break;
			}
		}

		this.diagnosticsMap.set(filePath, diagnostics);
		this.diagnosticCollection.set(uri, diagnostics);

		this.criticalDecorations.set(filePath, criticalDecorations);
		this.highDecorations.set(filePath, highDecorations);
		this.mediumDecorations.set(filePath, mediumDecorations);
	}

	private applyDecorations(uri: vscode.Uri): void {
		const editor = vscode.window.visibleTextEditors.find(
			e => e.document.uri.toString() === uri.toString()
		);
		if (!editor) { return; }

		const filePath = uri.fsPath;
		editor.setDecorations(this.decorationTypes.critical, this.criticalDecorations.get(filePath) || []);
		editor.setDecorations(this.decorationTypes.high, this.highDecorations.get(filePath) || []);
		editor.setDecorations(this.decorationTypes.medium, this.mediumDecorations.get(filePath) || []);
		editor.setDecorations(this.decorationTypes.ignored, this.ignoredDecorations.get(filePath) || []);
	}

	public clearScanData(uri: vscode.Uri): void {
		const filePath = uri.fsPath;
		this.diagnosticsMap.delete(filePath);
		this.diagnosticCollection.delete(uri);
		this.secretsHoverData.delete(filePath);
		this.criticalDecorations.delete(filePath);
		this.highDecorations.delete(filePath);
		this.mediumDecorations.delete(filePath);
		this.ignoredDecorations.delete(filePath);
	}

	public async initializeScanner(): Promise<void> {
		this.documentOpenListener = vscode.workspace.onDidOpenTextDocument(this.onDocumentOpen.bind(this));
		this.editorChangeListener = vscode.window.onDidChangeActiveTextEditor(this.onEditorChange.bind(this));
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

	public async clearProblems(): Promise<void> {
		await super.clearProblems();
		this.diagnosticsMap.clear();
		this.criticalDecorations.clear();
		this.highDecorations.clear();
		this.mediumDecorations.clear();
		this.ignoredDecorations.clear();
	}

	public dispose(): void {
		this.documentOpenListener?.dispose();
		this.editorChangeListener?.dispose();
	}
}
