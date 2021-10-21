import * as vscode from "vscode";
import * as CxAuth from "@CheckmarxDev/ast-cli-javascript-wrapper/dist/main/CxAuth";
import * as CxScanConfig from "@CheckmarxDev/ast-cli-javascript-wrapper/dist/main/CxScanConfig";
import { EXTENSION_NAME, SCAN_ID_KEY } from './constants';
import { getNonce } from "./utils";
import { Logs } from "./logs";


export class AstProjectBindingViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private scanID: string = "";
	
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly _extensionUri: vscode.Uri,
		private readonly statusBarItem: vscode.StatusBarItem,
		private readonly logs: Logs,
	) { 
		this.scanID = context.globalState.get(SCAN_ID_KEY, "");
		this.logs = logs;
	}

	private showStatusBarItem() {
		this.statusBarItem.text = "$(sync~spin) AST Loading Results";
		this.statusBarItem.tooltip = "Checkmarx command is running";
		this.statusBarItem.show();
	}

	private hideStatusBarItem() {
		this.statusBarItem.text = EXTENSION_NAME;
		this.statusBarItem.tooltip = undefined;
		this.statusBarItem.hide();
	}

	public getWebView() { return this._view;}

	public getAstConfiguration() {
		this.logs.log("Info","Loading configurations");
		const baseURI = vscode.workspace.getConfiguration("checkmarxAST").get("base-uri") as string;
		const tenant = vscode.workspace.getConfiguration("checkmarxAST").get("tenant") as string;
		const token = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
		if (!baseURI || !tenant || !token) {return undefined;}
		const config = new CxScanConfig.CxScanConfig();
		config.apiKey = token;
		config.baseUri = baseURI;
		config.tenant = tenant;
		return config;
	}

	public validateAstConfiguration() {
		let valid = true;
		const baseURI = vscode.workspace.getConfiguration("checkmarxAST").get("base-uri") as string;
		const tenant = vscode.workspace.getConfiguration("checkmarxAST").get("tenant") as string;
		const token = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;

		if (baseURI.length === 0 || baseURI.includes(" ") ) {
			this.logs.log("Error","Invalid base-uri, not filled or contains spaces");
			vscode.window.showErrorMessage("Invalid base-uri");
			valid = false;
		}
		if (tenant.length === 0 || tenant.includes(" ") ) {
			this.logs.log("Error","Invalid tenant, not filled or contains spaces");
			vscode.window.showErrorMessage("Invalid tenant");
			valid = false;
		}
		if (token.length === 0 || token.includes(" ") ) {
			this.logs.log("Error","Invalid api key, not filled or contains spaces");
			vscode.window.showErrorMessage("Invalid api key");
			valid = false;
		}
		if(valid) {
			this.logs.log("Info","Valid fields for settings");
			vscode.window.showInformationMessage("Valid fields for settings");
		}
		// vscode.window.withProgress(
		// 	{
		// 	  location: vscode.ProgressLocation.Notification,
		// 	  cancellable: false,
		// 	},
		// 	async (progress, token) => {
		// 	 for (let i = 0; i < 10; i++) {
		// 	  setTimeout(() => {
		// 		progress.report({ increment: i*10, message: 'Finding ...' });
		// 	  }, 10000);
		// 	}
		//    }
		// );
	}

	async loadResults(scanID: string) {
		const config = this.getAstConfiguration();

		if (!scanID) {
			this.logs.log("Error","Please provide a scanId");
			vscode.window.showErrorMessage(`Please provide a scanId`);
			return;
		}

		if (!config) {
			this.logs.log("Error","Please configure the plugin settings");
			vscode.window.showErrorMessage(`Please configure the plugin settings`);
			return;
		}
		
		this.logs.log("Info",`Trying to load results data for ID: ${scanID}`);	
		vscode.window.showInformationMessage(`Trying to load results data for ID: ${scanID}`);

		vscode.commands.executeCommand("ast-results.cleanTree");
		this.logs.log("Info","Cleaned the results tree");

		this.scanID = scanID;
		this.context.globalState.update(SCAN_ID_KEY, scanID);
		this.showStatusBarItem();
		const cx = new CxAuth.CxAuth(config);
		cx.apiKey = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
		let authRes =  await cx.authValidate();

		if(authRes.exitCode === 0) {
			this.logs.log("Info","Settings validated, authentication succeeded");
			let res = await cx.getResults(scanID,"json","ast-results", __dirname);
			
			if(res.exitCode === 0) {
				this.logs.log("Info","Results loaded successfully");
				vscode.window.showInformationMessage("Results loaded successfully");
			}
			else {
				this.logs.log("Error","No results available");
				vscode.window.showErrorMessage(`No results available for ID: ${scanID}`);
			}			
	 	}
		else {
			this.logs.log("Error","Invalid Settings");
			vscode.window.showErrorMessage("Invalid Settings, authentication failed");
		}
		
		this.hideStatusBarItem();
		this.logs.log("Info","Refreshing the results tree");
		vscode.commands.executeCommand("ast-results.refreshTree");
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		// Setup the WV callbacks
		this._view = webviewView;
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
					this.scanID = data.scanID;
					this.loadResults(this.scanID);
					break;
				case 'settings':
					this.validateAstConfiguration();
					vscode.commands.executeCommand("ast-results.viewSettings");
					break;				
				case 'clear':
					vscode.commands.executeCommand("ast-results.clear");
					// send the message inside of the webview to clear the id
					webviewView.webview.postMessage({instruction:"clear ID"});
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

				<title>Checkmarx</title>
			</head>
			<body>
				<input type="text" id="scanID" class="ast-input" value="${this.scanID}" placeholder="ScanId">

				<button class="ast-search">Search</button>
				<button class="ast-settings">Settings</button>
				<button class="ast-clear">Clear</button>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
	
}