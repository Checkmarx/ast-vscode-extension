import * as vscode from 'vscode';
import * as CxAuth from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxAuth";
import * as CxScanConfig from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScanConfig";
import { EXTENSION_NAME, SCAN_ID_KEY } from './constants';
import { getNonce } from './utils';


export class AstProjectBindingViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private scanID: string = "";
	
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly _extensionUri: vscode.Uri,
		private readonly statusBarItem: vscode.StatusBarItem
	) { 
		this.scanID = context.globalState.get(SCAN_ID_KEY, "");
	}

	private showStatusBarItem() {
		this.statusBarItem.text = "$(sync~spin) Loading Results";
		this.statusBarItem.tooltip = "Checkmarx command is running";
		this.statusBarItem.command = `${EXTENSION_NAME}.showoutput`;
		this.statusBarItem.show();
	}

	private hideStatusBarItem() {
		this.statusBarItem.text = EXTENSION_NAME;
		this.statusBarItem.tooltip = undefined;
		this.statusBarItem.command = undefined;
		this.statusBarItem.hide();
	}

	public getAstConfiguration() {
		let baseURI = vscode.workspace.getConfiguration("checkmarxAST").get("base-uri") as string;
		let tenant = vscode.workspace.getConfiguration("checkmarxAST").get("tenant") as string;
		let token = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
		let config = new CxScanConfig.CxScanConfig();
		config.apiKey = token;
		config.baseUri = baseURI;
		config.tenant = tenant;
		return config;
	}

	async loadResults(scanID: string) {
		this.context.globalState.update(SCAN_ID_KEY, scanID);
		
		const cx = new CxAuth.CxAuth(this.getAstConfiguration());
		cx.apiKey = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
		await cx.getResults(scanID,"json","ast-results", __dirname);
		vscode.commands.executeCommand("ast-results.refreshTree");
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		// Setup the WV callbacks
		//this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.command) {
				case 'pickedScan':
					this.scanID = data.scanID;
					break;
				case 'loadASTResults':
					vscode.window.showInformationMessage(`Loading Results data for ID: ${this.scanID}`);
					this.showStatusBarItem();
					this.scanID = data.scanID;
					this.loadResults(this.scanID);
					this.hideStatusBarItem();
					break;
			}
		});
	}


	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

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
				<input type="text" id="scanID" class="ast-input" value="${this.scanID}" placeholder="ScanId">

				<button class="ast-search">Search</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}
