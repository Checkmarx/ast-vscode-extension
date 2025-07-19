
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OssScannerService } from '../scanners/oss/ossScannerService';
import { Logs } from '../../models/logs';

export interface IgnoreEntry {
	files: Array<{
		path: string;
		active: boolean;
		line?: number;
	}>;
	type: string;
	PackageManager: string;
	PackageName: string;
	PackageVersion: string;
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
		if (!this.ossScannerService) {
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
		if (!this.ossScannerService) {
			return;
		}

		const fullPath = path.resolve(this.workspaceRootPath, relativePath);

		try {
			let document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === fullPath);

			if (!document) {
				document = await vscode.workspace.openTextDocument(fullPath);
			}

			if (this.ossScannerService.shouldScanFile(document)) {
				const logs = {
					info: (msg: string) => console.log('[INFO]', msg),
					error: (msg: string) => console.error('[ERROR]', msg)
				} as Logs;

				await this.ossScannerService.scan(document, logs);
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
				type: entry.packageManager ? 'ossScan' : 'unknown',
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

					return {
						PackageManager: entry.PackageManager,
						PackageName: entry.PackageName,
						PackageVersion: entry.PackageVersion,
						FilePath: scannedTempPath,
					};
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





}
