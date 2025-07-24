/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig, CxDiagnosticData, ContainersHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxContainerRealtimeResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/containersRealtime/CxContainerRealtime";
import path from "path";
import { cx } from "../../../cx";
import fs from "fs";
import { minimatch } from "minimatch";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/containersRealtime/CxRealtimeEngineStatus";

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

	private currentTempFileNmae: string | undefined;
	private currentTempSubFolder: string | undefined;

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

		for (const [entryName, _type] of entries) {
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

	private saveDockerFile(
		tempFolder: string,
		originalFilePath: string,
		content: string
	): string {
		const originalFileName = path.basename(originalFilePath);

		const hash = this.generateFileHash(originalFilePath);
		const dockerFolder = path.join(tempFolder, `${originalFileName}-${hash}`);
		if (!fs.existsSync(dockerFolder)) {
			fs.mkdirSync(dockerFolder, { recursive: true });
		}

		this.currentTempSubFolder = dockerFolder;

		const tempFilePath = path.join(dockerFolder, originalFileName);
		fs.writeFileSync(tempFilePath, content);
		return tempFilePath;
	}

	private saveDockerComposeFile(
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
	): string {
		const hash = this.generateFileHash(originalFilePath);
		const helmFolder = path.join(tempFolder, `helm-${hash}`);

		const relativePath = this.getHelmRelativePath(originalFilePath);

		const fullTargetPath = path.join(helmFolder, relativePath);
		const targetDir = path.dirname(fullTargetPath);

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		this.currentTempSubFolder = helmFolder;

		fs.writeFileSync(fullTargetPath, content);
		return fullTargetPath;
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

		try {
			this.createTempFolder(tempFolder);

			const fileExtension = path.extname(filePath).toLowerCase();
			const isYamlFile = constants.containersHelmExtensions.includes(fileExtension);

			if (isYamlFile) {
				if (this.isDockerComposeFile(filePath)) {
					tempFilePath = this.saveDockerComposeFile(tempFolder, filePath, document.getText());
				} else {
					tempFilePath = this.saveHelmFile(tempFolder, filePath, document.getText());
				}
			} else {
				tempFilePath = this.saveDockerFile(tempFolder, filePath, document.getText());
			}

			const scanResults = await cx.scanContainers(tempFilePath);

			this.currentTempFileNmae = tempFilePath ? path.basename(tempFilePath) : undefined;
			this.updateProblems(scanResults, document.uri);
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
				[]
			)
			console.error(error);
			logs.error(this.config.errorMessage + `: ${error.message}`);
		} finally {
			this.currentTempFileNmae = undefined;
			this.deleteTempFile(tempFilePath);
			if (this.currentTempSubFolder) {
				this.deleteTempFolder(this.currentTempSubFolder);
			}
			this.currentTempSubFolder = undefined;
		}
	}

	updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void {
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
			// Filter results because the containers scanner scans all the files in the folder
			if (image.filepath && this.currentTempFileNmae && image.filepath !== this.currentTempFileNmae && image.filepath.replace(/\\/g, "/") !== this.getHelmRelativePath(uri.fsPath)) {
				continue;
			}

			if (image.locations && Array.isArray(image.locations)) {
				for (let i = 0; i < image.locations.length; i++) {
					const location = image.locations[i];
					const range = new vscode.Range(
						new vscode.Position(location.line, location.startIndex),
						new vscode.Position(location.line, location.endIndex)
					);
					const addDiagnostic = i === 0;

					switch (image.status) {
						case CxRealtimeEngineStatus.malicious:
							this.handleProblemStatus(
								diagnostics,
								maliciousDecorations,
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
								okDecorations.push({ range });
							}
							break;
						case CxRealtimeEngineStatus.unknown:
							unknownDecorations.push({ range });
							break;
						case CxRealtimeEngineStatus.critical:
							this.handleProblemStatus(
								diagnostics,
								criticalDecorations,
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
								highDecorations,
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
								mediumDecorations,
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
								lowDecorations,
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
			maliciousIconDecorations,
			criticalIconDecorations,
			highIconDecorations,
			mediumIconDecorations,
			lowIconDecorations
		);
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
