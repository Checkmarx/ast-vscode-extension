import * as vscode from 'vscode';
import * as CxAuth from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxAuth";
import * as CxScanConfig from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScanConfig";
import * as CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScan";
import * as path from 'path';
import * as fs from 'fs';
import { CxResultType } from '@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxResultType';

export class AstProjectBindingViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'astProjectView';
	private _view?: vscode.WebviewView;
	private projectID: string = "";
	private scanID: string = "";
	private projectList: Array<any> = [];
	private scanList: Array<any> = [];
	
	constructor(
		private readonly _extensionUri: vscode.Uri
	) { 
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

	public getProjectList() {
		let cx = new CxAuth.CxAuth(this.getAstConfiguration());
		return cx.projectList();
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
				case 'pickedProject':
					this.projectID = data.projectID;
					this.scanID = "";
					this.loadScanList();
					break;
				case 'pickedScan':
					this.scanID = data.scanID;
					break;
				case 'loadScan':
					vscode.window.showInformationMessage('Loading Results data!');
					this.loadResults(this.scanID);
					vscode.window.showInformationMessage('Results data Loaded!');
					
					// Do something....
					break;
			}
		});
		// Fetch the current project list
		this.getProjectList().then((projects) => {
			this.projectList = projects.scanObjectList;
		}).then(() => {
			webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		}).catch((res) => {
			vscode.window.showInformationMessage('Error communicating with AST server!');
		});		
	}
	async loadResults(scanID: string) {
		let cx = new CxAuth.CxAuth(this.getAstConfiguration());
		const resultData = await cx.getResults(scanID,"json","ast-results",__dirname);
		this.refresh();
		console.log(resultData);
	}

	private loadScanList() {
		this.getScanList().then((scans) => {
			this.scanList = scans.scanObjectList;
			let filterList: Array<CxScan.default> = [];
			// Filter for the currently selected project
			this.scanList.forEach((value) => {
				if (value.ProjectID === this.projectID) {
					const d = new Date(value.CreatedAt);
					value.CreatedAt = d.toLocaleDateString();
					value.CreatedAt += " " + d.toLocaleTimeString();
					filterList.push(value);
				}
			});
			this.scanList = filterList;
			this.refresh();
		}).catch((res) => {
			vscode.window.showInformationMessage('Error communicating with AST server!');
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		console.log("GETTING HTML FOR VIEW");
		let html = `
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
					<div class="ctrlField">`;
			if (this.scanList.length > 0) {
				html += `<select onchange="pickedScan(this.value)">`;
				html += `  <option value="0">Choose Scan</option>`;			
			} else {
				html += `<select disabled>`;
				html += `  <option value="0">Choose Project First</option>`;			
			}
			for (let result of this.scanList) {
				let scanID = result.ID;
				let date = result.CreatedAt;
				if(this.scanID === result.ID) {
					html += `  <option value="${scanID}" selected>${date}</option>`;					
				} else {
					html += `  <option value="${scanID}">${date}</option>`;
				}
			}
			html +=	`
						</select>
					</div>
				</div>
				<!-- The "Load" button -->
				<div class="panel">
					<div class="labelField">
						&nbsp;
					</div>
					<div class="ctrlField">
						<input id="loadScanBtn"
									 onclick="loadScan()"
									 type="button" 
									 value="Load" 
									 disabled
									 class="loadScanBtn"/>
					</div>
				</div>
				<script>
					const vscode = acquireVsCodeApi();
					function pickedProject(projectID) {	
						vscode.postMessage({
							command: 'pickedProject',
							projectID: projectID
						})
					}
					function pickedScan(scanID) {	
						if (scanID != "0") {
							document.getElementById('loadScanBtn').removeAttribute('disabled');
						} else {
							document.getElementById('loadScanBtn').setAttribute('disabled', true);
						}
						vscode.postMessage({
							command: 'pickedScan',
							scanID: scanID
						})
					}
					function loadScan() {
						vscode.postMessage({
							command: 'loadScan'
						})
					}
    		</script>
			</body>
		</html>
		`;
		return html;
	}
}