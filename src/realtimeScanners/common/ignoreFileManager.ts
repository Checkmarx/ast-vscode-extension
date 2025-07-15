
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OssScannerService } from '../scanners/oss/ossScannerService';
import { Logs } from '../../models/logs';

export interface IgnoreEntry {
	files: Array<{ path: string; active: boolean }>;
	type: string;
	PackageManager: string;
	PackageName: string;
	PackageVersion: string;
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

	private startFileWatcher(): void {
		this.stopFileWatcher();

		const ignoreFilePath = this.getIgnoreFilePath();
		if (fs.existsSync(ignoreFilePath)) {
			this.fileWatcher = fs.watch(ignoreFilePath, (eventType) => {
				if (eventType === 'change') {
					this.handleFileChange();
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

	private handleFileChange(): void {
		this.loadIgnoreData();

		this.detectAndHandleActiveChanges();

		this.previousIgnoreData = JSON.parse(JSON.stringify(this.ignoreData));
	}

	private detectAndHandleActiveChanges(): void {
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

		deactivatedFiles.forEach(file => {
			this.handleFileDeactivated(file.packageKey, file.path);
		});
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

	private async handleFileDeactivated(packageKey: string, filePath: string): Promise<void> {
		try {
			this.updateTempList();

			await this.rescanFile(filePath);

			console.log(`Handled deactivation for ${packageKey} in file ${filePath}`);
		} catch (error) {
			console.error(`Error handling file deactivation for ${packageKey}:`, error);
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
				console.log(`Rescanned file: ${fullPath}`);
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

	public addIgnoredEntry(entry: {
		packageManager: string;
		packageName: string;
		packageVersion: string;
		filePath: string;
	}): void {
		const packageKey = `${entry.packageName}:${entry.packageVersion}`;
		const relativePath = path.relative(this.workspaceRootPath, entry.filePath);

		if (!this.ignoreData[packageKey]) {
			this.ignoreData[packageKey] = {
				files: [],
				type: entry.packageManager ? 'ossScan' : 'unknown',
				PackageManager: entry.packageManager,
				PackageName: entry.packageName,
				PackageVersion: entry.packageVersion,
			};
		}

		const existing = this.ignoreData[packageKey].files.find(f => f.path === relativePath);
		if (!existing) {
			this.ignoreData[packageKey].files.push({ path: relativePath, active: true });
		} else {
			existing.active = true;
		}

		this.saveIgnoreFile();
		this.updateTempList();
	}


	private saveIgnoreFile(): void {
		fs.writeFileSync(this.getIgnoreFilePath(), JSON.stringify(this.ignoreData, null, 2));
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





}
