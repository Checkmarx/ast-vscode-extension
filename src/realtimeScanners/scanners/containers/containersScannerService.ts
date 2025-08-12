/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData, ContainersHoverData, IacHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxContainerRealtimeResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/containersRealtime/CxContainerRealtime";
import path from "path";
import { cx } from "../../../cx";
import fs from "fs";
import { minimatch } from "minimatch";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/containersRealtime/CxRealtimeEngineStatus";
import { createHash } from "crypto";
import { IgnoreFileManager } from "../../common/ignoreFileManager";

export class ContainersScannerService extends BaseScannerService {
	private diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
	private containersHoverData = new Map<string, ContainersHoverData>();
	private maliciousDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private okDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private unknownDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private criticalDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private highDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private mediumDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private lowDecorationsMap = new Map<string, vscode.DecorationOptions[]>();

	private maliciousIconDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private criticalIconDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private highIconDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private mediumIconDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private lowIconDecorationsMap = new Map<string, vscode.DecorationOptions[]>();
	private ignoredDecorations: Map<string, vscode.DecorationOptions[]> = new Map();
	private lastFullScanResults: unknown[] = [];

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
			engineName: constants.containersRealtimeScannerEngineName,
			configSection: constants.containersRealtimeScanner,
			activateKey: constants.activateContainersRealtimeScanner,
			enabledMessage: constants.containersRealtimeScannerStart,
			disabledMessage: constants.containersRealtimeScannerDisabled,
			errorMessage: constants.errorContainersScanRealtime
		};
		super(config);
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
		const fileName = path.basename(filePath).toLowerCase();

		if (fileName.includes('docker-compose')) {
			return true;
		}
		return false;
	}

	shouldScanFile(document: vscode.TextDocument): boolean {
		if (!super.shouldScanFile(document)) {
			return false;
		}

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
			if (constants.containersHelmExcludedFiles.includes(fileName)) {
				return false;
			}

			const isInHelmFolder = normalizedPath.toLowerCase().includes("/helm/") ||
				normalizedPath.toLowerCase().includes("\\helm\\");
			return isInHelmFolder;
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
		const dockerFolder = path.join(tempFolder, `${originalFileName}-${hash}`);
		if (!fs.existsSync(dockerFolder)) {
			fs.mkdirSync(dockerFolder, { recursive: true });
		}

		const tempFilePath = path.join(dockerFolder, originalFileName);
		fs.writeFileSync(tempFilePath, content);
		return { tempFilePath, tempSubFolder: dockerFolder };
	}

	private getHelmRelativePath(originalFilePath: string): string {
		const normalizedPath = originalFilePath.replace(/\\/g, "/");
		const helmIndex = normalizedPath.toLowerCase().lastIndexOf("/helm/");

		if (helmIndex !== -1) {
			return normalizedPath.substring(helmIndex + 6);
		} else {
			return path.basename(originalFilePath);
		}
	}

	private saveHelmFile(
		tempFolder: string,
		originalFilePath: string,
		content: string
	): { tempFilePath: string; tempSubFolder: string } {
		const hash = this.generateFileHash(originalFilePath);
		const helmFolder = path.join(tempFolder, `helm-${hash}`);

		const relativePath = this.getHelmRelativePath(originalFilePath);

		const fullTargetPath = path.join(helmFolder, relativePath);
		const targetDir = path.dirname(fullTargetPath);

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		fs.writeFileSync(fullTargetPath, content);
		return { tempFilePath: fullTargetPath, tempSubFolder: helmFolder };
	}

	public async scan(document: vscode.TextDocument, logs: Logs): Promise<void> {
		if (!this.shouldScanFile(document)) {
			return;
		}

		// Use the method to take care of in DockerFiles
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

			const ignoredPackagesFile = ignoreManager.getIgnoredPackagesTempFile();
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
				[],

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

		Object.entries(ignoredData).forEach(([, entry]) => {
			if (entry.type !== constants.containersRealtimeScannerEngineName) { return; }
			const fileEntry = entry.files.find(f => f.path === relativePath && f.active);
			if (!fileEntry) { return; }

			const imageKey = `${entry.imageName}:${entry.imageTag}`;

			allScanResults.forEach(result => {
				const resultKey = `${result.imageName}:${result.imageTag}`;
				if (resultKey === imageKey && result.locations) {
					result.locations.forEach(location => {
						const range = new vscode.Range(
							new vscode.Position(location.line, location.startIndex),
							new vscode.Position(location.line, location.endIndex)
						);
						ignoredDecorations.push({ range });

						const hoverKey = `${filePath}:${location.line}`;
						if (!this.containersHoverData.has(hoverKey)) {
							this.containersHoverData.set(hoverKey, {
								imageName: entry.imageName!,
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
					});
				}
			});
		});

		this.ignoredDecorations.set(filePath, ignoredDecorations);

		// Cleanup ignored entries if we have fullScanResults
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
		// Dispose the file watcher to avoid conflicts
		ignoreManager.dispose();

		// Perform the cleanup
		ignoreManager.removeMissingContainers(fullScanResults, currentFilePath);

		// Re-initialize the file watcher after a short delay
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
		this.maliciousDecorationsMap.set(filePath, maliciousDecorations);
		this.okDecorationsMap.set(filePath, okDecorations);
		this.unknownDecorationsMap.set(filePath, unknownDecorations);
		this.criticalDecorationsMap.set(filePath, criticalDecorations);
		this.highDecorationsMap.set(filePath, highDecorations);
		this.mediumDecorationsMap.set(filePath, mediumDecorations);
		this.lowDecorationsMap.set(filePath, lowDecorations);

		this.maliciousIconDecorationsMap.set(filePath, maliciousIconDecorations);
		this.criticalIconDecorationsMap.set(filePath, criticalIconDecorations);
		this.highIconDecorationsMap.set(filePath, highIconDecorations);
		this.mediumIconDecorationsMap.set(filePath, mediumIconDecorations);
		this.lowIconDecorationsMap.set(filePath, lowIconDecorations);

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
			diagnostic.source = constants.cxAi;
			(diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
				cxType: constants.containersRealtimeScannerEngineName,
				item: {
					imageName: result.imageName,
					imageTag: result.imageTag,
					status: result.status,
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
		this.maliciousDecorationsMap.clear();
		this.okDecorationsMap.clear();
		this.unknownDecorationsMap.clear();
		this.criticalDecorationsMap.clear();
		this.highDecorationsMap.clear();
		this.mediumDecorationsMap.clear();
		this.lowDecorationsMap.clear();
		this.maliciousIconDecorationsMap.clear();
		this.criticalIconDecorationsMap.clear();
		this.highIconDecorationsMap.clear();
		this.mediumIconDecorationsMap.clear();
		this.lowIconDecorationsMap.clear();
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
		this.containersHoverData.delete(filePath);
		this.maliciousDecorationsMap.delete(filePath);
		this.okDecorationsMap.delete(filePath);
		this.unknownDecorationsMap.delete(filePath);
		this.criticalDecorationsMap.delete(filePath);
		this.highDecorationsMap.delete(filePath);
		this.mediumDecorationsMap.delete(filePath);
		this.lowDecorationsMap.delete(filePath);
		this.maliciousIconDecorationsMap.delete(filePath);
		this.criticalIconDecorationsMap.delete(filePath);
		this.highIconDecorationsMap.delete(filePath);
		this.mediumIconDecorationsMap.delete(filePath);
		this.lowIconDecorationsMap.delete(filePath);
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
		const filePath = uri.fsPath;
		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === uri.toString()
		);

		if (editor) {
			const maliciousDecorations = this.maliciousDecorationsMap.get(filePath) || [];
			const okDecorations = this.okDecorationsMap.get(filePath) || [];
			const unknownDecorations = this.unknownDecorationsMap.get(filePath) || [];
			const criticalDecorations = this.criticalDecorationsMap.get(filePath) || [];
			const highDecorations = this.highDecorationsMap.get(filePath) || [];
			const mediumDecorations = this.mediumDecorationsMap.get(filePath) || [];
			const lowDecorations = this.lowDecorationsMap.get(filePath) || [];

			const maliciousIcons = this.maliciousIconDecorationsMap.get(filePath) || [];
			const criticalIcons = this.criticalIconDecorationsMap.get(filePath) || [];
			const highIcons = this.highIconDecorationsMap.get(filePath) || [];
			const mediumIcons = this.mediumIconDecorationsMap.get(filePath) || [];
			const lowIcons = this.lowIconDecorationsMap.get(filePath) || [];

			const allUnderlineDecorations = [
				...maliciousIcons,
				...criticalIcons,
				...highIcons,
				...mediumIcons,
				...lowIcons,
			];

			editor.setDecorations(this.decorationTypes.malicious, maliciousDecorations);
			editor.setDecorations(this.decorationTypes.ok, okDecorations);
			editor.setDecorations(this.decorationTypes.unknown, unknownDecorations);
			editor.setDecorations(this.decorationTypes.critical, criticalDecorations);
			editor.setDecorations(this.decorationTypes.high, highDecorations);
			editor.setDecorations(this.decorationTypes.medium, mediumDecorations);
			editor.setDecorations(this.decorationTypes.low, lowDecorations);
			editor.setDecorations(this.decorationTypes.ignored, this.ignoredDecorations.get(filePath) || []);
			editor.setDecorations(this.decorationTypes.underline, allUnderlineDecorations);
		}
	}

	getHoverData(): Map<string, ContainersHoverData> {
		return this.containersHoverData;
	}

	getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
		return this.diagnosticsMap;
	}
}
