import * as vscode from "vscode";
import { getNonce } from "../utils/utils";
import { cx } from "../cx";

export class WelcomeWebview {
  public static show(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
      "checkmarxWelcome",
      "Welcome to Checkmarx",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    const scannerImgUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "icons",
        "welcomePageScanner.svg"
      )
    );

    const checkPngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "icons",
        "tabler-icon-check.png"
      )
    );

    const uncheckPngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "icons",
        "tabler-icon-uncheck.png"
      )
    );

    const cssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "media", "welcomePage.css")
    );

    const jsUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "media", "welcomePage.js")
    );

    const nonce = getNonce();

    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Welcome</title>
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'none'; style-src 'unsafe-inline' ${panel.webview.cspSource}; script-src 'nonce-${nonce}'; img-src https: data: vscode-resource:;">
        <link rel="stylesheet" href="${cssUri}">
      </head>
      <body>
        <div class="welcome-container">
          <div class="left-section">
            <h1>Welcome to Checkmarx</h1>
            <div class="subtitle-wrapper">
            <p class="subtitle">
              Checkmarx AI offers immediate threat detection and assists you in preventing vulnerabilities before they arise.
            </p>
            </div>


            <div class="feature-card" id="aiFeatureCard">
              <div class="card-header">
               <img
  id="aiFeatureIcon"
  class="status-icon"
  src=""
  data-check="${checkPngUri}"
  data-uncheck="${uncheckPngUri}"
  alt="AI status icon"
  style="visibility: hidden"
/>
                <span class="card-title">Code Smarter with AI</span>
              </div>
              <ul class="card-list">
                <li>Get instant security feedback as you code.</li>
                <li>See suggested fixes for vulnerabilities across open source, config, and code.</li>
                <li>Fix faster with intelligent, context-aware remediation inside your IDE.</li>
              </ul>
            </div>

            <ul class="main-feature-list">
              <li>Run SAST, SCA, IaC & Secrets scans.</li>
              <li>Create a new Checkmarx branch from your local workspace.</li>
              <li>Preview or rescan before committing.</li>
              <li>Triage & fix issues directly in the editor.</li>
            </ul>
          </div>

          <div class="right-section">
            <img src="${scannerImgUri}" alt="AI Example" class="illustration" />
          </div>
        </div>

        <script nonce="${nonce}" src="${jsUri}"></script>
      </body>
      </html>
    `;
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "getAiFeatureState") {
        try {
          const isEnabled = await cx.isAiMcpServerEnabled();

          panel.webview.postMessage({
            type: "setAiFeatureState",
            enabled: isEnabled,
          });
        } catch (e) {
          console.error("Error retrieving AI state:", e);
          panel.webview.postMessage({
            type: "setAiFeatureState",
            enabled: false,
          });
        }
      }
    });
  }
}
