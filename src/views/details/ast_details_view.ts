import path = require("path");
import * as vscode from "vscode";
import { Logs } from "../../common/logs";
import { AstResult } from "../../results/results";
import { getNonce } from "../../utils";

export class AstDetailsDetached implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly result: AstResult,
  ) {}

  public getWebView() {
    return this._view;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // Setup the WV callbacks
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
  }

  

  private sastDetails(sastNodes: any[]) {
    let html = ``;
    sastNodes.forEach((node) => {
      html += `<li> <a href="#" 
		  class="ast-node"
		  data-filename="${node.fileName}" data-line="${node.line}" data-column="${node.column}"
		  data-fullName="${node.fullName}" data-length="${node.length}">${node.fileName} [${node.line}:${node.column}]</a></li>`;
    });
    return html;
  }

  getDetailsWeviewContent(
    webview: vscode.Webview,
    inSeverityPath: string
  ) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
    );

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
    );
    const styleDetails = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "details.css")
    );
    const severityPath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, inSeverityPath)
    );
    const attackVector = this.sastDetails(this.result.sastNodes);
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" style-src ${
          webview.cspSource
        }; script-src 'nonce-${nonce}';">

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
						<td class="details_td">
						<div class="tooltip">
							<span class="details">
								Severity
								<span class="tooltiptext">
									HIGH, MEDIUM, INFO or LOW
								</span>
							</span>
							</div>
								
						</td>
						<td class="name_td">
								<span class="details">
								${this.result.severity}
										</span>
						</td>
					</tr>
					<tr>
						<td class="details_td">
							<h3 class="subtitle_details"> 
								<strong> 
									Details
								</strong>
							</h3>
						</td>
					</tr>	
						<tr>
						<td class="name_td">
								<span class="details">
								Details text that will be visible when including the latest version of wrapper
								</span>
						</td>
						</tr>				
					</tbody>
				</table>
				<hr class="division"/>
				<table class="content_table" >
					<tbody>
					<tr>
						<td class="myrowlong">
							<h3 class="subtitle"> 
								<strong> 
									Atack Vector
								</strong>
							</h3>
						</td>
					</tr>	
					<tr>
						<td class="myrowlong">
							<ol>
							${attackVector}
							</ol>
						</td>
					</tr>				
					</tbody>
				</table>
			</body>
			</html>`;
  }
}