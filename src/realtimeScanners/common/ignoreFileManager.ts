
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OssScannerService } from '../scanners/oss/ossScannerService';
import { SecretsScannerService } from '../scanners/secrets/secretsScannerService';
import { Logs } from '../../models/logs';
import { constants } from '../../utils/common/constants';
import CxSecretsResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/secrets/CxSecrets";
import CxIacResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/iacRealtime/CxIac";
import { IacScannerService } from '../scanners/iac/iacScannerService';
import { AscaScannerService } from '../scanners/asca/ascaScannerService';
import { ContainersScannerService } from '../scanners/containers/containersScannerService';
export interface IgnoreEntry {
	files: Array<{
		path: string;
		active: boolean;
		line?: number;
	}>;
	secretValue?: string;
	similarityId?: string;
	ruleId?: number;
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
			const relativePath = path.relative(this.workspaceRootPath, filePath);

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
		return path.join(this.workspacePath, '.checkmarxIgnored');
	}

	private getTempListPath(): string {
		return path.join(this.workspacePath, '.checkmarxIgnoredTempList.json');
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

		const relativePath = path.relative(this.workspaceRootPath, filePath);
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

		const relativePath = path.relative(this.workspaceRootPath, filePath);
		const entry = this.ignoreData[packageKey];
		const fileEntry = entry.files.find(f => f.path === relativePath && f.active);

		if (fileEntry) {
			fileEntry.line = newLineNumber;

			const oldPackageKey = packageKey;
			const newPackageKey = `${entry.PackageName}:${newLineNumber}`;

			if (oldPackageKey !== newPackageKey) {
				this.ignoreData[newPackageKey] = { ...entry };
				delete this.ignoreData[oldPackageKey];
			}

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

		const packageKey = `${entry.packageName}:${entry.packageVersion}`;
		const relativePath = path.relative(this.workspaceRootPath, entry.filePath);

		if (!this.ignoreData[packageKey]) {
			this.ignoreData[packageKey] = {
				files: [],
				type: entry.packageManager ? constants.ossRealtimeScannerEngineName : constants.secretsScannerEngineName,
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
		const relativePath = path.relative(this.workspaceRootPath, entry.filePath);
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
		const relativePath = path.relative(this.workspaceRootPath, entry.filePath);
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
		const relativePath = path.relative(this.workspaceRootPath, entry.filePath);
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

	private saveIgnoreFile(): void {
		fs.writeFileSync(this.getIgnoreFilePath(), JSON.stringify(this.ignoreData, null, 2));
		if (this.statusBarUpdateCallback) {
			this.statusBarUpdateCallback();
		}
	}

	private updateTempList(): void {
		const tempList = Object.values(this.ignoreData).flatMap(entry =>
			entry.files
				.filter(file => file.active)
				.map(file => {
					const originalPath = path.resolve(this.workspaceRootPath, file.path);
					const scannedTempPath = this.scannedFileMap?.get(originalPath) || originalPath;

					if (entry.type === constants.secretsScannerEngineName) {
						return {
							Title: entry.PackageName,
							FilePath: scannedTempPath,
							SecretValue: entry.secretValue
						};
					} else if (entry.type === constants.iacRealtimeScannerEngineName) {
						return {
							Title: entry.PackageName,
							SimilarityID: entry.similarityId
						};
					} else if (entry.type === constants.ascaRealtimeScannerEngineName) {
						return {
							FileName: path.basename(scannedTempPath),
							Line: file.line,
							RuleID: entry.ruleId
						};
					} else {
						return {
							PackageManager: entry.PackageManager,
							PackageName: entry.PackageName,
							PackageVersion: entry.PackageVersion,
							FilePath: scannedTempPath,
						};
					}
				})
		);

		fs.writeFileSync(this.getTempListPath(), JSON.stringify(tempList, null, 2));
	}

	public isPackageIgnored(packageName: string, version: string, filePath: string): boolean {
		const packageKey = `${packageName}:${version}`;
		const entry = this.ignoreData[packageKey];

		if (!entry) {
			return false;
		}

		const relativePath = path.relative(this.workspaceRootPath, filePath);
		const fileEntry = entry.files.find(f => f.path === relativePath);

		return fileEntry && fileEntry.active;
	}

	public isSecretIgnored(title: string, line: number, filePath: string): boolean {
		const packageKey = `${title}:${line}`;
		const entry = this.ignoreData[packageKey];

		if (!entry) {
			return false;
		}

		const relativePath = path.relative(this.workspaceRootPath, filePath);
		const fileEntry = entry.files.find(f => f.path === relativePath && f.line === line);

		return fileEntry && fileEntry.active;
	}

	public removeMissingSecrets(currentResults: CxSecretsResult[], filePath: string): boolean {
		let hasChanges = false;
		const relativePath = path.relative(this.workspaceRootPath, filePath);

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
		const relativePath = path.relative(this.workspaceRootPath, filePath);

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
		const relativePath = path.relative(this.workspaceRootPath, filePath);

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

}
