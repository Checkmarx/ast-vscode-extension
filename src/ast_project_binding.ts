import * as vscode from 'vscode';
import * as CxAuth from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxAuth";
import * as CxScanConfig from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScanConfig";
import * as CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScan";


export class AstProjectBindingViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'astProjectView';
	private _view?: vscode.WebviewView;
	private scanID: string = "";
	
	constructor(
		private readonly _extensionUri: vscode.Uri
	) { }

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
		let cx = new CxAuth.CxAuth(this.getAstConfiguration());
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
					console.log("scanID from submitted request: ",this.scanID);	
					vscode.window.showInformationMessage('Loading Results data for ID:', data.scanID);
					this.scanID = data.scanID;
					this.loadResults(this.scanID);
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

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

