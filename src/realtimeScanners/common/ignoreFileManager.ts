import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logs } from '../../models/logs';
import { IgnoreEntry } from '../../commands/ignoreOssCommand';

export interface IgnoreData {
	[packageKey: string]: IgnoreEntry;
}

export class IgnoreFileManager {
	private static instance: IgnoreFileManager;
	private ignoreData: IgnoreData = {};
	private fileWatcher: vscode.FileSystemWatcher | undefined;
	private ignoreFilePath: string | undefined;
	private debounceTimer: NodeJS.Timeout | undefined;

	constructor(private logs: Logs) { }

	public static getInstance(logs: Logs): IgnoreFileManager {
		if (!IgnoreFileManager.instance) {
			IgnoreFileManager.instance = new IgnoreFileManager(logs);
		}
		return IgnoreFileManager.instance;
	}

	public initialize(workspaceFolder: vscode.WorkspaceFolder) {
		this.ignoreFilePath = path.join(workspaceFolder.uri.fsPath, '.checkmarxIgnored');
		this.loadIgnoreData();
		this.setupFileWatcher();
		this.addToGitignore(workspaceFolder);
	}

	private loadIgnoreData() {
		if (!this.ignoreFilePath) {
			return;
		}

		try {
			if (fs.existsSync(this.ignoreFilePath)) {
				const fileContent = fs.readFileSync(this.ignoreFilePath, 'utf8');
				this.ignoreData = JSON.parse(fileContent);
				this.logs.info('Loaded ignore data from .checkmarxIgnored');
			} else {
				this.ignoreData = {};
			}
		} catch (error) {
			this.logs.error(`Failed to load ignore data: ${error}`);
			this.ignoreData = {};
		}
	}

	private setupFileWatcher() {
		if (!this.ignoreFilePath) {
			return;
		}

		// Clean up existing watcher
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}

		const pattern = new vscode.RelativePattern(
			path.dirname(this.ignoreFilePath),
			'.checkmarxIgnored'
		);

		this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

		this.fileWatcher.onDidChange(() => {
			this.debouncedReload();
		});

		this.fileWatcher.onDidCreate(() => {
			this.debouncedReload();
		});

		this.fileWatcher.onDidDelete(() => {
			this.ignoreData = {};
			this.logs.info('Ignore file deleted, cleared ignore data');
		});
	}

	private debouncedReload() {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(async () => {
			const oldIgnoreData = { ...this.ignoreData };
			this.loadIgnoreData();
			await this.triggerScansOnChanges(oldIgnoreData, this.ignoreData);
		}, 300); // 300ms debounce
	}

	private async triggerScansOnChanges(oldData: IgnoreData, newData: IgnoreData) {
		const oldKeys = new Set(Object.keys(oldData));
		const newKeys = new Set(Object.keys(newData));

		// Check for removed packages (need project scan)
		for (const oldKey of oldKeys) {
			if (!newKeys.has(oldKey)) {
				this.logs.info(`Package ${oldKey} removed from ignore list, triggering project scan`);
				await this.triggerProjectScan();
				return; // Only one project scan needed
			}
		}

		// Check for added packages or modified file paths (need file-specific scans)
		for (const newKey of newKeys) {
			if (!oldKeys.has(newKey)) {
				// New package added
				await this.triggerFileScansForPackage(newKey, newData[newKey].files);
			} else {
				// Check for changes in file paths
				const oldPaths = new Set(oldData[newKey]?.files || []);
				const newPaths = new Set(newData[newKey]?.files || []);

				const addedPaths = [...newPaths].filter(path => !oldPaths.has(path));
				if (addedPaths.length > 0) {
					await this.triggerFileScansForPackage(newKey, addedPaths);
				}
			}
		}
	}


	private async triggerFileScansForPackage(packageKey: string, filePaths: string[]) {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		for (const relativePath of filePaths) {
			const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
			await this.triggerFileScan(fullPath);
		}
	}

	private async triggerFileScan(fileUri: vscode.Uri) {
		try {
			// Open the document to trigger a scan
			const document = await vscode.workspace.openTextDocument(fileUri);

			// Log the trigger
			this.logs.info(`Triggering scan for file: ${fileUri.fsPath}`);

			// The real-time scanner will automatically scan when the document is opened
			// or we can manually trigger a save event
			if (document.isDirty) {
				await document.save();
			}
		} catch (error) {
			this.logs.warn(`Failed to trigger scan for file ${fileUri.fsPath}: ${error}`);
		}
	}

	private async triggerProjectScan() {
		// For project scan, we need to trigger scans for all manifest files in the workspace
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		this.logs.info('Triggering project scan due to package removal from ignore list');

		try {
			// Find and scan all manifest files
			const packageJsonFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 100);
			for (const file of packageJsonFiles) {
				await this.triggerFileScan(file);
			}

			const csprojFiles = await vscode.workspace.findFiles('**/*.csproj', null, 100);
			for (const file of csprojFiles) {
				await this.triggerFileScan(file);
			}

			// Add other manifest file patterns as needed
		} catch (error) {
			this.logs.error(`Failed to trigger project scan: ${error}`);
		}
	}

	public isPackageIgnored(packageName: string, version: string, filePath: string): boolean {
		const packageKey = `${packageName}:${version}`;
		const entry = this.ignoreData[packageKey];
		if (!entry) {
			return false;
		}



		// Check if the file is in the ignored list
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return false;
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
		return entry.files.includes(relativePath);
	}

	public getIgnoreData(): IgnoreData {
		return { ...this.ignoreData };
	}

	public getAllIgnoredPackages(): string[] {
		return Object.keys(this.ignoreData);
	}

	public removeIgnoredPackage(packageKey: string, filePath?: string): boolean {
		if (!this.ignoreFilePath) {
			return false;
		}

		try {
			const removedFiles: string[] = [];
			const entry = this.ignoreData[packageKey];

			if (filePath) {
				// Remove specific file path from package
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder || !entry) {
					return false;
				}

				const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
				const index = entry.files.indexOf(relativePath);
				if (index > -1) {
					entry.files.splice(index, 1);
					removedFiles.push(relativePath);

					// If no files left, remove the package entry
					if (entry.files.length === 0) {
						delete this.ignoreData[packageKey];
					}
				}
			} else {
				// Remove entire package - store all files that will be removed
				if (entry) {
					removedFiles.push(...entry.files);
				}
				delete this.ignoreData[packageKey];
			}

			// Save updated ignore data
			fs.writeFileSync(this.ignoreFilePath, JSON.stringify(this.ignoreData, null, 2));
			this.logs.info(`Removed ${packageKey} from ignore list`);

			// Trigger scans for the removed files immediately
			if (removedFiles.length > 0) {
				this.logs.info(`Triggering scans for ${removedFiles.length} files that were removed from ignore list`);
				this.triggerScansForRemovedFiles(removedFiles);
			}

			return true;
		} catch (error) {
			this.logs.error(`Failed to remove ignored package: ${error}`);
			return false;
		}
	}

	private async triggerScansForRemovedFiles(removedFiles: string[]) {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		this.logs.info(`Starting scans for ${removedFiles.length} files removed from ignore list`);

		for (const relativePath of removedFiles) {
			try {
				const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
				this.logs.info(`Triggering scan for removed file: ${relativePath}`);

				// Open the document and show it to trigger the scanner
				const document = await vscode.workspace.openTextDocument(fullPath);
				await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });

				// Wait a bit for the document to be processed
				await new Promise(resolve => setTimeout(resolve, 200));

				// Make a tiny edit and undo it to trigger change detection
				const editor = vscode.window.activeTextEditor;
				if (editor && editor.document.uri.toString() === fullPath.toString()) {
					await editor.edit(editBuilder => {
						editBuilder.insert(new vscode.Position(0, 0), ' ');
					});

					// Undo the change immediately
					await vscode.commands.executeCommand('undo');

					// Save the document to trigger scan
					await document.save();
				}

				this.logs.info(`Scan triggered for: ${relativePath}`);

			} catch (error) {
				this.logs.warn(`Failed to trigger scan for file ${relativePath}: ${error}`);
			}
		}

		this.logs.info('Completed triggering scans for removed files');
	}

	private addToGitignore(workspaceFolder: vscode.WorkspaceFolder) {
		const gitignorePath = path.join(workspaceFolder.uri.fsPath, '.gitignore');
		const cursorignorePath = path.join(workspaceFolder.uri.fsPath, '.cursorignore');
		const ignoreEntry = '.checkmarxIgnored';

		try {
			// Add to .gitignore
			let gitignoreContent = '';

			// Read existing .gitignore if it exists
			if (fs.existsSync(gitignorePath)) {
				gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

				// Check if .checkmarxIgnored is already in .gitignore
				if (!gitignoreContent.includes(ignoreEntry)) {
					// Add .checkmarxIgnored to .gitignore
					const newContent = gitignoreContent.trim() + (gitignoreContent.trim() ? '\n' : '') + ignoreEntry + '\n';
					fs.writeFileSync(gitignorePath, newContent);
					this.logs.info('Added .checkmarxIgnored to .gitignore for local usage only');
				}
			} else {
				// Create .gitignore with .checkmarxIgnored entry
				fs.writeFileSync(gitignorePath, ignoreEntry + '\n');
				this.logs.info('Created .gitignore and added .checkmarxIgnored for local usage only');
			}

			// Add to .cursorignore for Cursor IDE support
			let cursorignoreContent = '';

			if (fs.existsSync(cursorignorePath)) {
				cursorignoreContent = fs.readFileSync(cursorignorePath, 'utf8');

				if (!cursorignoreContent.includes(ignoreEntry)) {
					const newContent = cursorignoreContent.trim() + (cursorignoreContent.trim() ? '\n' : '') + ignoreEntry + '\n';
					fs.writeFileSync(cursorignorePath, newContent);
					this.logs.info('Added .checkmarxIgnored to .cursorignore for Cursor IDE support');
				}
			} else {
				// Create .cursorignore with .checkmarxIgnored entry
				fs.writeFileSync(cursorignorePath, ignoreEntry + '\n');
				this.logs.info('Created .cursorignore and added .checkmarxIgnored for Cursor IDE support');
			}
		} catch (error) {
			this.logs.warn(`Failed to add .checkmarxIgnored to ignore files: ${error}`);
		}
	}

	public dispose() {
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
	}
}