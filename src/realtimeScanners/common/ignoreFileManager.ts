
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface IgnoreEntry {
	files: string[];
	active: boolean;
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

	private constructor() { }

	public static getInstance(): IgnoreFileManager {
		if (!IgnoreFileManager.instance) {
			IgnoreFileManager.instance = new IgnoreFileManager();
		}
		return IgnoreFileManager.instance;
	}

	public initialize(workspaceFolder: vscode.WorkspaceFolder): void {
		this.workspacePath = path.join(workspaceFolder.uri.fsPath, '.vscode');
		this.workspaceRootPath = workspaceFolder.uri.fsPath;
		this.ensureIgnoreFileExists();
		this.loadIgnoreData();
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
				active: true,
				type: entry.packageManager ? 'ossScan' : 'unknown',
				PackageManager: entry.packageManager,
				PackageName: entry.packageName,
				PackageVersion: entry.packageVersion
			};
		}

		if (!this.ignoreData[packageKey].files.includes(relativePath)) {
			this.ignoreData[packageKey].files.push(relativePath);
		}

		this.saveIgnoreFile();
		this.updateTempList();
	}

	private saveIgnoreFile(): void {
		fs.writeFileSync(this.getIgnoreFilePath(), JSON.stringify(this.ignoreData, null, 2));
	}

	private updateTempList(): void {
		const tempList = Object.values(this.ignoreData)
			.filter(entry => entry.active)
			.map(entry => ({
				PackageManager: entry.PackageManager,
				PackageName: entry.PackageName,
				PackageVersion: entry.PackageVersion
			}));

		fs.writeFileSync(this.getTempListPath(), JSON.stringify(tempList, null, 2));
	}
}
