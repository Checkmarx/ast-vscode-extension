import * as vscode from "vscode";
import { getNonce } from "../utils/utils";
import { cx } from "../cx";

export class WelcomeWebview {
  public static async show(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
      "checkmarxWelcome",
      "Welcome to Checkmarx",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const bootstrapCssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "bootstrap",
        "bootstrap.min.css"
      )
    );

    const scannerImgUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "icons",
        "welcomePageScanner.svg"
      )
    );

    const aiBoxinfo = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "icons",
        "cxAIError.svg"
      )
    );

    const checkSvgUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "icons",
        "tabler-icon-check.svg"
      )
    );

    const uncheckSvgUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "icons",
        "tabler-icon-uncheck.svg"
      )
    );

    const cssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "media", "welcomePage.css")
    );

    const jsUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "media", "welcomePage.js")
    );

    const nonce = getNonce();

    const configKey =
      "Checkmarx Open Source Realtime Scanner (OSS-Realtime).Activate OSS-Realtime";
    const config = vscode.workspace.getConfiguration();
    let isOssEnabled = config.get<boolean>(configKey, false);

    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Welcome</title>
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'none'; style-src 'unsafe-inline' ${panel.webview.cspSource}; script-src 'nonce-${nonce}'; img-src https: data: vscode-resource:;">
        <link href="${bootstrapCssUri}" rel="stylesheet">
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
                <div class="status-icon" id="aiFeatureWrapper">
                  <div
                    id="aiFeatureLoader"
                    class="spinner-border spinner-border-sm text-info"
                    role="status"
                    style="width: 16px; height: 16px;"
                  >
                    <span class="visually-hidden">Loading...</span>
                  </div>
                  <img
                    id="aiFeatureCheckIcon"
                    class="status-icon-img hidden"
                    src="${checkSvgUri}"
                    alt="Checked Icon"
                  />
                  <img
                    id="aiFeatureUncheckIcon"
                    class="status-icon-img hidden"
                    src="${uncheckSvgUri}"
                    alt="Unchecked Icon"
                  />
                </div>
                <span class="card-title">Code Smarter with AI</span>
              </div>
              <ul class="card-list">
                <li>Get instant security feedback as you code.</li>
                <li>See suggested fixes for vulnerabilities across open source, config, and code.</li>
                <li>Fix faster with intelligent, context-aware remediation inside your IDE.</li>
              </ul>
              <div class="ai-feature-box-wrapper hidden" id="aiFeatureBoxWrapper">
                <img
                  id="aiFeatureStatusBox"
                  class="hidden"
                  src="${aiBoxinfo}"
                  alt="AI Feature Box"
                />
              </div>
            </div>
            <ul class="main-feature-list">
              <li>Run SAST, SCA, IaC & Secrets scans.</li>
              <li>Create a new Checkmarx branch from your local workspace.</li>
              <li>Preview or rescan before committing.</li>
              <li>Triage & fix issues directly in the editor.</li>
            </ul>
          </div>
          <div class="right-section">
            <img src="${scannerImgUri}" alt="AI Example" />
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
          const safeEnabled = isEnabled === true;

          isOssEnabled = vscode.workspace
            .getConfiguration()
            .get<boolean>(configKey, false);

          panel.webview.postMessage({
            type: "setAiFeatureState",
            enabled: safeEnabled,
            ossSetting: safeEnabled ? isOssEnabled : false,
          });

          if (!safeEnabled && isOssEnabled) {
            await config.update(
              configKey,
              false,
              vscode.ConfigurationTarget.Global
            );
          }
        } catch (e) {
          console.error("Error retrieving AI state:", e);
          panel.webview.postMessage({
            type: "setAiFeatureState",
            enabled: false,
            ossSetting: false,
          });
        }
      }

      if (message.type === "setOssRealtimeEnabled") {
        await config.update(
          configKey,
          message.value,
          vscode.ConfigurationTarget.Global
        );
      }
    });

    const watcher = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(configKey)) {
        const updated = vscode.workspace
          .getConfiguration()
          .get<boolean>(configKey, false);
        panel.webview.postMessage({
          type: "setOssRealtimeEnabledFromSettings",
          value: updated,
        });
      }
    });

    panel.onDidDispose(() => {
      watcher.dispose();
    });
  }
}
