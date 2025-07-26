// ignoreCommand.ts
import * as vscode from 'vscode';
import { IgnoreFileManager } from '../realtimeScanners/common/ignoreFileManager';
import { HoverData } from '../realtimeScanners/common/types';
export class IgnoreCommand {
	constructor(private context: vscode.ExtensionContext) {
		this.register();
	}

	private register() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand('cx.ignore', async (hoverData: HoverData) => {
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				const editor = vscode.window.activeTextEditor;

				if (!workspaceFolder || !editor || !hoverData) {
					vscode.window.showErrorMessage('Missing context or workspace');
					return;
				}

				const filePath = editor.document.uri.fsPath;

				IgnoreFileManager.getInstance().initialize(workspaceFolder);
				IgnoreFileManager.getInstance().addIgnoredEntry({
					packageManager: hoverData.packageManager,
					packageName: hoverData.packageName,
					packageVersion: hoverData.version,
					filePath,
					dateAdded: new Date().toISOString()
				});

				vscode.window.showInformationMessage(`${hoverData.packageName}@${hoverData.version} ignored.`);
			})
		);
	}
}