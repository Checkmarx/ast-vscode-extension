import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logs } from '../models/logs';
import { HoverData } from '../realtimeScanners/common/types';

export class IgnoreOssCommand {
	constructor(private context: vscode.ExtensionContext, private logs: Logs) { }

	public registerIgnoreCommand() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand('cx.ignore', async (hoverData: HoverData) => {
				try {
					if (!hoverData || !hoverData.packageName || !hoverData.version) {
						throw new Error('Invalid package information');
					}

					const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
					if (!workspaceFolder) {
						throw new Error('No workspace folder found');
					}

					const ignoreFilePath = path.join(workspaceFolder.uri.fsPath, '.checkmarxIgnored');
					const packageKey = `${hoverData.packageName}:${hoverData.version}`;

					// Get current working file path
					const activeEditor = vscode.window.activeTextEditor;
					const currentFilePath = activeEditor?.document.uri.fsPath;

					if (!currentFilePath) {
						throw new Error('No active file found');
					}

					// Make the path relative to workspace
					const relativePath = path.relative(workspaceFolder.uri.fsPath, currentFilePath);

					let ignoreData: Record<string, string[]> = {};

					// Read existing ignore file if it exists
					if (fs.existsSync(ignoreFilePath)) {
						try {
							const fileContent = fs.readFileSync(ignoreFilePath, 'utf8');
							ignoreData = JSON.parse(fileContent);
						} catch (error) {
							this.logs.warn(`Failed to parse existing ignore file: ${error}`);
						}
					}

					// Add or update the package entry
					if (!ignoreData[packageKey]) {
						ignoreData[packageKey] = [];
					}

					// Add the current file path if not already present
					if (!ignoreData[packageKey].includes(relativePath)) {
						ignoreData[packageKey].push(relativePath);
					}

					// Write the updated ignore file
					fs.writeFileSync(ignoreFilePath, JSON.stringify(ignoreData, null, 2));

					this.logs.info(`Added ${packageKey} to ignore list for file: ${relativePath}`);
					vscode.window.showInformationMessage(`Package ${hoverData.packageName}@${hoverData.version} added to ignore list`);

				} catch (error) {
					this.logs.error(`Error ignoring package: ${error}`);
					vscode.window.showErrorMessage(`Failed to ignore package: ${error}`);
				}
			})
		);
	}
} 