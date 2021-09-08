import * as vscode from 'vscode';
import * as CxAuth from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxAuth";
import * as CxScanConfig from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScanConfig";
import * as CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScan";
import * as path from 'path';
import * as fs from 'fs';
import { CxResultType } from '@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxResultType';
import { AstResultsProvider } from './ast_results_provider';

export class AstProjectBindingViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'astProjectView';
	private _view?: vscode.WebviewView;
	private scanID: string = "";
	private scanList: Array<any> = [];
	
	constructor(
		private readonly _extensionUri: vscode.Uri
	) {
		if(!this.scanID) {
			this.loadResults(this.scanID);
		}
		this.refresh();
	}

	public refresh() {
		console.log("Refreshing view!");
		if (this._view !== undefined) {
			this._view.webview.html = this._getHtmlForWebview(this._view.webview);
		}
	}

	public getAstConfiguration() {
		let baseURI = vscode.workspace.getConfiguration("checkmarxAST").get("base-uri") as string;
		let clientID = vscode.workspace.getConfiguration("checkmarxAST").get("client-id") as string;
		let tenant = vscode.workspace.getConfiguration("checkmarxAST").get("tenant") as string;
		let clientSecret = vscode.workspace.getConfiguration("checkmarxAST").get("client-secret") as string;
		let config = new CxScanConfig.CxScanConfig();
		config.clientId = clientID;
		config.clientSecret = clientSecret;
		config.baseUri = baseURI;
		config.tenant = tenant;
		return config;
	}

	public getScanList() {
		let cx = new CxAuth.CxAuth(this.getAstConfiguration());
		return cx.scanList();
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
	async loadResults(scanID: string) {
		let cx = new CxAuth.CxAuth(this.getAstConfiguration());
		const resultData = await cx.getResults(scanID,"json","ast-results",__dirname);
		this.refresh();
		console.log(resultData);
	}

	async resultsExist(scanID: string) {
		let cx = new CxAuth.CxAuth(this.getAstConfiguration());
		const result = await cx.getResultsList(scanID);
		console.log(result);
		if(result.length>20) {
			return true;
		}
		else{
		return false;
		}
		
	}

	private loadScanList() {
		this.getScanList().then((scans) => {
			this.scanList = scans.scanObjectList;
			let filterList: Array<CxScan.default> = [];
			for( var value of this.scanList){
				if(value.Status === "Completed" && this.resultsExist(value.ID)) {
					this.scanID = value.ID;
					this.loadResults(this.scanID);
					break;
				}

			}

			this.scanList = filterList;
			this.refresh();
		}).catch((res) => {
			vscode.window.showInformationMessage('Error communicating with AST server!');
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		if(!this.scanID){
			this.loadScanList();
		}
		console.log("GETTING HTML FOR VIEW");
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<style type="text/css">
					.panel {
						content: "";
						display: table; 
						clear: both;
					}
					.labelField {
						float: left;
						padding: .3rem .5rem;
						width: 3rem;
						text-align: right;
					}
					.ctrlField {
						float: left;
						padding: .3rem .5rem;
						width: 8rem;
					}
					select {
						width: 12rem;
					}
					.loadScanBtn {
						width: 8rem;
					}
				</style>
			</head>
			<body>
				<!-- The Scan List -->
				<div class="panel">
					<div class="labelField">
						Scans
					</div>
					<div class="ctrlField">
				 <input type="text" id="scanIDTest" value="${this.scanID}">Please enter scanID</input>
					</div>
				</div>
				<!-- The "Load" button -->
				<div class="panel">
					<div class="labelField">
						&nbsp;
					</div>
					<script>
					const vscode = acquireVsCodeApi();
					function loadScan() {
						vscode.postMessage({
							command: 'loadScan',
							scanID: scanID
						})
					}
					function loadASTResults() {
						let scanID =document.getElementById("scanIDTest").value
						vscode.postMessage({
							command: 'loadASTResults',
							scanID: scanID
						})
					}
    		</script>
				
					<div class="ctrlField">
						<input id="loadScanBtn"
									 onclick="loadASTResults()"
									 type="button" 
									 value="Load" 
									 class="loadScanBtn"/>
					</div>
				</div>
				
			</body>
		</html>
		`;
	}
}


