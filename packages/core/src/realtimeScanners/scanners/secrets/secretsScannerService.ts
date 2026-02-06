/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData, SecretsHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import { IgnoreFileManager } from "../../common/ignoreFileManager";
import { minimatch } from "minimatch";
import path from "path";
import CxSecretsResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/secrets/CxSecrets";
import { CxRealtimeEngineStatus } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { cx } from "../../../cx";
import { logScanResults } from "../common";
import { ThemeUtils } from "../../../utils/themeUtils";

export class SecretsScannerService extends BaseScannerService {
	private themeChangeListener: vscode.Disposable | undefined;
	private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
	private decorationsMap = {
		critical: new Map<string, vscode.DecorationOptions[]>(),
		high: new Map<string, vscode.DecorationOptions[]>(),
		medium: new Map<string, vscode.DecorationOptions[]>(),
		ignored: new Map<string, vscode.DecorationOptions[]>(),
	};

	public secretsHoverData: Map<string, SecretsHoverData> = new Map();

	private createDecoration(iconName: string, size: string = "auto"): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.file(
				path.join(__dirname, "..", "..", "..", "media", "icons", iconName)
			),
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			gutterIconSize: size
		});
	}

	private decorationTypes = {
		critical: this.createDecoration("realtimeEngines/critical_severity.svg", "12px"),
		high: this.createDecoration("realtimeEngines/high_severity.svg"),
		medium: this.createDecoration("realtimeEngines/medium_severity.svg"),
		ignored: this.createDecoration(ThemeUtils.selectIconByTheme('Ignored_light.svg', "Ignored.svg")),
	};

	constructor() {
		const config: IScannerConfig = {
			engineName: constants.secretsScannerEngineName,
			configSection: constants.getSecretsScanner(),
			activateKey: constants.activateSecretsScanner,
			enabledMessage: constants.secretsScannerStart,
			disabledMessage: constants.secretsScannerDisabled,
			errorMessage: constants.errorSecretsScanRealtime,
		};
		super(config);

		this.registerHoverDataMap(this.secretsHoverData);

		// Set up theme change listener using common method
		this.themeChangeListener = BaseScannerService.createThemeChangeHandler(this, 'Ignored_light.svg');
	}

	shouldScanFile(document: vscode.TextDocument): boolean {
		if (!super.shouldScanFile(document)) {
			return false;
		}
		const filePath = document.uri.fsPath.replace(/\\/g, "/");
		if (this.isManifestFile(filePath) || this.isRealtimeIgnoreFile(filePath)) {
			return false;
		}
		return true;
	}

	private isManifestFile(filePath: string): boolean {
		return constants.supportedManifestFilePatterns.some(pattern => minimatch(filePath, pattern));
	}

	private isRealtimeIgnoreFile(filePath: string): boolean {
		return filePath.includes("/.vscode/.checkmarxIgnored") ||
			filePath.includes("/.vscode/.checkmarxIgnoredTempList") ||
			filePath.includes("/.vscode/.checkmarxDevAssistIgnored") ||
			filePath.includes("/.vscode/.checkmarxDevAssistIgnoredTempList");
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
			if (ignoreManager.getIgnoredPackagesCount() > 0) {
				ignoreManager.updateTempList();
			}
			const ignoredPackagesFile = ignoreManager.getIgnoredPackagesTempFile();

			const scanResults = await cx.secretsScanResults(tempFilePath, ignoredPackagesFile || "");

			let fullScanResults: CxSecretsResult[] = scanResults;
			if (ignoreManager.getIgnoredPackagesCount() > 0) {
				fullScanResults = await cx.secretsScanResults(tempFilePath, "");
			}

			ignoreManager.removeMissingSecrets(fullScanResults, filePath);

			this.updateProblems<CxSecretsResult[]>(scanResults, document.uri);

			const ignoredData = ignoreManager.getIgnoredPackagesData();
			const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
			const ignoredDecorations: vscode.DecorationOptions[] = [];

			const secretLocations = new Map<string, number[]>();
			fullScanResults.forEach(result => {
				if (result.secretValue) {
					const key = `${result.title}:${result.secretValue}:${relativePath}`;
					const lines = secretLocations.get(key) || [];
					result.locations.forEach(loc => lines.push(loc.line));
					secretLocations.set(key, lines);
				}
			});

			logScanResults("secrets", fullScanResults);

			Object.entries(ignoredData).forEach(([, entry]) => {
				if (entry.type !== constants.secretsScannerEngineName) { return; }
				const fileEntry = this.findActiveFileEntry(entry, relativePath);
				if (!fileEntry) { return; }

				const key = `${entry.PackageName}:${entry.secretValue}:${relativePath}`;
				const lines = secretLocations.get(key) || [];

				// Only show gutter icon on the first line of multi-line secrets
				if (lines.length > 0) {
					const firstLine = lines[0];
					const range = new vscode.Range(
						new vscode.Position(firstLine, 0),
						new vscode.Position(firstLine, 1000)
					);
					ignoredDecorations.push({ range });
				}

				// But keep hover data for all lines so users can hover anywhere
				lines.forEach(line => {
					const hoverKey = `${filePath}:${line}`;
					if (!this.secretsHoverData.has(hoverKey)) {
						this.secretsHoverData.set(hoverKey, {
							title: entry.PackageName,
							description: entry.description,
							severity: entry.severity,
							secretValue: entry.secretValue,
							filePath,
							location: { line: line, startIndex: 0, endIndex: 1000 }
						});
					}
				});
			});

			this.decorationsMap.ignored.set(filePath, ignoredDecorations);
			this.applyDecorations(document.uri);
		} catch (error) {
			console.error(error);
			logs.error(this.config.errorMessage + `: ${error}`);
			this.storeAndApplyResults(
				filePath,
				document.uri,
				[],
				[],
				[],
				[]
			);
		} finally {
			this.deleteTempFile(tempFilePath);
		}
	}

	private removeAscaDiagnosticsAtLine(uri: vscode.Uri, lineNumber: number): void {
		const ascaCollection = this.getOtherScannerCollection(constants.ascaRealtimeScannerEngineName);
		if (!ascaCollection) { return; }

		const ascaDiagnostics = vscode.languages.getDiagnostics(uri).filter(diagnostic => {
			const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
			return diagnosticData?.cxType === 'asca';
		});

		const filteredDiagnostics = ascaDiagnostics.filter(diagnostic =>
			diagnostic.range.start.line !== lineNumber
		);
		ascaCollection.set(uri, filteredDiagnostics);
	}

	private removeAscaHoverDataAtLine(filePath: string, lineNumber: number): void {
		const ascaHoverData = this.getOtherScannerHoverData(constants.ascaRealtimeScannerEngineName);
		if (ascaHoverData) {
			const key = `${filePath}:${lineNumber}`;
			ascaHoverData.delete(key);
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

			this.removeAscaDiagnosticsAtLine(uri, location.line);
			this.removeAscaHoverDataAtLine(filePath, location.line);

			const range = new vscode.Range(
				new vscode.Position(location.line, location.startIndex),
				new vscode.Position(location.line, location.endIndex)
			);
			const key = `${filePath}:${location.line}`;
			this.secretsHoverData.set(key, {
				title: problem.title,
				description: problem.description,
				severity: problem.severity,
				secretValue: problem.secretValue,
				location,
				filePath
			});

			const severityMap = {
				critical: vscode.DiagnosticSeverity.Error,
				high: vscode.DiagnosticSeverity.Error,
				medium: vscode.DiagnosticSeverity.Warning
			};

			const diagnostic = new vscode.Diagnostic(range, `Secrets have been detected: ${problem.title}`, severityMap[problem.severity]);
			diagnostic.source = constants.getCxAi();
			(diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
				cxType: constants.secretsScannerEngineName,
				item: {
					title: problem.title,
					description: problem.description,
					severity: problem.severity,
					secretValue: problem.secretValue,
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

		this.storeAndApplyResults(
			filePath,
			uri,
			diagnostics,
			criticalDecorations,
			highDecorations,
			mediumDecorations
		);
	}
	private storeAndApplyResults(
		filePath: string,
		uri: vscode.Uri,
		diagnostics: vscode.Diagnostic[],
		criticalDecorations: vscode.DecorationOptions[],
		highDecorations: vscode.DecorationOptions[],
		mediumDecorations: vscode.DecorationOptions[],
	): void {
		this.diagnosticsMap.set(filePath, diagnostics);
		this.diagnosticCollection.set(uri, diagnostics);

		this.decorationsMap.critical.set(filePath, criticalDecorations);
		this.decorationsMap.high.set(filePath, highDecorations);
		this.decorationsMap.medium.set(filePath, mediumDecorations);

		this.applyDecorations(uri);
	}

	private applyDecorations(uri: vscode.Uri): void {
		const editor = vscode.window.visibleTextEditors.find(
			e => e.document.uri.toString() === uri.toString()
		);
		if (!editor) { return; }

		const filePath = uri.fsPath;
		editor.setDecorations(this.decorationTypes.critical, this.decorationsMap.critical.get(filePath) || []);
		editor.setDecorations(this.decorationTypes.high, this.decorationsMap.high.get(filePath) || []);
		editor.setDecorations(this.decorationTypes.medium, this.decorationsMap.medium.get(filePath) || []);
		editor.setDecorations(this.decorationTypes.ignored, this.decorationsMap.ignored.get(filePath) || []);
	}

	public clearScanData(uri: vscode.Uri): void {
		const filePath = uri.fsPath;
		this.diagnosticsMap.delete(filePath);
		this.diagnosticCollection.delete(uri);
		this.secretsHoverData.delete(filePath);
		Object.values(this.decorationsMap).forEach(map => map.delete(filePath));
	}


	public async clearProblems(): Promise<void> {
		await super.clearProblems();
		this.diagnosticsMap.clear();
		Object.values(this.decorationsMap).forEach(map => map.clear());
	}

	getHoverData(): Map<string, any> {
		return this.secretsHoverData;
	}

	getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
		return this.diagnosticsMap;
	}

	public dispose(): void {
		// Dispose theme change listener
		if (this.themeChangeListener) {
			this.themeChangeListener.dispose();
			this.themeChangeListener = undefined;
		}

		// Call parent dispose if it exists
		if (super.dispose && typeof super.dispose === 'function') {
			super.dispose();
		}
	}
}
