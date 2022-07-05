import path = require("path");
import * as vscode from "vscode";
import { AstResult } from "./models/results";
import { Details } from "./utils/details";
import { getNonce } from "./utils/utils";

export class AstDetailsDetached implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private result: AstResult,
    private context:vscode.ExtensionContext,
    private loadChanges:boolean,
  ) {}

  public getWebView() {
    return this._view;
  }

  public setResult(result:AstResult){
    this.result=result;
  }

  public setLoad(loadChanges:boolean){
    this.loadChanges=loadChanges;
  }

  public getLoad():boolean{
    return this.loadChanges;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = await this.getDetailsWebviewContent(
      webviewView.webview
    );
  }

  public loadDecorations(
    filePath: string,
    startLine: number,
    startColumn: number,
    fieldLength: number
  ) {
    const folder = vscode.workspace.workspaceFolders![0];
    // Needed because vscode uses zero based line number
    const column = startColumn > 0 ? +startColumn - 1 : 1;
    const line = startLine > 0 ? +startLine - 1 : 1;
    let length = column + +fieldLength;
    const startPosition = new vscode.Position(line, column);
    const endPosition = new vscode.Position(line, length);

  
    const path = vscode.Uri.joinPath(folder.uri, filePath);
    vscode.workspace.openTextDocument(path).then((doc) => {
      vscode.window
        .showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
        })
        .then((editor) => {
          editor.selections = [new vscode.Selection(startPosition, endPosition)];
          var range = new vscode.Range(startPosition, endPosition);
          editor.revealRange(range);
        });
    });
  }

  async getDetailsWebviewContent(webview: vscode.Webview) {
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
    const scaDetails = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "sca.css")
    );
    const severityPath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, this.result.getIcon())
    );
    const cxPath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxIcon())
    );
    const scaAtackVector = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxScaAtackVector())
    );
    const scaComplexity = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxScaComplexity())
    );
    const scaAuthentication = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxAuthentication())
    );
    const scaConfidentiality = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxConfidentiality())
    );
    const scaIntegrity = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxIntegrity())
    );
    const scaAvailability = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxAvailability())
    );
    const scaUpgrade = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxUpgrade())
    );
    const scaUrl = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri,  this.result.getCxUrl())
    );
    
    const nonce = getNonce();
    const selectClassname = "select-"+this.result.severity.toLowerCase();
    const html = new Details(this.result,this.context);
	  return `<!DOCTYPE html>
			<html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleResetUri}" rel="stylesheet">
          <link href="${styleVSCodeUri}" rel="stylesheet">
          <link href="${styleMainUri}" rel="stylesheet">
          <link href="${styleDetails}" rel="stylesheet">
          <link href="${scaDetails}" rel="stylesheet">
          <title>
            Checkmarx
          </title>
        </head>
        <div id="main_div">
          ${
            this.result.type!=="sca"?
              html.header(severityPath)
            :""
          }
          ${
            this.result.type!=="sca"?
              html.triage(selectClassname)
            :""
          }
          ${
            this.result.type==="sast"?
              html.tab(html.generalTab(cxPath),html.detailsTab(), html.loader(),"General","Learn More","Changes")
            :
            this.result.type==="sca"?
              html.scaView(severityPath,scaAtackVector,scaComplexity,scaAuthentication,scaConfidentiality,scaIntegrity,scaAvailability,scaUpgrade,scaUrl)
            :
              html.tab(html.generalTab(cxPath),html.detailsTab(),"","General","Learn More","")
          }
        </div>
        <script nonce="${nonce}" src="${scriptUri}">
        </script>	
			</html>`;
  }
}