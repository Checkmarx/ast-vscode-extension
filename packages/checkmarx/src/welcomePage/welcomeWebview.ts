import * as vscode from "vscode";
import { getNonce } from "@checkmarx/vscode-core/out/utils/utils";
import { constants } from "@checkmarx/vscode-core/out/utils/common/constants";
import { ThemeUtils } from "@checkmarx/vscode-core/out/utils/themeUtils";
import { MediaPathResolver } from "@checkmarx/vscode-core/out/utils/mediaPathResolver";
import { getMessages } from "@checkmarx/vscode-core/out/config/extensionMessages";



export class WelcomeWebview {
  private static generateHtml(
    bootstrapCssUri: vscode.Uri,
    scannerImgUri: vscode.Uri,
    aiBoxinfo: vscode.Uri,
    doubleCheckUri: vscode.Uri,
    cssUri: vscode.Uri,
    jsUri: vscode.Uri,
    nonce: string,
    isAiMcpEnabled: boolean,
    panel: vscode.WebviewPanel,
    productName: string
  ): string {
    return `
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
                  <input
                    id="aiFeatureToggle"
                    type="checkbox"
                    class="status-icon-checkbox hidden"
                    aria-label="Toggle real-time scanners"
                    title="Toggle real-time scanners"
                  />
                </div>
                <span class="card-title">Code Smarter with ${productName}</span>
              </div>
              <ul class="card-list">
                <li>Get instant security feedback as you code.</li>
                <li>See suggested fixes for vulnerabilities across open source, config, and code.</li>
                <li>Fix faster with intelligent, context-aware remediation inside your IDE.</li>
                ${isAiMcpEnabled ? '<li>Checkmarx MCP Installed automatically - no need for manual integration</li>' : ''}
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
              <li>Run SAST, SCA, IaC, Container & Secrets scans.</li>
              <li>Create a new Checkmarx branch from your local workspace.</li>
              <li>Preview or rescan before committing.</li>
              <li>Triage & fix issues directly in the editor.</li>
            </ul>
            <div style="margin-top: 40px; padding-left: 24px;">
              <button id="closeButton" style="
                display: flex;
                align-items: center;
                gap: 8px;
                background: transparent;
                border: none;
                color: #0E9BF7;
                cursor: pointer;
                font-size: 14px;
                padding: 0;">
                <img src="${doubleCheckUri}" alt="Double check" width="16" height="16" style="color: currentColor;" />
                Mark Done
              </button>
            </div>
          </div>
          <div class="right-section">
            <img src="${scannerImgUri}" alt="AI Example" />
          </div>
        </div>
        <script nonce="${nonce}" src="${jsUri}"></script>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();

          // Initial state check
          vscode.postMessage({ type: 'getAiFeatureState' });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'setAiFeatureState') {
              const mcpItem = document.getElementById('mcpStatusItem');
              if (mcpItem) {
                mcpItem.style.display = message.enabled ? 'list-item' : 'none';
              }
            }
          });

          document.getElementById('closeButton').addEventListener('click', () => {
            vscode.postMessage({ type: 'close' });
          });
        </script>
      </body>
      </html>
    `;
  }

  public static async show(context: vscode.ExtensionContext, isAiMcpEnabled: boolean) {
    const panel = vscode.window.createWebviewPanel(
      "checkmarxWelcome",
      "Welcome to Checkmarx",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.file(MediaPathResolver.getCoreMediaPath())
        ]
      }
    );

    const bootstrapCssUri = panel.webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("bootstrap", "bootstrap.min.css"))
    );

    const scannerImgUri = panel.webview.asWebviewUri(
      vscode.Uri.file(
        MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("welcomePageScanner_light.svg", "welcomePageScanner.svg"))
      )
    );

    const aiBoxinfo = panel.webview.asWebviewUri(
      vscode.Uri.file(
        MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("cxAIError_light.svg", "cxAIError.svg"))
      )
    );


    const doubleCheckUri = panel.webview.asWebviewUri(
      vscode.Uri.file(
        MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("double-check_light.svg", "double-check.svg"))
      )
    );

    const cssUri = panel.webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("welcomePage.css"))
    );

    const jsUri = panel.webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("welcomePage.js"))
    );

    const nonce = getNonce();

    const messages = getMessages();
    const productName = messages.productName;

    const scannerConfigKeys = [
      `${constants.getOssRealtimeScanner()}.${constants.activateOssRealtimeScanner}`,
      `${constants.getAscaRealtimeScanner()}.${constants.activateAscaRealtimeScanner}`,
      `${constants.getSecretsScanner()}.${constants.activateSecretsScanner}`,
      `${constants.getContainersRealtimeScanner()}.${constants.activateContainersRealtimeScanner}`,
      `${constants.getIacRealtimeScanner()}.${constants.activateIacRealtimeScanner}`
    ];

    const config = vscode.workspace.getConfiguration();

    // Set initial HTML using the reusable function
    panel.webview.html = this.generateHtml(
      bootstrapCssUri,
      scannerImgUri,
      aiBoxinfo,
      doubleCheckUri,
      cssUri,
      jsUri,
      nonce,
      isAiMcpEnabled,
      panel,
      productName
    );

    // Listen for theme changes and refresh the webview content
    const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      // Regenerate all URIs with new theme-appropriate icons
      const newScannerImgUri = panel.webview.asWebviewUri(
        vscode.Uri.file(
          MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("welcomePageScanner_light.svg", "welcomePageScanner.svg"))
        )
      );

      const newAiBoxinfo = panel.webview.asWebviewUri(
        vscode.Uri.file(
          MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("cxAIError_light.svg", "cxAIError.svg"))
        )
      );

      const newDoubleCheckUri = panel.webview.asWebviewUri(
        vscode.Uri.file(
          MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("double-check_light.svg", "double-check.svg"))
        )
      );

      // Regenerate HTML with new theme-appropriate icons using the reusable function
      panel.webview.html = this.generateHtml(
        bootstrapCssUri,
        newScannerImgUri,
        newAiBoxinfo,
        newDoubleCheckUri,
        cssUri,
        jsUri,
        nonce,
        isAiMcpEnabled,
        panel,
        productName
      );
    });

    // Dispose theme listener when panel is disposed
    panel.onDidDispose(() => {
      themeChangeDisposable.dispose();
    });

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "getAiFeatureState") {
        try {
          const isEnabled = isAiMcpEnabled;
          const safeEnabled = isEnabled === true;

          const allScannersEnabled = scannerConfigKeys.every(key =>
            config.get<boolean>(key, false)
          );

          const isFirstVisit = context.globalState.get<boolean>(
            "cxFirstWelcome",
            false
          );

          if (isFirstVisit) {
            if (safeEnabled && !allScannersEnabled) {
              for (const key of scannerConfigKeys) {
                await config.update(key, true, vscode.ConfigurationTarget.Global);
              }
            } else if (!safeEnabled) {
              for (const key of scannerConfigKeys) {
                await config.update(key, false, vscode.ConfigurationTarget.Global);
              }
            }

            await context.globalState.update("cxFirstWelcome", true);

            panel.webview.postMessage({
              type: "setAiFeatureState",
              enabled: safeEnabled,
              scannersSettings: safeEnabled,
            });
          } else {
            panel.webview.postMessage({
              type: "setAiFeatureState",
              enabled: safeEnabled,
              scannersSettings: allScannersEnabled,
            });
          }
        } catch (e) {
          console.error("Error retrieving AI state:", e);
          panel.webview.postMessage({
            type: "setAiFeatureState",
            enabled: false,
            scannersSettings: false,
          });
        }
      } else if (message.type === 'close') {
        panel.dispose();
      } else if (message.type === 'changeAllScannersStatus') {
        try {
          const status = message.value;
          for (const key of scannerConfigKeys) {
            await config.update(key, status, vscode.ConfigurationTarget.Global);
          }
        } catch (e) {
          console.error("Error updating scanner settings:", e);
        }
      }
    });
  }
}

