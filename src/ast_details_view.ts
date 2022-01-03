import * as vscode from "vscode";
import { AstResult } from "./models/results";
import { Details } from "./utils/details";
import { getNonce } from "./utils/utils";

export class AstDetailsDetached implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private result: AstResult
  ) {}

  public getWebView() {
    return this._view;
  }

  public setResult(result:AstResult){
    this.result=result;
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
    const selectClassname = "select_"+this.result.severity.toLowerCase();
    const html = new Details(this.result);

	  return `<!DOCTYPE html>
			<html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleResetUri}" rel="stylesheet">
          <link href="${styleVSCodeUri}" rel="stylesheet">
          <link href="${styleMainUri}" rel="stylesheet">
          <link href="${styleDetails}" rel="stylesheet">
          <title>
            Checkmarx
          </title>
        </head>
        <div>
          ${html.header(severityPath)}
          ${html.triage(selectClassname)}
          ${html.tab(html.generalTab(),html.changesTab(),html.detailsTab(),"General","Changes","Details")}
        </div>
        <script nonce="${nonce}" src="${scriptUri}">
        </script>	
			</html>`;
  }
}