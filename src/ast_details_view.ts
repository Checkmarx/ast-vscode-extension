import { pathToFileURL } from 'url';
import * as vscode from 'vscode';
import { TreeItem } from './ast_results_provider';
import { AstResult } from './results';
import { getNonce } from './utils';

export class AstDetailsViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private result: AstResult | undefined;
	constructor(
		private readonly _extensionUri: vscode.Uri
	) { }

	public refresh(astResult: TreeItem) {
		this.result = astResult.result;
		if (this._view !== undefined) {
			this._view.webview.html = this._getHtmlForWebview(this._view.webview);
		}
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.command) {
				case 'showFile':
					this.loadDecorations(data.path, data.line, data.column, data.length);
					break;
			}
		});
	}

	private loadDecorations(filePath: string, line: number, startColumn: number, length: number) {
		const folder = vscode.workspace.workspaceFolders![0];
		const position = new vscode.Position(+line + 1, +startColumn);
		const path = vscode.Uri.joinPath(folder.uri, filePath);
		
		vscode.workspace.openTextDocument(path).then(doc => 
		{
			vscode.window.showTextDocument(doc).then(editor => 
			{
				// Line added - by having a selection at the same position twice, the cursor jumps there
				editor.selections = [new vscode.Selection(position,position)]; 
		
				// And the visible range jumps there too
				var range = new vscode.Range(position, position);
				editor.revealRange(range);
			});
		});
	}

	private _getHtmlForEmptyView(webview: vscode.Webview) {
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>AST Result</title>
			</head>
			<body>
			&nbsp;				
			</body>
		</html>
		`;
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		if (!this.result) { return this._getHtmlForEmptyView(webview); }
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'view.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>Cat Colors</title>
			</head>
			<body>
				<h2>${this.result?.label}</h2>
				<h3> ${this.result?.type} | ${this.result?.language} | ${this.result?.status} | ${this.result?.severity}</h3><br/>
				${this.result?.getHtmlDetails()}

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

