
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData, ContainersHoverData, IacHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxContainerRealtimeResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/containersRealtime/CxContainerRealtime";
import path from "path";
import { cx } from "../../../cx";
import fs from "fs";
import { minimatch } from "minimatch";
import { CxRealtimeEngineStatus } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/containersRealtime/CxRealtimeEngineStatus";
import { IgnoreFileManager } from "../../common/ignoreFileManager";
import { ThemeUtils } from "../../../utils/themeUtils";

export class ContainersScannerService extends BaseScannerService {
	private themeChangeListener: vscode.Disposable | undefined;
	private diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
	private containersHoverData = new Map<string, ContainersHoverData>();
	private lastFullScanResults: unknown[] = [];

	private decorationsMap = {
		malicious: new Map<string, vscode.DecorationOptions[]>(),
		ok: new Map<string, vscode.DecorationOptions[]>(),
		unknown: new Map<string, vscode.DecorationOptions[]>(),
		critical: new Map<string, vscode.DecorationOptions[]>(),
		high: new Map<string, vscode.DecorationOptions[]>(),
		medium: new Map<string, vscode.DecorationOptions[]>(),
		low: new Map<string, vscode.DecorationOptions[]>(),
		ignored: new Map<string, vscode.DecorationOptions[]>(),
		maliciousIcon: new Map<string, vscode.DecorationOptions[]>(),
		criticalIcon: new Map<string, vscode.DecorationOptions[]>(),
		highIcon: new Map<string, vscode.DecorationOptions[]>(),
		mediumIcon: new Map<string, vscode.DecorationOptions[]>(),
		lowIcon: new Map<string, vscode.DecorationOptions[]>(),
	};

	private decorationTypes = {
		malicious: this.createDecoration("malicious.svg"),
		ok: this.createDecoration("realtimeEngines/green_check.svg"),
		unknown: this.createDecoration("realtimeEngines/question_mark.svg"),
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

	private createDecoration(iconName: string, size: string = "auto"): vscode.TextEditorDecorationType {
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
			engineName: constants.containersRealtimeScannerEngineName,
			configSection: constants.getContainersRealtimeScanner(),
			activateKey: constants.activateContainersRealtimeScanner,
			enabledMessage: constants.containersRealtimeScannerStart,
			disabledMessage: constants.containersRealtimeScannerDisabled,
			errorMessage: constants.errorContainersScanRealtime
		};
		super(config);

		// Set up theme change listener using common method
		this.themeChangeListener = BaseScannerService.createThemeChangeHandler(this, 'Ignored_light.svg');
	}

	async getFullPathWithOriginalCasing(uri: vscode.Uri): Promise<string | undefined> {
		const dirPath = path.dirname(uri.fsPath);
		const dirUri = vscode.Uri.file(dirPath);
		const entries = await vscode.workspace.fs.readDirectory(dirUri);
		const fileNameLower = path.basename(uri.fsPath).toLowerCase();
		for (const [entryName] of entries) {
			if (entryName.toLowerCase() === fileNameLower) {
				return path.join(dirPath, entryName);
			}
		}
		return undefined;
	}

	private isDockerComposeFile(filePath: string): boolean {
		return path.basename(filePath).toLowerCase().includes('docker-compose');
	}

	shouldScanFile(document: vscode.TextDocument): boolean {
		if (!super.shouldScanFile(document)) { return false; }

		const filePath = document.uri.fsPath;
		const normalizedPath = filePath.replace(/\\/g, "/");

		const matchesContainerPattern = constants.containersSupportedPatterns.some((pattern) =>
			minimatch(normalizedPath, pattern, { nocase: true })
		);

		if (matchesContainerPattern) {
			return true;
		}

		const fileExtension = path.extname(filePath).toLowerCase();
		if (constants.containersHelmExtensions.includes(fileExtension)) {
			const fileName = path.basename(filePath).toLowerCase();
			if (constants.containersHelmExcludedFiles.includes(fileName)) { return false; }
			return normalizedPath.toLowerCase().includes("/helm/") || normalizedPath.toLowerCase().includes("\\helm\\");
		}
		return false;
	}

	private getHelmRelativePath(originalFilePath: string): string {
		const normalizedPath = originalFilePath.replace(/\\/g, "/");
		const helmIndex = normalizedPath.toLowerCase().lastIndexOf("/helm/");
		return helmIndex !== -1 ? normalizedPath.substring(helmIndex + 6) : path.basename(originalFilePath);
	}

	private saveHelmFile(tempFolder: string, originalFilePath: string, content: string): { tempFilePath: string; tempSubFolder: string } {
		const hash = this.generateFileHash(originalFilePath);
		const helmFolder = path.join(tempFolder, `helm-${hash}`);

		const relativePath = this.getHelmRelativePath(originalFilePath);

		const fullTargetPath = path.join(helmFolder, relativePath);
		const targetDir = path.dirname(fullTargetPath);
		if (!fs.existsSync(targetDir)) { fs.mkdirSync(targetDir, { recursive: true }); }
		fs.writeFileSync(fullTargetPath, content);
		return { tempFilePath: fullTargetPath, tempSubFolder: helmFolder };
	}

	public async scan(document: vscode.TextDocument, logs: Logs): Promise<void> {
		if (!this.shouldScanFile(document)) {
			return;
		}

		const filePath = await this.getFullPathWithOriginalCasing(document.uri);

		logs.info("Scanning Containers in file: " + filePath);

		const tempFolder = this.getTempSubFolderPath(document, constants.containersRealtimeScannerDirectory);

		let tempFilePath: string | undefined;
		let tempSubFolder: string | undefined;

		try {
			this.createTempFolder(tempFolder);

			const fileExtension = path.extname(filePath).toLowerCase();
			const isYamlFile = constants.containersHelmExtensions.includes(fileExtension);

			let saveResult: { tempFilePath: string; tempSubFolder: string };

			if (isYamlFile && !this.isDockerComposeFile(filePath)) {
				saveResult = this.saveHelmFile(tempFolder, filePath, document.getText());
			} else {
				saveResult = this.createSubFolderAndSaveFile(tempFolder, filePath, document.getText());
			}

			tempFilePath = saveResult.tempFilePath;
			tempSubFolder = saveResult.tempSubFolder;

			const ignoreManager = IgnoreFileManager.getInstance();
			ignoreManager.setScannedFilePath(filePath, tempFilePath);

			const unfiltered = await cx.scanContainers(tempFilePath, "");
			this.lastFullScanResults = unfiltered as CxContainerRealtimeResult[];

			const ignoredPackagesFile = ignoreManager.getIgnoredPackagesCount() > 0
				? ignoreManager.getIgnoredPackagesTempFile()
				: undefined;
			const scanResults = await cx.scanContainers(tempFilePath, ignoredPackagesFile || "");

			this.updateProblems(scanResults, document.uri, this.lastFullScanResults);
		} catch (error) {
			this.storeAndApplyResults(
				filePath,
				document.uri,
				[],
				[],
				[],
				[],
				[],
				[],
				[],
				[],
				[],
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

	updateProblems<T = unknown>(problems: T, uri: vscode.Uri, fullScanResults?: unknown[]): void {
		const scanResults = problems as CxContainerRealtimeResult[];
		const filePath = uri.fsPath;

		const diagnostics: vscode.Diagnostic[] = [];
		this.diagnosticCollection.delete(uri);

		const maliciousDecorations: vscode.DecorationOptions[] = [];
		const okDecorations: vscode.DecorationOptions[] = [];
		const unknownDecorations: vscode.DecorationOptions[] = [];
		const criticalDecorations: vscode.DecorationOptions[] = [];
		const highDecorations: vscode.DecorationOptions[] = [];
		const mediumDecorations: vscode.DecorationOptions[] = [];
		const lowDecorations: vscode.DecorationOptions[] = [];

		const maliciousIconDecorations: vscode.DecorationOptions[] = [];
		const criticalIconDecorations: vscode.DecorationOptions[] = [];
		const highIconDecorations: vscode.DecorationOptions[] = [];
		const mediumIconDecorations: vscode.DecorationOptions[] = [];
		const lowIconDecorations: vscode.DecorationOptions[] = [];

		for (const image of scanResults) {
			if (image.locations && Array.isArray(image.locations)) {
				for (let i = 0; i < image.locations.length; i++) {
					const location = image.locations[i];
					const range = new vscode.Range(
						new vscode.Position(location.line, location.startIndex),
						new vscode.Position(location.line, location.endIndex)
					);
					const addDiagnostic = i === 0;
					const highestSeverity = this.getHighestSeverity([image.status, this.exsistIacSeverityAtLine(uri, location.line)]);
					// Handle gutter decorations based on highest severity
					let gutterDecorations: vscode.DecorationOptions[];
					switch (highestSeverity) {
						case CxRealtimeEngineStatus.malicious:
							gutterDecorations = maliciousDecorations;
							break;
						case CxRealtimeEngineStatus.critical:
							gutterDecorations = criticalDecorations;
							break;
						case CxRealtimeEngineStatus.high:
							gutterDecorations = highDecorations;
							break;
						case CxRealtimeEngineStatus.medium:
							gutterDecorations = mediumDecorations;
							break;
						case CxRealtimeEngineStatus.low:
							gutterDecorations = lowDecorations;
							break;
						case CxRealtimeEngineStatus.ok:
							gutterDecorations = okDecorations;
							break;
						case CxRealtimeEngineStatus.unknown:
							gutterDecorations = unknownDecorations;
							break;
						default:
							gutterDecorations = unknownDecorations;
							break;
					}

					// Handle icon decorations and diagnostics based on image status
					switch (image.status) {
						case CxRealtimeEngineStatus.malicious:
							this.handleProblemStatus(
								diagnostics,
								gutterDecorations,
								this.containersHoverData,
								range,
								uri,
								image,
								vscode.DiagnosticSeverity.Error,
								"Malicious container image detected",
								addDiagnostic,
								maliciousIconDecorations
							);
							break;
						case CxRealtimeEngineStatus.ok:
							if (addDiagnostic) {
								gutterDecorations.push({ range });
							}
							break;
						case CxRealtimeEngineStatus.unknown:
							gutterDecorations.push({ range });
							break;
						case CxRealtimeEngineStatus.critical:
							this.handleProblemStatus(
								diagnostics,
								gutterDecorations,
								this.containersHoverData,
								range,
								uri,
								image,
								vscode.DiagnosticSeverity.Error,
								"Critical-risk container image",
								addDiagnostic,
								criticalIconDecorations
							);
							break;
						case CxRealtimeEngineStatus.high:
							this.handleProblemStatus(
								diagnostics,
								gutterDecorations,
								this.containersHoverData,
								range,
								uri,
								image,
								vscode.DiagnosticSeverity.Error,
								"High-risk container image",
								addDiagnostic,
								highIconDecorations
							);
							break;
						case CxRealtimeEngineStatus.medium:
							this.handleProblemStatus(
								diagnostics,
								gutterDecorations,
								this.containersHoverData,
								range,
								uri,
								image,
								vscode.DiagnosticSeverity.Error,
								"Medium-risk container image",
								addDiagnostic,
								mediumIconDecorations
							);
							break;
						case CxRealtimeEngineStatus.low:
							this.handleProblemStatus(
								diagnostics,
								gutterDecorations,
								this.containersHoverData,
								range,
								uri,
								image,
								vscode.DiagnosticSeverity.Error,
								"Low-risk container image",
								addDiagnostic,
								lowIconDecorations
							);
							break;
						default:
							continue;
					}
				}
			}

		}

		const ignoredDecorations: vscode.DecorationOptions[] = [];
		const ignoreManager = IgnoreFileManager.getInstance();
		const ignoredData = ignoreManager.getIgnoredPackagesData();
		const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);

		const allScanResults = (this.lastFullScanResults as CxContainerRealtimeResult[]) || scanResults;

		const activeLineNumbers = new Set<number>();
		scanResults.forEach(result => {
			if (result.locations) {
				result.locations.forEach(loc => activeLineNumbers.add(loc.line));
			}
		});

		const iacDiagnostics = vscode.languages.getDiagnostics(uri).filter(diagnostic => {
			const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
			return diagnosticData?.cxType === constants.iacRealtimeScannerEngineName;
		});

		Object.entries(ignoredData).forEach(([, entry]) => {
			if (entry.type !== constants.containersRealtimeScannerEngineName) { return; }
			const fileEntry = this.findActiveFileEntry(entry, relativePath);
			if (!fileEntry) { return; }

			const imageKey = `${entry.imageName}:${entry.imageTag}`;

			allScanResults.forEach(result => {
				const resultKey = `${result.imageName}:${result.imageTag}`;
				if (resultKey === imageKey && result.locations) {
					result.locations.forEach(location => {
						const hasActiveContainerFindings = activeLineNumbers.has(location.line);
						const hasActiveIacFindings = iacDiagnostics.some(diag => diag.range.start.line === location.line);

						if (!hasActiveContainerFindings && !hasActiveIacFindings) {
							const range = new vscode.Range(
								new vscode.Position(location.line, location.startIndex),
								new vscode.Position(location.line, location.endIndex)
							);
							ignoredDecorations.push({ range });

							const hoverKey = `${filePath}:${location.line}`;
							if (!this.containersHoverData.has(hoverKey)) {
								this.containersHoverData.set(hoverKey, {
									imageName: entry.imageName!,
									filePath: filePath,
									imageTag: entry.imageTag!,
									status: (entry.severity as CxRealtimeEngineStatus) || CxRealtimeEngineStatus.medium,
									vulnerabilities: [],
									location: {
										line: location.line,
										startIndex: location.startIndex,
										endIndex: location.endIndex
									},
									fileType: this.isDockerComposeFile(filePath)
										? 'docker-compose'
										: constants.containersHelmExtensions.includes(path.extname(filePath).toLowerCase())
											? 'helm'
											: 'dockerfile'
								});
							}
						}
					});
				}
			});
		});

		this.decorationsMap.ignored.set(filePath, ignoredDecorations);

		const hasContainerIgnores = Object.values(ignoredData).some(
			entry => entry.type === constants.containersRealtimeScannerEngineName
		);

		if (hasContainerIgnores && fullScanResults) {
			this.cleanupContainersIgnoredEntriesWithoutFileWatcher(fullScanResults, filePath, ignoreManager);
		}

		this.storeAndApplyResults(
			filePath,
			uri,
			diagnostics,
			maliciousDecorations,
			okDecorations,
			unknownDecorations,
			criticalDecorations,
			highDecorations,
			mediumDecorations,
			lowDecorations,
			ignoredDecorations,
			maliciousIconDecorations,
			criticalIconDecorations,
			highIconDecorations,
			mediumIconDecorations,
			lowIconDecorations
		);
	}

	private cleanupContainersIgnoredEntriesWithoutFileWatcher(
		fullScanResults: unknown[],
		currentFilePath: string,
		ignoreManager: IgnoreFileManager
	): void {
		ignoreManager.dispose();

		ignoreManager.removeMissingContainers(fullScanResults, currentFilePath);

		setTimeout(async () => {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				ignoreManager.initialize(workspaceFolder);
				ignoreManager.setContainersScannerService(this);
			}
		}, 100);
	}

	private exsistIacSeverityAtLine(uri: vscode.Uri, lineNumber: number): string | undefined {
		const iacCollection = this.getOtherScannerCollection(constants.iacRealtimeScannerEngineName);
		if (iacCollection) {
			const iacDiagnostics = vscode.languages.getDiagnostics(uri).filter(diagnostic => {
				const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
				return diagnosticData?.cxType === constants.iacRealtimeScannerEngineName;
			});
			const iacAtLine = iacDiagnostics.filter(diagnostic => diagnostic.range.start.line === lineNumber);
			if (iacAtLine[0]) {
				return ((iacAtLine[0] as vscode.Diagnostic & { data?: CxDiagnosticData }).data.item as IacHoverData).severity;
			}
			return undefined;
		}
	}

	private storeAndApplyResults(
		filePath: string,
		uri: vscode.Uri,
		diagnostics: vscode.Diagnostic[],
		maliciousDecorations: vscode.DecorationOptions[],
		okDecorations: vscode.DecorationOptions[],
		unknownDecorations: vscode.DecorationOptions[],
		criticalDecorations: vscode.DecorationOptions[],
		highDecorations: vscode.DecorationOptions[],
		mediumDecorations: vscode.DecorationOptions[],
		lowDecorations: vscode.DecorationOptions[],
		ignoredDecorations: vscode.DecorationOptions[],
		maliciousIconDecorations: vscode.DecorationOptions[],
		criticalIconDecorations: vscode.DecorationOptions[],
		highIconDecorations: vscode.DecorationOptions[],
		mediumIconDecorations: vscode.DecorationOptions[],
		lowIconDecorations: vscode.DecorationOptions[]
	): void {
		this.diagnosticsMap.set(filePath, diagnostics);

		this.decorationsMap.malicious.set(filePath, maliciousDecorations);
		this.decorationsMap.ok.set(filePath, okDecorations);
		this.decorationsMap.unknown.set(filePath, unknownDecorations);
		this.decorationsMap.critical.set(filePath, criticalDecorations);
		this.decorationsMap.high.set(filePath, highDecorations);
		this.decorationsMap.medium.set(filePath, mediumDecorations);
		this.decorationsMap.low.set(filePath, lowDecorations);

		this.decorationsMap.maliciousIcon.set(filePath, maliciousIconDecorations);
		this.decorationsMap.criticalIcon.set(filePath, criticalIconDecorations);
		this.decorationsMap.highIcon.set(filePath, highIconDecorations);
		this.decorationsMap.mediumIcon.set(filePath, mediumIconDecorations);
		this.decorationsMap.lowIcon.set(filePath, lowIconDecorations);

		this.applyDiagnostics();
		this.applyDecorations(uri);
	}

	private handleProblemStatus(
		diagnostics: vscode.Diagnostic[],
		decorations: vscode.DecorationOptions[],
		hoverMessages: Map<string, ContainersHoverData>,
		range: vscode.Range,
		uri: vscode.Uri,
		result: any,
		severity: vscode.DiagnosticSeverity,
		message: string,
		addDiagnostic: boolean,
		iconDecorations: vscode.DecorationOptions[]
	): void {
		decorations.push({ range });
		const fileType = this.isDockerComposeFile(uri.fsPath)
			? 'docker-compose'
			: constants.containersHelmExtensions.includes(path.extname(uri.fsPath).toLowerCase())
				? 'helm'
				: 'dockerfile';
		if (addDiagnostic) {
			const diagnosticMessage = `${message}: ${result.imageName}:${result.imageTag}`;

			const diagnostic = new vscode.Diagnostic(range, diagnosticMessage, severity);
			diagnostic.source = constants.getCxAi();
			(diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
				cxType: constants.containersRealtimeScannerEngineName,
				item: {
					imageName: result.imageName,
					imageTag: result.imageTag,
					status: result.status,
					filePath: uri.fsPath,
					vulnerabilities: result.vulnerabilities || [],
					location: {
						line: range.start.line,
						startIndex: range.start.character,
						endIndex: range.end.character
					},
					fileType
				}
			};
			diagnostics.push(diagnostic);
		} else {
			iconDecorations.push({ range });
		}

		const key = `${uri.fsPath}:${range.start.line}`;
		hoverMessages.set(key, {
			imageName: result.imageName,
			imageTag: result.imageTag,
			filePath: uri.fsPath,
			status: result.status,
			vulnerabilities: result.vulnerabilities || [],
			location: {
				line: range.start.line,
				startIndex: range.start.character,
				endIndex: range.end.character
			},
			fileType: fileType
		});
	}

	private applyDiagnostics(): void {
		this.diagnosticsMap.forEach((diagnostics, filePath) => {
			const vscodeUri = vscode.Uri.file(filePath);
			this.diagnosticCollection.set(vscodeUri, diagnostics);
		});
	}

	public async clearProblems(): Promise<void> {
		await super.clearProblems();
		this.diagnosticsMap.clear();
		this.containersHoverData.clear();
		Object.values(this.decorationsMap).forEach(map => map.clear());
	}


	public clearScanData(uri: vscode.Uri): void {
		const filePath = uri.fsPath;
		this.diagnosticsMap.delete(filePath);
		this.diagnosticCollection.delete(uri);
		this.containersHoverData.delete(filePath);
		Object.values(this.decorationsMap).forEach(map => map.delete(filePath));
	}

	private applyDecorations(uri: vscode.Uri): void {
		const filePath = uri.fsPath;
		const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
		if (!editor) { return; }
		const get = (key: keyof typeof this.decorationsMap) => this.decorationsMap[key].get(filePath) || [];
		const allUnderlineDecorations = [
			...get('maliciousIcon'),
			...get('criticalIcon'),
			...get('highIcon'),
			...get('mediumIcon'),
			...get('lowIcon'),
		];
		editor.setDecorations(this.decorationTypes.malicious, get('malicious'));
		editor.setDecorations(this.decorationTypes.ok, get('ok'));
		editor.setDecorations(this.decorationTypes.unknown, get('unknown'));
		editor.setDecorations(this.decorationTypes.critical, get('critical'));
		editor.setDecorations(this.decorationTypes.high, get('high'));
		editor.setDecorations(this.decorationTypes.medium, get('medium'));
		editor.setDecorations(this.decorationTypes.low, get('low'));
		editor.setDecorations(this.decorationTypes.ignored, get('ignored'));
		editor.setDecorations(this.decorationTypes.underline, allUnderlineDecorations);
	}

	getHoverData(): Map<string, ContainersHoverData> {
		return this.containersHoverData;
	}

	getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
		return this.diagnosticsMap;
	}

	public hasAnySeverityDecorations(): boolean {
		return [
			'malicious', 'ok', 'unknown', 'critical', 'high', 'medium', 'low'
		].some(key => this.decorationsMap[key as keyof typeof this.decorationsMap].size > 0);
	}

	public hasAnyDecorationsAtLine(uri: vscode.Uri, lineNumber: number): boolean {
		const filePath = uri.fsPath;
		const severityKeys = [
			...Object.values(CxRealtimeEngineStatus).map(s => s.toLowerCase()),
			'ignored'
		] as const;
		return severityKeys.some(key => {
			const decorations = this.decorationsMap[key as keyof typeof this.decorationsMap].get(filePath) || [];
			return decorations.some(decoration => decoration.range.start.line === lineNumber);
		});
	}

	private removeGutterAtLine(filePath: string, lineNumber: number): void {
		Object.values(this.decorationsMap).forEach(map => {
			const decorations = map.get(filePath) || [];
			map.set(filePath, decorations.filter(decoration => decoration.range.start.line !== lineNumber));
		});
	}

	private getAnyRangeAtLine(filePath: string, lineNumber: number): vscode.Range | undefined {
		const severityKeys = [
			...Object.values(CxRealtimeEngineStatus).map(s => s.toLowerCase()),
			'ignored'
		] as const;
		for (const key of severityKeys) {
			const decorations = this.decorationsMap[key].get(filePath) || [];
			const decoration = decorations.find(d => d.range.start.line === lineNumber);
			if (decoration) { return decoration.range; }
		}
		return new vscode.Range(
			new vscode.Position(lineNumber, 0),
			new vscode.Position(lineNumber, 1)
		);
	}

	private pushGutter(filePath: string, severity: string, range: vscode.Range): void {
		const decoration = { range };
		const sev = severity.toLowerCase();
		const mapKey =
			sev === CxRealtimeEngineStatus.malicious.toLowerCase() ? CxRealtimeEngineStatus.malicious.toLowerCase() :
				sev === CxRealtimeEngineStatus.critical.toLowerCase() ? CxRealtimeEngineStatus.critical.toLowerCase() :
					sev === CxRealtimeEngineStatus.high.toLowerCase() ? CxRealtimeEngineStatus.high.toLowerCase() :
						sev === CxRealtimeEngineStatus.medium.toLowerCase() ? CxRealtimeEngineStatus.medium.toLowerCase() :
							sev === CxRealtimeEngineStatus.low.toLowerCase() ? CxRealtimeEngineStatus.low.toLowerCase() :
								sev === CxRealtimeEngineStatus.ok.toLowerCase() ? CxRealtimeEngineStatus.ok.toLowerCase() :
									sev === CxRealtimeEngineStatus.unknown.toLowerCase() ? CxRealtimeEngineStatus.unknown.toLowerCase() :
										sev === 'ignored' ? 'ignored' : CxRealtimeEngineStatus.unknown.toLowerCase();
		const map = this.decorationsMap[mapKey as keyof typeof this.decorationsMap];
		const arr = map.get(filePath) || [];
		arr.push(decoration);
		map.set(filePath, arr);
	}



	public recomputeGutterForLine(uri: vscode.Uri, lineNumber: number): void {
		const filePath = uri.fsPath;

		this.removeGutterAtLine(filePath, lineNumber);

		const range = this.getAnyRangeAtLine(filePath, lineNumber);
		if (!range) {
			return;
		}

		const containersSeverity = this.getContainersSeverityFromScanResults(uri, lineNumber);

		const iacSeverity = this.exsistIacSeverityAtLine(uri, lineNumber);

		let finalSeverity: string | undefined;
		if (containersSeverity && iacSeverity) {
			finalSeverity = this.getHighestSeverity([containersSeverity, iacSeverity]);
		} else if (containersSeverity) {
			finalSeverity = containersSeverity;
		} else if (iacSeverity) {
			finalSeverity = iacSeverity;
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

	private getContainersSeverityFromScanResults(uri: vscode.Uri, lineNumber: number): string | undefined {
		if (!this.lastFullScanResults || this.lastFullScanResults.length === 0) {
			return undefined;
		}

		const filePath = uri.fsPath;
		const ignoreManager = IgnoreFileManager.getInstance();
		const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);

		for (const result of this.lastFullScanResults) {
			const containerResult = result as any;
			if (containerResult.locations && Array.isArray(containerResult.locations)) {
				for (const location of containerResult.locations) {
					if (location.line === lineNumber) {
						const isIgnored = this.isContainerResultIgnored(containerResult, filePath, ignoreManager, relativePath);
						if (!isIgnored) {
							return containerResult.status;
						}
					}
				}
			}
		}

		return undefined;
	}

	private isContainerResultIgnored(result: any, filePath: string, ignoreManager: IgnoreFileManager, relativePath: string): boolean {
		const ignoredData = ignoreManager.getIgnoredPackagesData();

		if (!result.imageName || !result.imageTag) {
			return false;
		}

		const imageKey = `${result.imageName}:${result.imageTag}`;

		const ignoredEntry = Object.values(ignoredData).find(entry => {
			if (entry.type !== constants.containersRealtimeScannerEngineName) {
				return false;
			}
			const entryImageKey = `${entry.imageName}:${entry.imageTag}`;
			return entryImageKey === imageKey;
		});

		if (!ignoredEntry) {
			return false;
		}

		const fileEntry = ignoredEntry.files.find(f =>
			f.path === relativePath && f.active
		);

		return !!fileEntry;
	}
}
