import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {AstResult} from "./models/results";
import {Details} from "./utils/interface/details";
import {getNonce} from "./utils/utils";

export class AstDetailsDetached implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private result: AstResult,
        private context: vscode.ExtensionContext,
        private loadChanges: boolean,
    ) {
    }

    public getWebView() {
        return this._view;
    }

    public setResult(result: AstResult) {
        this.result = result;
    }

    public setLoad(loadChanges: boolean) {
        this.loadChanges = loadChanges;
    }

    public getLoad(): boolean {
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

    public async loadDecorations(
        filePath: string,
        startLine: number,
        startColumn: number,
        fieldLength: number
    ) {
        let fileOpened = false;
        const folder = vscode.workspace.workspaceFolders![0];
        // Needed because vscode uses zero based line number
        const column = startColumn > 0 ? +startColumn - 1 : 1;
        const line = startLine > 0 ? +startLine - 1 : 1;
        let length = column + +fieldLength;
        const startPosition = new vscode.Position(line, column);
        const endPosition = new vscode.Position(line, length);


        if (isFilePresentInRoot(filePath, folder.uri.fsPath)) {
            const decorationPath = vscode.Uri.joinPath(folder.uri, filePath);
            this.openAndDecorateFile(decorationPath, startPosition, endPosition);
            fileOpened = true;
        } else {
            const filesInDirectory = await vscode.workspace.findFiles("**/*" + filePath);
            for (const file of filesInDirectory) {
                this.openAndDecorateFile(vscode.Uri.file(file.path), startPosition, endPosition);
                fileOpened = true;
            }
        }
        if (!fileOpened) {
            vscode.window.showErrorMessage(`File ${filePath} not found in workspace`);
        }
    }

    private openAndDecorateFile(decorationFilePath: vscode.Uri, startPosition: vscode.Position, endPosition: vscode.Position) {
        vscode.workspace.openTextDocument(decorationFilePath).then((doc) => {
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
        const severityPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, this.result.getIcon())
        );
        const cxPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, this.result.getCxIcon())
        );
        const nonce = getNonce();
        const selectClassname = "select-" + this.result.severity.toLowerCase();
        const html = new Details(this.result, this.context);
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
        <div id="main_div">
          ${html.header(severityPath)}
          ${html.triage(selectClassname)}
          ${html.tab(html.generalTab(cxPath), html.detailsTab(), html.loader(), "General", "Learn More", "Changes")}
        </div>
        <script nonce="${nonce}" src="${scriptUri}">
        </script>	
			</html>`;
    }
}


function isFilePresentInRoot(filePath: string, fsPath: string) {
    return fs.existsSync(path.join(fsPath, filePath));
}
