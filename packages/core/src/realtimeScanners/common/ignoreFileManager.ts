
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OssScannerService } from '../scanners/oss/ossScannerService';
import { SecretsScannerService } from '../scanners/secrets/secretsScannerService';
import { Logs } from '../../models/logs';
import { constants } from '../../utils/common/constants';
import CxSecretsResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/secrets/CxSecrets";
import CxIacResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/iacRealtime/CxIac";
import { IacScannerService } from '../scanners/iac/iacScannerService';
import { AscaScannerService } from '../scanners/asca/ascaScannerService';
import { ContainersScannerService } from '../scanners/containers/containersScannerService';
import { getExtensionType } from '../../config/extensionConfig';
export interface IgnoreEntry {
	files: Array<{
		path: string;
		active: boolean;
		line?: number;
	}>;
	secretValue?: string;
	similarityId?: string;
	ruleId?: number;
	imageName?: string;
	imageTag?: string;
	type: string;
	PackageManager?: string;
	PackageName: string;
	PackageVersion?: string;
	severity?: string;
	description?: string;
	dateAdded?: string;
}

export class IgnoreFileManager {
	private static instance: IgnoreFileManager;
	private workspacePath: string = '';
	private workspaceRootPath: string = '';
	private ignoreData: Record<string, IgnoreEntry> = {};
	private scannedFileMap: Map<string, string> = new Map();

	private fileWatcher: fs.FSWatcher | undefined;
	private previousIgnoreData: Record<string, IgnoreEntry> = {};
	private ossScannerService: OssScannerService | undefined;
	private secretsScannerService: SecretsScannerService | undefined;
	private iacScannerService: IacScannerService | undefined;
	private ascaScannerService: AscaScannerService | undefined;
	private containersScannerService: ContainersScannerService | undefined;
	private statusBarUpdateCallback: (() => void) | undefined;
	private uiRefreshCallback: (() => void) | undefined;

	private normalizePath(filePath: string): string {
		return path.relative(this.workspaceRootPath, filePath).replace(/\\/g, '/');
	}

	private constructor() { }

	public static getInstance(): IgnoreFileManager {
		if (!IgnoreFileManager.instance) {
			IgnoreFileManager.instance = new IgnoreFileManager();
		}
		return IgnoreFileManager.instance;
	}

	public setScannedFilePath(originalPath: string, scannedTempPath: string): void {
		this.scannedFileMap.set(path.resolve(originalPath), scannedTempPath);
	}

	public initialize(workspaceFolder: vscode.WorkspaceFolder): void {
		this.workspacePath = path.join(workspaceFolder.uri.fsPath, '.vscode');
		this.workspaceRootPath = workspaceFolder.uri.fsPath;
		this.ensureIgnoreFileExists();
		this.loadIgnoreData();

		this.previousIgnoreData = JSON.parse(JSON.stringify(this.ignoreData));
		this.startFileWatcher();
	}

	public setOssScannerService(service: OssScannerService): void {
		this.ossScannerService = service;
	}

	public setSecretsScannerService(service: SecretsScannerService): void {
		this.secretsScannerService = service;
	}


	public setIacScannerService(service: IacScannerService): void {
		this.iacScannerService = service;
	}

	public setAscaScannerService(service: AscaScannerService): void {
		this.ascaScannerService = service;
	}

	public setContainersScannerService(service: ContainersScannerService): void {
		this.containersScannerService = service;
	}

	public setStatusBarUpdateCallback(callback: () => void): void {
		this.statusBarUpdateCallback = callback;
	}

	public setUiRefreshCallback(callback: () => void): void {
		this.uiRefreshCallback = callback;
	}

	public updateStatusBar(): void {
		this.loadIgnoreData();
		if (this.statusBarUpdateCallback) {
			this.statusBarUpdateCallback();
		}
	}

	private startFileWatcher(): void {
		this.stopFileWatcher();

		const ignoreFilePath = this.getIgnoreFilePath();
		if (fs.existsSync(ignoreFilePath)) {
			this.fileWatcher = fs.watch(ignoreFilePath, async (eventType) => {
				if (eventType === 'change') {
					await this.handleFileChange();
				}
			});
		}
	}

	private stopFileWatcher(): void {
		if (this.fileWatcher) {
			this.fileWatcher.close();
			this.fileWatcher = undefined;
		}
	}

	private async handleFileChange(): Promise<void> {
		this.loadIgnoreData();

		await this.detectAndHandleActiveChanges();

		this.previousIgnoreData = JSON.parse(JSON.stringify(this.ignoreData));
	}

	private async detectAndHandleActiveChanges(): Promise<void> {
		if (!this.ossScannerService && !this.secretsScannerService && !this.iacScannerService && !this.ascaScannerService && !this.containersScannerService) {
			return;
		}

		const previousActiveFiles = this.getActiveFilesList(this.previousIgnoreData);
		const currentActiveFiles = this.getActiveFilesList(this.ignoreData);



		const deactivatedFiles = previousActiveFiles.filter(prevFile =>
			!currentActiveFiles.some(currFile =>
				currFile.packageKey === prevFile.packageKey && currFile.path === prevFile.path
			)
		);


		if (deactivatedFiles.length > 0) {
			deactivatedFiles.forEach(file => {
				this.removeIgnoredEntryWithoutTempUpdate(file.packageKey, file.path);
			});

			this.updateTempList();

			const affectedFilePaths = [...new Set(deactivatedFiles.map(file => file.path))];
			for (const filePath of affectedFilePaths) {
				await this.rescanFile(filePath);
			}

		}
	}

	public async triggerActiveChangesDetection(): Promise<void> {
		await this.detectAndHandleActiveChanges();
		this.previousIgnoreData = JSON.parse(JSON.stringify(this.ignoreData));

		this.loadIgnoreData();
		if (this.statusBarUpdateCallback) {
			this.statusBarUpdateCallback();
		}
	}

	public cleanupObsoletePackagesForFile(filePath: string, scanResults: Array<{ packageName: string; version: string }>): boolean {
		try {
			const relativePath = this.normalizePath(filePath);

			const currentPackages = new Set<string>();
			for (const result of scanResults) {
				const packageKey = `${result.packageName}:${result.version}`;
				currentPackages.add(packageKey);
			}

			const packagesToDeactivate: string[] = [];

			for (const packageKey in this.ignoreData) {
				const entry = this.ignoreData[packageKey];
				const fileEntry = entry.files.find(f => f.path === relativePath && f.active);

				if (fileEntry && !currentPackages.has(packageKey)) {
					packagesToDeactivate.push(packageKey);
				}
			}

			if (packagesToDeactivate.length > 0) {
				for (const packageKey of packagesToDeactivate) {
					const entry = this.ignoreData[packageKey];
					const fileEntry = entry.files.find(f => f.path === relativePath);
					if (fileEntry) {
						fileEntry.active = false;
					}
				}

				this.saveIgnoreFile();
				this.updateTempList();
				return true;
			}

			return false;

		} catch (error) {
			console.error(`[ManifestChange] Error cleaning up obsolete packages:`, error);
			return false;
		}
	}



	private getActiveFilesList(ignoreData: Record<string, IgnoreEntry>): Array<{ packageKey: string, path: string }> {
		const activeFiles: Array<{ packageKey: string, path: string }> = [];

		for (const packageKey in ignoreData) {
			const entry = ignoreData[packageKey];
			entry.files
				.filter(file => file.active)
				.forEach(file => {
					activeFiles.push({ packageKey, path: file.path });
				});
		}

		return activeFiles;
	}



	private removeIgnoredEntry(packageKey: string, filePath: string): void {
		if (!this.ignoreData[packageKey]) {
			return;
		}

		const entry = this.ignoreData[packageKey];

		entry.files = entry.files.filter(file => file.path !== filePath);

		if (entry.files.length === 0) {
			delete this.ignoreData[packageKey];
		}

		this.saveIgnoreFile();
		this.updateTempList();

		if (this.uiRefreshCallback) {
			this.uiRefreshCallback();
		}
	}

	private removeIgnoredEntryWithoutTempUpdate(packageKey: string, filePath: string): void {
		if (!this.ignoreData[packageKey]) {
			return;
		}

		const entry = this.ignoreData[packageKey];


		entry.files = entry.files.filter(file => file.path !== filePath);


		if (entry.files.length === 0) {
			delete this.ignoreData[packageKey];
		}

		this.saveIgnoreFile();

		if (this.uiRefreshCallback) {
			this.uiRefreshCallback();
		}
	}

	private async rescanFile(relativePath: string): Promise<void> {
		const fullPath = path.resolve(this.workspaceRootPath, relativePath);

		try {
			let document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === fullPath);

			if (!document) {
				document = await vscode.workspace.openTextDocument(fullPath);
			}

			const logs = {
				info: (msg: string) => console.log('[INFO]', msg),
				error: (msg: string) => console.error('[ERROR]', msg)
			} as Logs;

			if (this.ossScannerService && this.ossScannerService.shouldScanFile(document)) {
				await this.ossScannerService.scan(document, logs);
			}
			if (this.secretsScannerService && this.secretsScannerService.shouldScanFile(document)) {
				await this.secretsScannerService.scan(document, logs);
			}
			if (this.iacScannerService && this.iacScannerService.shouldScanFile(document)) {
				await this.iacScannerService.scan(document, logs);
			}
			if (this.ascaScannerService && this.ascaScannerService.shouldScanFile(document)) {
				await this.ascaScannerService.scan(document, logs);
			}
			if (this.containersScannerService && this.containersScannerService.shouldScanFile(document)) {
				await this.containersScannerService.scan(document, logs);
			}
		} catch (error) {
			console.error(`Error rescanning file ${fullPath}:`, error);
		}
	}

	public dispose(): void {
		this.stopFileWatcher();
	}



	private ensureIgnoreFileExists() {
		if (!fs.existsSync(this.workspacePath)) {
			fs.mkdirSync(this.workspacePath, { recursive: true });
		}
		const ignoreFilePath = this.getIgnoreFilePath();
		if (!fs.existsSync(ignoreFilePath)) {
			fs.writeFileSync(ignoreFilePath, JSON.stringify({}, null, 2));
		}
	}

	private loadIgnoreData() {
		try {
			const data = fs.readFileSync(this.getIgnoreFilePath(), 'utf-8');
			this.ignoreData = JSON.parse(data);
		} catch {
			this.ignoreData = {};
		}
	}

	private getIgnoreFilePath(): string {
		const extensionType = getExtensionType();
		const fileName = extensionType === 'checkmarx' ? '.checkmarxIgnored' : '.checkmarxDevAssistIgnored';
		return path.join(this.workspacePath, fileName);
	}

	private getTempListPath(): string {
		const extensionType = getExtensionType();
		const fileName = extensionType === 'checkmarx' ? '.checkmarxIgnoredTempList.json' : '.checkmarxDevAssistIgnoredTempList.json';
		return path.join(this.workspacePath, fileName);
	}

	public getIgnoredPackagesTempFile(): string | undefined {
		const tempListPath = this.getTempListPath();
		if (fs.existsSync(tempListPath)) {
			return tempListPath;
		}
		return undefined;
	}

	public getIgnoredPackagesCount(): number {
		if (!fs.existsSync(this.getIgnoreFilePath())) {
			return 0;
		}
		return Object.keys(this.ignoreData).length;
	}

	public hasIgnoreFile(): boolean {
		return fs.existsSync(this.getIgnoreFilePath());
	}

	public getIgnoredPackagesData(): Record<string, IgnoreEntry> {
		return this.ignoreData;
	}

	public revivePackage(packageKey: string): boolean {
		if (!this.ignoreData[packageKey]) {
			return false;
		}

		this.ignoreData[packageKey].files.forEach(file => {
			file.active = false;
		});

		this.saveIgnoreFile();

		this.updateTempList();

		return true;
	}

	public updatePackageLineNumber(packageKey: string, filePath: string, newLineNumber: number): boolean {
		if (!this.ignoreData[packageKey]) {
			return false;
		}

		const relativePath = this.normalizePath(filePath);
		const entry = this.ignoreData[packageKey];
		const fileEntry = entry.files.find(f => f.path === relativePath && f.active);

		if (fileEntry) {
			fileEntry.line = newLineNumber;

			this.saveIgnoreFile();
			this.updateTempList();

			if (this.uiRefreshCallback) {
				this.uiRefreshCallback();
			}

			return true;
		}

		return false;
	}

	public updateSecretLineNumber(packageKey: string, filePath: string, newLineNumber: number): boolean {
		if (!this.ignoreData[packageKey]) {
			return false;
		}

		const relativePath = this.normalizePath(filePath);
		const entry = this.ignoreData[packageKey];
		const fileEntry = entry.files.find(f => f.path === relativePath && f.active);

		if (fileEntry) {
			fileEntry.line = newLineNumber;

			this.saveIgnoreFile();
			this.updateTempList();

			if (this.uiRefreshCallback) {
				this.uiRefreshCallback();
			}

			return true;
		}

		return false;
	}

	public removePackageEntry(packageKey: string, filePath: string): boolean {
		this.removeIgnoredEntry(packageKey, filePath);
		return true;
	}

	public addIgnoredEntry(entry: {
		packageManager: string;
		packageName: string;
		packageVersion: string;
		filePath: string;
		line?: number;
		severity?: string;
		description?: string;
		dateAdded?: string;
	}): void {
		const countBefore = this.getIgnoredPackagesCount();

		const packageKey = `${entry.packageManager}:${entry.packageName}:${entry.packageVersion}`;
		const relativePath = this.normalizePath(entry.filePath);

		if (!this.ignoreData[packageKey]) {
			this.ignoreData[packageKey] = {
				files: [],
				type: constants.ossRealtimeScannerEngineName,
				PackageManager: entry.packageManager,
				PackageName: entry.packageName,
				PackageVersion: entry.packageVersion,
				severity: entry.severity,
				description: entry.description,
				dateAdded: entry.dateAdded
			};
		} else {
			if (entry.severity !== undefined) {
				this.ignoreData[packageKey].severity = entry.severity;
			}
			if (entry.description !== undefined) {
				this.ignoreData[packageKey].description = entry.description;
			}
		}

		const existing = this.ignoreData[packageKey].files.find(f => f.path === relativePath && f.line === entry.line);
		if (!existing) {
			this.ignoreData[packageKey].files.push({
				path: relativePath,
				active: true,
				line: entry.line
			});
		} else {
			existing.active = true;
			existing.line = entry.line;
		}

		this.saveIgnoreFile();
		this.updateTempList();
		this.uiRefreshCallback?.();
		const countAfter = this.getIgnoredPackagesCount();
		if (countBefore === 0 && countAfter > 0 && this.uiRefreshCallback) {
			this.uiRefreshCallback();
		}
	}

	public addIgnoredEntrySecrets(entry: {
		title: string;
		description: string;
		severity: string;
		dateAdded: string;
		line: number;
		secretValue: string;
		filePath: string;
	}): void {
		const relativePath = this.normalizePath(entry.filePath);
		const packageKey = `${entry.title}:${entry.secretValue}:${relativePath}`;

		if (!this.ignoreData[packageKey]) {
			this.ignoreData[packageKey] = {
				files: [{
					path: relativePath,
					active: true,
					line: entry.line + 1
				}],
				type: constants.secretsScannerEngineName,
				PackageName: entry.title,
				severity: entry.severity,
				description: entry.description,
				dateAdded: entry.dateAdded,
				secretValue: entry.secretValue
			};
		} else {
			const existingFileEntry = this.ignoreData[packageKey].files.find(f => f.path === relativePath);
			if (existingFileEntry) {
				existingFileEntry.active = true;
			} else {
				this.ignoreData[packageKey].files.push({
					path: relativePath,
					active: true,
					line: this.ignoreData[packageKey].files[0]?.line || (entry.line + 1)
				});
			}

			if (entry.severity !== undefined) { this.ignoreData[packageKey].severity = entry.severity; }
			if (entry.description !== undefined) { this.ignoreData[packageKey].description = entry.description; }
			if (entry.secretValue !== undefined) { this.ignoreData[packageKey].secretValue = entry.secretValue; }
		}

		this.saveIgnoreFile();
		this.updateTempList();
		this.uiRefreshCallback?.();
	}

	public addIgnoredEntryIac(entry: {
		title: string;
		similarityId: string;
		filePath: string;
		line: number;
		severity?: string;
		description?: string;
		dateAdded?: string;
	}): void {
		const relativePath = this.normalizePath(entry.filePath);
		const packageKey = `${entry.title}:${entry.similarityId}:${relativePath}`;

		if (!this.ignoreData[packageKey]) {
			this.ignoreData[packageKey] = {
				files: [{
					path: relativePath,
					active: true,
					line: entry.line + 1
				}],
				type: constants.iacRealtimeScannerEngineName,
				PackageName: entry.title,
				similarityId: entry.similarityId,
				severity: entry.severity,
				description: entry.description,
				dateAdded: entry.dateAdded
			};
		} else {
			const existingFileEntry = this.ignoreData[packageKey].files.find(f => f.path === relativePath);
			if (existingFileEntry) {
				existingFileEntry.active = true;
			} else {
				this.ignoreData[packageKey].files.push({
					path: relativePath,
					active: true,
					line: this.ignoreData[packageKey].files[0]?.line || (entry.line + 1)
				});
			}
			if (entry.severity !== undefined) { this.ignoreData[packageKey].severity = entry.severity; }
			if (entry.description !== undefined) { this.ignoreData[packageKey].description = entry.description; }
		}
		this.saveIgnoreFile();
		this.updateTempList();
		this.uiRefreshCallback?.();
	}

	public addIgnoredEntryAsca(entry: {
		ruleName: string;
		ruleId: number;
		filePath: string;
		line: number;
		severity?: string;
		description?: string;
		dateAdded?: string;
	}): void {
		const relativePath = this.normalizePath(entry.filePath);
		const packageKey = `${entry.ruleName}:${entry.ruleId}:${relativePath}`;

		if (!this.ignoreData[packageKey]) {
			this.ignoreData[packageKey] = {
				files: [{
					path: relativePath,
					active: true,
					line: entry.line + 1
				}],
				type: constants.ascaRealtimeScannerEngineName,
				PackageName: entry.ruleName,
				ruleId: entry.ruleId,
				severity: entry.severity,
				description: entry.description,
				dateAdded: entry.dateAdded
			};
		} else {
			const existingFileEntry = this.ignoreData[packageKey].files.find(f => f.path === relativePath);
			if (existingFileEntry) {
				existingFileEntry.active = true;
			} else {
				this.ignoreData[packageKey].files.push({
					path: relativePath,
					active: true,
					line: this.ignoreData[packageKey].files[0]?.line || (entry.line + 1)
				});
			}
			if (entry.severity !== undefined) { this.ignoreData[packageKey].severity = entry.severity; }
			if (entry.description !== undefined) { this.ignoreData[packageKey].description = entry.description; }
		}
		this.saveIgnoreFile();
		this.updateTempList();
		this.uiRefreshCallback?.();
	}

	public addIgnoredEntryContainers(entry: {
		imageName: string;
		imageTag: string;
		filePath: string;
		line: number;
		severity?: string;
		description?: string;
		dateAdded?: string;
	}): void {
		const relativePath = this.normalizePath(entry.filePath);
		const packageKey = `${entry.imageName}:${entry.imageTag}`;

		if (!this.ignoreData[packageKey]) {
			this.ignoreData[packageKey] = {
				files: [{
					path: relativePath,
					active: true,
					line: entry.line
				}],
				type: constants.containersRealtimeScannerEngineName,
				PackageName: `${entry.imageName}:${entry.imageTag}`,
				imageName: entry.imageName,
				imageTag: entry.imageTag,
				severity: entry.severity,
				description: entry.description,
				dateAdded: entry.dateAdded
			};
		} else {
			const existingFileEntry = this.ignoreData[packageKey].files.find(f => f.path === relativePath);
			if (existingFileEntry) {
				existingFileEntry.active = true;
			} else {
				this.ignoreData[packageKey].files.push({
					path: relativePath,
					active: true,
					line: this.ignoreData[packageKey].files[0]?.line || entry.line
				});
			}
			if (entry.severity !== undefined) { this.ignoreData[packageKey].severity = entry.severity; }
			if (entry.description !== undefined) { this.ignoreData[packageKey].description = entry.description; }
		}
		this.saveIgnoreFile();
		this.updateTempList();
		this.uiRefreshCallback?.();
	}

	private saveIgnoreFile(): void {
		fs.writeFileSync(this.getIgnoreFilePath(), JSON.stringify(this.ignoreData, null, 2));
		if (this.statusBarUpdateCallback) {
			this.statusBarUpdateCallback();
		}
	}

	public updateTempList(): void {
		const tempList: Array<{
			Title?: string;
			FilePath?: string;
			SecretValue?: string;
			SimilarityID?: string;
			FileName?: string;
			Line?: number;
			RuleID?: number;
			ImageName?: string;
			ImageTag?: string;
			PackageManager?: string;
			PackageName?: string;
			PackageVersion?: string;
		}> = [];
		const addedContainers = new Set<string>();
		const addedOssPackages = new Set<string>();
		const addedSecrets = new Set<string>();

		Object.values(this.ignoreData).forEach(entry => {
			const hasActiveFiles = entry.files.some(file => file.active);
			if (!hasActiveFiles) { return; }

			if (entry.type === constants.containersRealtimeScannerEngineName) {
				const containerKey = `${entry.imageName}:${entry.imageTag}`;
				if (!addedContainers.has(containerKey)) {
					tempList.push({
						ImageName: entry.imageName,
						ImageTag: entry.imageTag
					});
					addedContainers.add(containerKey);
				}
			} else if (entry.type === constants.ossRealtimeScannerEngineName) {
				const ossKey = `${entry.PackageManager}:${entry.PackageName}:${entry.PackageVersion}`;
				if (!addedOssPackages.has(ossKey)) {
					tempList.push({
						PackageManager: entry.PackageManager,
						PackageName: entry.PackageName,
						PackageVersion: entry.PackageVersion
					});
					addedOssPackages.add(ossKey);
				}
			} else if (entry.type === constants.secretsScannerEngineName) {
				const secretKey = `${entry.PackageName}:${entry.secretValue}`;
				if (!addedSecrets.has(secretKey)) {
					tempList.push({
						Title: entry.PackageName,
						SecretValue: entry.secretValue
					});
					addedSecrets.add(secretKey);
				}
			} else {
				entry.files
					.filter(file => file.active)
					.forEach(file => {
						const originalPath = path.resolve(this.workspaceRootPath, file.path);
						const scannedTempPath = this.scannedFileMap?.get(originalPath) || originalPath;

						if (entry.type === constants.iacRealtimeScannerEngineName) {
							tempList.push({
								Title: entry.PackageName,
								SimilarityID: entry.similarityId
							});
						} else if (entry.type === constants.ascaRealtimeScannerEngineName) {
							tempList.push({
								FileName: path.basename(scannedTempPath),
								Line: file.line,
								RuleID: entry.ruleId
							});
						}
					});
			}
		});

		fs.writeFileSync(this.getTempListPath(), JSON.stringify(tempList, null, 2));
	}

	public isPackageIgnored(packageName: string, version: string, filePath: string, packageManager?: string): boolean {
		const packageKey = packageManager ?
			`${packageManager}:${packageName}:${version}` :
			`${packageName}:${version}`;
		const entry = this.ignoreData[packageKey];

		if (!entry) {
			return false;
		}

		const relativePath = this.normalizePath(filePath);
		const fileEntry = entry.files.find(f => f.path === relativePath);

		return fileEntry && fileEntry.active;
	}

	public isSecretIgnored(title: string, secretValue: string, filePath: string): boolean {
		const relativePath = this.normalizePath(filePath);
		const packageKey = `${title}:${secretValue}:${relativePath}`;
		const entry = this.ignoreData[packageKey];

		if (!entry) {
			return false;
		}

		const fileEntry = entry.files.find(f => f.path === relativePath && f.active);

		return fileEntry && fileEntry.active;
	}

	public removeMissingSecrets(currentResults: CxSecretsResult[], filePath: string): boolean {
		let hasChanges = false;
		const relativePath = this.normalizePath(filePath);

		const currentSecrets = new Map<string, number[]>();
		currentResults.forEach(result => {
			if (result.secretValue) {
				const key = `${result.title}:${result.secretValue}:${relativePath}`;
				const lines = currentSecrets.get(key) || [];
				result.locations.forEach(loc => lines.push(loc.line + 1));
				currentSecrets.set(key, lines);
			}
		});

		Object.entries(this.ignoreData).forEach(([key, entry]) => {
			if (entry.type !== constants.secretsScannerEngineName) { return; }

			const fileEntry = entry.files.find(f => f.path === relativePath);
			if (!fileEntry || !fileEntry.active) { return; }

			const secretKey = `${entry.PackageName}:${entry.secretValue}:${relativePath}`;
			if (!currentSecrets.has(secretKey)) {
				if (entry.files.length === 1) {
					delete this.ignoreData[key];
				} else {
					fileEntry.active = false;
				}
				hasChanges = true;
			} else {
				const lines = currentSecrets.get(secretKey) || [];
				if (lines.length > 0) {
					fileEntry.line = lines[0];
					hasChanges = true;
				}
			}
		});

		if (hasChanges) {
			this.saveIgnoreFile();
			this.updateTempList();
			this.uiRefreshCallback?.();
		}

		return hasChanges;
	}

	public removeMissingIac(currentResults: CxIacResult[], filePath: string): boolean {
		let hasChanges = false;
		const relativePath = this.normalizePath(filePath);

		const currentIacs = new Map<string, number[]>();
		currentResults.forEach(result => {
			if (result.similarityID) {
				const key = `${result.title}:${result.similarityID}:${relativePath}`;
				const lines = currentIacs.get(key) || [];
				result.locations.forEach(loc => lines.push(loc.line + 1));
				currentIacs.set(key, lines);
			}
		});

		Object.entries(this.ignoreData).forEach(([key, entry]) => {
			if (entry.type !== constants.iacRealtimeScannerEngineName) { return; }

			const fileEntry = entry.files.find(f => f.path === relativePath);
			if (!fileEntry || !fileEntry.active) { return; }

			const iacKey = `${entry.PackageName}:${entry.similarityId}:${relativePath}`;
			if (!currentIacs.has(iacKey)) {
				if (entry.files.length === 1) {
					delete this.ignoreData[key];
				} else {
					fileEntry.active = false;
				}
				hasChanges = true;
			} else {
				const lines = currentIacs.get(iacKey) || [];
				if (lines.length > 0) {
					fileEntry.line = lines[0];
					hasChanges = true;
				}
			}
		});

		if (hasChanges) {
			this.saveIgnoreFile();
			this.updateTempList();
			this.uiRefreshCallback?.();
		}

		return hasChanges;
	}

	public removeMissingAsca(currentResults: unknown[], filePath: string): boolean {
		let hasChanges = false;
		const relativePath = this.normalizePath(filePath);

		const currentAsca = new Map<string, number[]>();
		currentResults.forEach(result => {
			const scanDetail = result as { ruleName: string; ruleId: number; line: number };
			const key = `${scanDetail.ruleName}:${scanDetail.ruleId}`;
			const lines = currentAsca.get(key) || [];
			lines.push(scanDetail.line);
			currentAsca.set(key, lines);
		});

		Object.entries(this.ignoreData).forEach(([packageKey, entry]) => {
			if (entry.type !== constants.ascaRealtimeScannerEngineName) { return; }

			const fileEntry = entry.files.find(f => f.path === relativePath);
			if (!fileEntry) { return; }

			const ascaKey = `${entry.PackageName}:${entry.ruleId}`;
			const currentLines = currentAsca.get(ascaKey) || [];

			const lineStillExists = currentLines.includes(fileEntry.line);

			if (!lineStillExists) {
				if (currentLines.length === 0) {
					delete this.ignoreData[packageKey];
					hasChanges = true;
				} else {
					fileEntry.line = currentLines[0];
					hasChanges = true;
				}
			}
		});

		if (hasChanges) {
			this.saveIgnoreFile();
			this.updateTempList();
			this.uiRefreshCallback?.();
		}

		return hasChanges;
	}

	public removeMissingContainers(currentResults: unknown[], filePath: string): boolean {
		const relativePath = this.normalizePath(filePath);
		let hasChanges = false;

		const currentImages = new Map<string, number[]>();
		currentResults.forEach(result => {
			const containerResult = result as { imageName: string; imageTag: string; locations: Array<{ line: number }> };
			const imageKey = `${containerResult.imageName}:${containerResult.imageTag}`;
			if (!currentImages.has(imageKey)) {
				currentImages.set(imageKey, []);
			}
			containerResult.locations.forEach(location => {
				currentImages.get(imageKey)!.push(location.line);
			});
		});

		Object.keys(this.ignoreData).forEach(packageKey => {
			const entry = this.ignoreData[packageKey];
			if (entry.type !== constants.containersRealtimeScannerEngineName) {
				return;
			}

			const fileEntry = entry.files.find(f => f.path === relativePath && f.active);
			if (!fileEntry) {
				return;
			}

			const imageKey = `${entry.imageName}:${entry.imageTag}`;
			const currentLines = currentImages.get(imageKey) || [];

			if (currentLines.length === 0) {
				const updatedFiles = entry.files.filter(f => f.path !== relativePath);
				if (updatedFiles.length === 0) {
					delete this.ignoreData[packageKey];
				} else {
					entry.files = updatedFiles;
				}
				hasChanges = true;
			} else {
				entry.files.forEach(fileEntry => {
					if (fileEntry.path === relativePath && fileEntry.active) {
						fileEntry.line = currentLines[0] + 1;
						hasChanges = true;
					}
				});
			}
		});

		if (hasChanges) {
			this.saveIgnoreFile();
			this.updateTempList();
			this.uiRefreshCallback?.();
		}

		return hasChanges;
	}

}
