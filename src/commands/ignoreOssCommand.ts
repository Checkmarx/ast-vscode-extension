import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logs } from '../models/logs';
import { HoverData } from '../realtimeScanners/common/types';

export interface IgnoreEntry {
	files: string[];
	active: boolean;
	type: string;
}

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

					const activeEditor = vscode.window.activeTextEditor;
					const currentFilePath = activeEditor?.document.uri.fsPath;

					if (!currentFilePath) {
						throw new Error('No active file found');
					}

					const relativePath = path.relative(workspaceFolder.uri.fsPath, currentFilePath);

					let ignoreData: Record<string, IgnoreEntry> = {};

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
						ignoreData[packageKey] = {
							files: [],
							active: true,
							type: hoverData?.packageManager ? "ossScan" : "unknown"

						};
					}

					// Add the current file path if not already present
					if (!ignoreData[packageKey].files.includes(relativePath)) {
						ignoreData[packageKey].files.push(relativePath);
					}

					// Write the updated ignore file
					fs.writeFileSync(ignoreFilePath, JSON.stringify(ignoreData, null, 2));

					this.logs.info(`Added ${packageKey} to ignore list for file: ${relativePath}`);
					vscode.window.showInformationMessage(`Package ${hoverData.packageName}@${hoverData.version} added to ignore list`);

					await this.triggerScanForIgnoredFile(currentFilePath);

				} catch (error) {
					this.logs.error(`Error ignoring package: ${error}`);
					vscode.window.showErrorMessage(`Failed to ignore package: ${error}`);
				}
			})
		);
	}

	private async triggerScanForIgnoredFile(filePath: string) {
		try {
			this.logs.info(`Triggering scan for newly ignored file: ${filePath}`);

			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
			await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });

			await new Promise(resolve => setTimeout(resolve, 200));

			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.uri.fsPath === filePath) {
				await editor.edit(editBuilder => {
					editBuilder.insert(new vscode.Position(0, 0), ' ');
				});

				await vscode.commands.executeCommand('undo');
				await document.save();
			}

			this.logs.info(`Scan triggered for ignored file: ${filePath}`);

		} catch (error) {
			this.logs.warn(`Failed to trigger scan for ignored file ${filePath}: ${error}`);
		}
	}
}
