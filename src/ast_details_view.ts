import * as vscode from "vscode";
import { AstResult } from "./models/results";
import { getNonce } from "./utils/utils";

export class AstDetailsDetached implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly result: AstResult
  ) {}

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
    webviewView.webview.html = this.getDetailsWebviewContent(
      webviewView.webview
    );
  }

  public loadDecorations(
    filePath: string,
    line: number,
    startColumn: number,
    length: number
  ) {
    const folder = vscode.workspace.workspaceFolders![0];
    // Needed because vscode uses zero based line number
    const position = new vscode.Position(
      line > 0 ? +line - 1 : 1,
      startColumn > 0 ? +startColumn - 1 : 1
    );
    const finalPosition = new vscode.Position(
      line > 0 ? +line - 1 : 1,
      startColumn > 0 ? +(startColumn + length - 1) : 1
    );
    const path = vscode.Uri.joinPath(folder.uri, filePath);
    vscode.workspace.openTextDocument(path).then((doc) => {
      vscode.window
        .showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
        })
        .then((editor) => {
          editor.selections = [new vscode.Selection(position, finalPosition)];
          var range = new vscode.Range(position, position);
          editor.revealRange(range);
        });
    });
  }

  getDetailsWebviewContent(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "view.js")
    );
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
      vscode.Uri.joinPath(this._extensionUri, this.result.getIcon())
    );
    const nonce = getNonce();

	const selectClassname="select_"+this.result.severity.toLowerCase();

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
				<div class="ast-triage">
					<select class="status" disabled>
						<option>${this.result.status}</option>
					</select>
					<select onchange="this.className=this.options[this.selectedIndex].className" class=${selectClassname}>					
						<option class="select_high" ${this.result.severity==="HIGH"?"selected=\"selected\"":""}>HIGH</option>
						<option class="select_medium" ${this.result.severity==="MEDIUM"?"selected=\"selected\"":""}>MEDIUM</option>
						<option class="select_low" ${this.result.severity==="LOW"?"selected=\"selected\"":""}>LOW</option>
						<option class="select_info" ${this.result.severity==="INFO"?"selected=\"selected\"":""}>INFO</option>
					</select>
					<select class="state">
						<option ${this.result.state==="TO_VERIFY"?"selected=\"selected\"":""}>To Verify</option>
						<option ${this.result.state==="NOT_EXPLOITABLE"?"selected=\"selected\"":""}>Not Exploitable</option>
						<option ${this.result.state==="CONFIRMED"?"selected=\"selected\"":""}>Confirmed</option>
						<option ${this.result.state==="URGENT"?"selected=\"selected\"":""}>Urgent</option>
					</select>
					<button class="submit"/>
				</div>
				<h3>
					Description
				</h3>
				<hr class="division"/>
					<span class="details">
					${
            this.result.data.description
              ?
                "<p>" + this.result.data.description + "</p>"
              : 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laboru. <a href="https://ast-master.dev.cxast.net/results/f00b4b40-3388-441b-8988-01933d1ec21c/59f567d6-f1f4-41bd-9a9f-e8b1abbd3012/sast/description/759/13248903817325187040">Read More</a>'
          }
				  ${this.result.data.value ? this.result.getKicsValues() : ""}
					</span>
					${this.result.getTitle()}
					<table class="details_table">
						<tbody>
							${this.result.getHtmlDetails()}
						</tbody>
					</table>
				<script nonce="${nonce}" src="${scriptUri}">
				</script>	
			</body>
			</html>`;
  }
}
