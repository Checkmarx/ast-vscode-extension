import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AstResult } from "../../models/results";
import { Details } from "../../utils/interface/details";
import { getNonce } from "../../utils/utils";
import { messages } from "../../utils/common/messages";
import { cx } from "../../cx";
import { Logs } from "../../models/logs";
import CxMask from "@checkmarx/ast-cli-javascript-wrapper/dist/main/mask/CxMask";
import { GptResult } from "../../models/gptResult";
import { constants } from "../../utils/common/constants";
import { ThemeUtils } from "../../utils/themeUtils";
import { MediaPathResolver } from "../../utils/mediaPathResolver";

export class AstDetailsDetached implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private askKicsIcon;
  private kicsUserIcon;
  private themeChangeDisposable?: vscode.Disposable;

  constructor(
    private result: AstResult,
    private context: vscode.ExtensionContext,
    private loadChanges: boolean,
    private logs: Logs,
    private type?: string
  ) { }

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

  public getAskKicsIcon() {
    return this.askKicsIcon;
  }

  public getAskKicsUserIcon() {
    return this.kicsUserIcon;
  }

  public setupThemeChangeListener(webview: vscode.Webview) {
    // Dispose any existing theme listener
    if (this.themeChangeDisposable) {
      this.themeChangeDisposable.dispose();
    }

    // Listen for theme changes and refresh only the CodeBashing icon
    this.themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(async (theme) => {
      try {
        // Generate new CodeBashing icon URI for the current theme
        const codeBashingIcon = webview.asWebviewUri(
          vscode.Uri.file(
            MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("codeBashing_logoLightTheme.png", "codeBashing_logoDarkTheme.png"))
          )
        );

        // Send message to webview to update the icon
        webview.postMessage({
          command: 'updateThemeIcon',
          iconUri: codeBashingIcon.toString()
        });
      } catch (error) {
        console.error('Error updating icon on theme change:', error);
      }
    });

    // Register the disposable with the extension context
    this.context.subscriptions.push(this.themeChangeDisposable);
  }

  public disposeThemeListener() {
    if (this.themeChangeDisposable) {
      this.themeChangeDisposable.dispose();
      this.themeChangeDisposable = undefined;
    }
  }
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        vscode.Uri.file(MediaPathResolver.getCoreMediaPath())
      ],
    };
    webviewView.webview.html = await this.getDetailsWebviewContent(
      webviewView.webview
    );

    // Setup theme change listener
    this.setupThemeChangeListener(webviewView.webview);

    // Dispose theme listener when webview is disposed
    webviewView.onDidDispose(() => {
      this.disposeThemeListener();
    });
  }

  public async loadDecorations(
    filePath: string,
    startLine: number,
    startColumn: number,
    fieldLength: number
  ) {
    // Needed because vscode.workspace.workspaceFolders might be undefined if no workspace is opened
    try {
      let fileOpened = false;
      const folder = vscode.workspace.workspaceFolders?.[0];
      // Needed because vscode uses zero based line number
      const column = startColumn > 0 ? +startColumn - 1 : 1;
      const line = startLine > 0 ? +startLine - 1 : 1;
      const length = column + +fieldLength;
      const startPosition = new vscode.Position(line, column);
      const endPosition = new vscode.Position(line, length);

      if (isFilePresentInRoot(filePath, folder.uri.fsPath)) {
        const decorationPath = vscode.Uri.joinPath(folder.uri, filePath);
        this.openAndDecorateFile(decorationPath, startPosition, endPosition);
        fileOpened = true;
      } else {
        const filesInDirectory = await vscode.workspace.findFiles(
          "**/*" + filePath
        );
        for (const file of filesInDirectory) {
          this.openAndDecorateFile(
            vscode.Uri.file(file.path),
            startPosition,
            endPosition
          );
          fileOpened = true;
        }
      }
      if (!fileOpened) {
        vscode.window.showErrorMessage(messages.resultFileNotFound(filePath));
      }
    } catch (error) {
      vscode.window.showErrorMessage(messages.resultFileNotFound(filePath));
    }
  }

  private openAndDecorateFile(
    decorationFilePath: vscode.Uri,
    startPosition: vscode.Position,
    endPosition: vscode.Position
  ) {
    vscode.workspace.openTextDocument(decorationFilePath).then((doc) => {
      vscode.window
        .showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
        })
        .then((editor) => {
          editor.selections = [
            new vscode.Selection(startPosition, endPosition),
          ];
          const range = new vscode.Range(startPosition, endPosition);
          editor.revealRange(range);
        });
    });
  }

  async getDetailsWebviewContent(webview: vscode.Webview, type?: string) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("view.js"))
    );
    const scriptGptUri = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("gpt.js"))
    );
    const scriptJquery = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("jquery", "jquery-3.7.1.min.js"))
    );
    const scriptBootStrap = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("bootstrap", "bootstrap.min.js"))
    );
    const scriptHighlight = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("codeRenderers", "highlight.min.js"))
    );
    const scriptMarked = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("codeRenderers", "marked.min.js"))
    );
    const scriptShowdown = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("codeRenderers", "showdown.min.js"))
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("reset.css"))
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("vscode.css"))
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("main.css"))
    );
    const styleDetails = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("details.css"))
    );
    const scaDetails = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("sca.css"))
    );
    const styleGptUri = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("gpt.css"))
    );
    const styleBootStrap = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("bootstrap", "bootstrap.min.css"))
    );

    const severityPath = webview.asWebviewUri(
      vscode.Uri.file(this.result.getIcon())
    );
    const cxPath = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxIcon())
    );
    const scaAtackVector = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxScaAtackVector())
    );
    const scaComplexity = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxScaComplexity())
    );
    const scaAuthentication = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxAuthentication())
    );
    const scaConfidentiality = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxConfidentiality())
    );
    const scaIntegrity = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxIntegrity())
    );
    const scaAvailability = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxAvailability())
    );
    const scaUpgrade = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxUpgrade())
    );
    const scaUrl = webview.asWebviewUri(
      vscode.Uri.file(this.result.getCxUrl())
    );
    const kicsIcon = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("icons", "kics.png"))
    );
    const kicsUserIcon = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("icons", "userKics.png"))
    );

    const cxIcon = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("icon.png"))
    );

    const codeBashingIcon = webview.asWebviewUri(
      vscode.Uri.file(
        MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("codeBashing_logoLightTheme.png", "codeBashing_logoDarkTheme.png"))
      )
    );

    this.askKicsIcon = kicsIcon;
    this.kicsUserIcon = kicsUserIcon;

    const nonce = getNonce();
    const selectClassname = "select-" + this.result.severity.toLowerCase();
    // Verify if guided remediation is enabled for tenant
    const isAIEnabled = await cx.isAIGuidedRemediationEnabled(this.logs);
    const html = new Details(this.result, this.context, isAIEnabled);
    let masked: CxMask;
    if (this.result.type !== constants.sca && this.result.type !== constants.sast) {
      try {
        const gptResult = new GptResult(this.result, undefined);
        masked = await cx.mask(gptResult.filename);
        this.logs.info(
          `Masked Secrets by ${constants.aiSecurityChampion}: ` +
          (masked && masked.maskedSecrets ? masked.maskedSecrets.length : "0")
        );
      } catch (error) {
        this.logs.info(error);
      }
    }
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
          ${this.result.type !== constants.sca
        ? `<link href="${styleBootStrap}" rel="stylesheet">`
        : ""
      }
          ${this.result.type !== constants.sca
        ? `<link href="${styleGptUri}" rel="stylesheet">`
        : ""
      }
          <script nonce="${nonce}" src="${scriptJquery}"></script>
          <script nonce="${nonce}" src="${scriptBootStrap}"></script>
          <script nonce="${nonce}" src="${scriptHighlight}"></script>
          <script nonce="${nonce}" src="${scriptShowdown}"></script>
          <script nonce="${nonce}" src="${scriptMarked}"></script>
          <title>
            Checkmarx
          </title>
        </head>
        <div id="main_div">
          ${this.result.type !== constants.sca ? html.header(severityPath) : ""}
          ${this.result.type === constants.sast
        ? html.tab(
          html.generalTab(cxPath),
          html.detailsTab(),
          html.changes(selectClassname),
          messages.generalTab,
          messages.descriptionTab,
          messages.triageTab,
          messages.remediationExamplesTab,
          messages.noRemediationExamplesTab,
          isAIEnabled ? `${constants.aiSecurityChampion}` : "",
          isAIEnabled
            ? html.guidedRemediationSastTab(cxIcon, masked)
            : ""
        )
        : this.result.type === constants.sca
          ? '<body class="body-sca">' + html.scaHeader(severityPath) + html.tab(
            html.scaView(
              scaAtackVector,
              scaComplexity,
              scaAuthentication,
              scaConfidentiality,
              scaIntegrity,
              scaAvailability,
              scaUpgrade,
              scaUrl,
              this.type
            ) + "</body>",
            "",
            type !== constants.realtime ? html.changes(selectClassname) : "",
            messages.generalTab,
            "",
            type !== constants.realtime ? messages.triageTab : "",
            "",
            "",
            "",
            ""
          )
          : this.result.type === constants.scsSecretDetection
            ? html.tab(
              html.secretDetectiongeneralTab(),
              html.secretDetectionDetailsDescriptionTab(),
              html.secretDetectionDetailsRemediationTab(),
              messages.generalTab,
              messages.descriptionTab,
              messages.remediationExamplesTab,
              "",
              "",
              "",
              ""
            )
            : html.tab(
              html.generalTab(cxPath),
              "",
              html.changes(selectClassname),
              messages.generalTab,
              "",
              messages.triageTab,
              "",
              "",
              isAIEnabled ? `${constants.aiSecurityChampion}` : "",
              isAIEnabled ? html.guidedRemediationTab(kicsIcon, masked) : ""
            )
      }
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          window.codeBashingIconUri = "${codeBashingIcon}";
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>	
        <script nonce="${nonce}" src="${scriptGptUri}"></script>	
			</html>`;
  }
}

function isFilePresentInRoot(filePath: string, fsPath: string) {
  return fs.existsSync(path.join(fsPath, filePath));
}
