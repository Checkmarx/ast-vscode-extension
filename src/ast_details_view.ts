import * as vscode from "vscode";
import { AstResult } from "./models/results";
import { getNonce } from "./utils/utils";

export class AstDetailsDetached implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly result: AstResult
	) { }

	public getWebView() {
		return this._view;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};
		webviewView.webview.html = this.getDetailsWebviewContent(webviewView.webview);

	}

	public loadDecorations(filePath: string, line: number, startColumn: number, length: number) {
		const folder = vscode.workspace.workspaceFolders![0];
		// Needed because vscode uses zero based line number
		const position = new vscode.Position(line > 0 ? +line-1 : 1 ,startColumn > 0 ? +startColumn-1 : 1 );
		const finalPosition = new vscode.Position(line > 0 ? +line-1 : 1 ,startColumn > 0 ? +(startColumn+length-1) : 1 );
		const path = vscode.Uri.joinPath(folder.uri, filePath);
		vscode.workspace.openTextDocument(path).then(doc => 
		{
			vscode.window.showTextDocument(doc,{
				viewColumn: vscode.ViewColumn.One
			}).then(editor => 
			{
				editor.selections = [new vscode.Selection(position,finalPosition)]; 
				var range = new vscode.Range(position, position);
				editor.revealRange(range);
			});
		});
	}

	getDetailsWebviewContent(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'view.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
		const styleDetails = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "details.css"));
		const severityPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, this.result.getIcon()));
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
			
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<link href="${styleDetails}" rel="stylesheet">
				<title>Checkmarx</title>
			</head>
			<body>
				<table class="header_table" >
					<tbody>
						<tr>
							<td class="logo_td">
								<img class="logo" src="${severityPath}" alt="CxLogo"/>
							</td>
							<td class="title_td">
								<h2> ${this.result.label.replaceAll("_", " ")}  </h2>
							</td>
						</tr>
					</tbody>
				</table>
				<hr class="division"/>
				<table class="content_table" >
					<tbody>
					<tr>
						<td class="details_td">
							<h3 class="subtitle"> 
								<strong> 
									Overview 
								</strong>
							</h3>
						</td>
					</tr>	
					<tr>
						<td class="details_td">
								<div class="tooltip">
									<span class="details">
										Engine
											<span class="tooltiptext">
												sast or infrastructure
											</span>
									</span>
								</div>
						</td>
						<td class="name_td">
						<span class="details">
							${this.result.type}
								</span>
						</td>
					</tr>			
					<tr>
						<td class="details_td">
						<span class="details">
						Language
								</span>
								
						</td>
						<td class="name_td">
						<span class="details">
							${this.result.language}
								</span>
						</td>
					</tr>		
					<tr>
						<td class="details_td">
						<span class="details">
						Status
								</span>
								
						</td>
						<td class="name_td">
						<span class="details">
						${this.result.status}
								</span>
						</td>
					</tr>
					<tr>
						<td>
							<h3 class="subtitle_details"> 
								<strong> 
									Description
								</strong>
							</h3>
						</td>
					</tr>	
						<tr>
						<td>
								<span class="details">
									${this.result.data.description ? this.result.data.description : 'No description available.'}
								</span>
						</td>
						</tr>				
					</tbody>
				</table>
				<hr class="division"/>
				<table class="content_table" >
					<tbody>
					${this.result.getHtmlDetails()}			
					</tbody>
				</table>	
				<script nonce="${nonce}" src="${scriptUri}"></script>	
			</body>
			</html>`;
	}
}
