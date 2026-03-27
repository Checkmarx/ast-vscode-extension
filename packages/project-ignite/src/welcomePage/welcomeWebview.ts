import * as vscode from "vscode";
import { getNonce } from "@checkmarx/vscode-core/out/utils/utils";
import { constants } from "@checkmarx/vscode-core/out/utils/common/constants";
import { ThemeUtils } from "@checkmarx/vscode-core/out/utils/themeUtils";
import { MediaPathResolver } from "@checkmarx/vscode-core/out/utils/mediaPathResolver";
import { getMessages } from "@checkmarx/vscode-core/out/config/extensionMessages";
import { isIDE } from "@checkmarx/vscode-core/out/utils/utils";
import { commands } from "@checkmarx/vscode-core/out/utils/common/commandBuilder";

type WelcomeAiBannerScenario = "ok" | "switched" | "multiple" | "none";

interface WelcomeAiBannerState {
  scenario: WelcomeAiBannerScenario;
  defaultAssistantDisplayName?: string;
  autoSwitchedTo?: string;
}

export class WelcomeWebview {
  private static getWelcomeAiBannerState(): WelcomeAiBannerState {
    // Non-VS Code IDEs (Cursor, Windsurf, Kiro) have built-in AI assistants
    if (isIDE(constants.cursorAgent) || isIDE(constants.windsurfAgent) || isIDE(constants.windsurfNextAgent) || isIDE(constants.kiroAgent)) {
      return { scenario: "ok" };
    }
    const config = vscode.workspace.getConfiguration("checkmarxDeveloperAssist");
    const userChoice = config.get<string>("AI Assistant", "Copilot");
    const copilotAvailable = vscode.extensions.getExtension(constants.copilotChatExtensionId) !== undefined;
    const claudeAvailable = vscode.extensions.getExtension(constants.claudeChatExtensionId) !== undefined;
    const supportedAvailable: string[] = [];
    if (copilotAvailable) supportedAvailable.push("Copilot");
    if (claudeAvailable) supportedAvailable.push("Claude");
    const displayNames: Record<string, string> = { Copilot: "GitHub Copilot", Claude: "Claude Code" };
    const isPreferredAvailable = () => {
      if (userChoice === "Copilot") return copilotAvailable;
      if (userChoice === "Claude") return claudeAvailable;
      return false;
    };
    const defaultDisplayName = () => (userChoice in displayNames ? displayNames[userChoice] : userChoice);
    if (isPreferredAvailable()) return { scenario: "ok" };
    const n = supportedAvailable.length;
    if (n === 0) return { scenario: "none", defaultAssistantDisplayName: defaultDisplayName() };
    if (n === 1) return { scenario: "switched", defaultAssistantDisplayName: defaultDisplayName(), autoSwitchedTo: supportedAvailable[0] };
    return { scenario: "multiple", defaultAssistantDisplayName: defaultDisplayName() };
  }

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
    productName: string,
    banner: WelcomeAiBannerState | null
  ): string {
    const settingsCommandUri = "command:" + commands.openSettings + "?" + encodeURIComponent(JSON.stringify([commands.openSettingsArgsAiAssistant]));
    const bannerHtml = WelcomeWebview.getBannerHtml(banner, productName, settingsCommandUri);
    const disableAiFeature = !!banner && (banner.scenario === "none" || banner.scenario === "multiple");
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
        <div class="welcome-page-header">
          <h1>Welcome to Checkmarx Developer Assist</h1>
          <p class="welcome-tagline">Checkmarx Developer Assist offers immediate threat detection with standalone real-time scanners and assists you in preventing vulnerabilities before they arise.</p>
        </div>
        ${bannerHtml ? `<div class="welcome-banner-wrapper">${bannerHtml}</div>` : ""}
        <div class="welcome-frames-row">
          <div class="left-section">
            <div class="feature-card${disableAiFeature ? " feature-card-ai-disabled" : ""}" id="aiFeatureCard">
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
                    ${disableAiFeature ? " disabled" : ""}
                  />
                </div>
                <span class="card-title">Code Smarter with ${productName}</span>
              </div>
              <ul class="card-list">
                <li>Get instant security feedback as you code with real-time scanners.</li>
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
              <li>Run real-time SAST, SCA, IaC, Container & Secrets scans.</li>
              <li>Get immediate feedback as you type.</li>
              <li>Triage & fix issues directly in the editor.</li>
              <li>Standalone scanners - no backend connection required for scanning.</li>
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
            <img src="${scannerImgUri}" alt="AI Example" class="welcome-code-image" />
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

  private static getBannerHtml(banner: WelcomeAiBannerState | null, productName: string, settingsCommandUri: string): string {
    if (!banner || banner.scenario === "ok") return "";
    const settingsLink = `<a href="${settingsCommandUri}">Go to Settings → ${productName} →</a>`;
    if (banner.scenario === "switched") {
      const name = banner.defaultAssistantDisplayName || "Your chosen assistant";
      return `
            <div class="welcome-banner welcome-banner-info" role="status">
              <span class="welcome-banner-icon welcome-banner-icon-circle welcome-banner-icon-info">i</span>
              <div class="welcome-banner-body">
                <div class="welcome-banner-row"><strong>AI Assistant switched.</strong></div>
                <div class="welcome-banner-row">${name} was not found. ${productName} is now using a detected and supported AI Assistant automatically.</div>
              </div>
            </div>`;
    }
    if (banner.scenario === "multiple") {
      const name = banner.defaultAssistantDisplayName || "Your chosen assistant";
      return `
            <div class="welcome-banner welcome-banner-warning" role="alert">
              <span class="welcome-banner-icon welcome-banner-icon-circle">!</span>
              <div class="welcome-banner-body">
                <div class="welcome-banner-row"><strong>AI Assistant not connected.</strong></div>
                <div class="welcome-banner-row">${name} is not available. Multiple AI Assistants were detected in your IDE. Please select your preferred AI Assistant to continue using ${productName}.</div>
                <div class="welcome-banner-row">${settingsLink}</div>
              </div>
            </div>`;
    }
    if (banner.scenario === "none") {
      return `
            <div class="welcome-banner welcome-banner-warning" role="alert">
              <span class="welcome-banner-icon welcome-banner-icon-circle">!</span>
              <div class="welcome-banner-body">
                <div class="welcome-banner-row"><strong>MCP cannot be configured.</strong></div>
                <div class="welcome-banner-row">No supported AI Assistant was found in your IDE. Install a supported assistant (e.g.- GitHub Copilot or Claude Code) and select it in Settings to enable ${productName} MCP features.</div>
                <div class="welcome-banner-row">${settingsLink}</div>
              </div>
            </div>`;
    }
    return "";
  }

  public static async show(context: vscode.ExtensionContext, isAiMcpEnabled: boolean) {
    const panel = vscode.window.createWebviewPanel(
      "devAssistWelcome",
      "Welcome to Checkmarx Developer Assist",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableCommandUris: true,
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
        MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("cxDevAssistAIError_light.png", "cxDevAssistAIError.png"))
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

    let bannerState: WelcomeAiBannerState;
    try {
      bannerState = WelcomeWebview.getWelcomeAiBannerState();
    } catch {
      bannerState = { scenario: "none", defaultAssistantDisplayName: "Your chosen assistant" };
    }
    if (bannerState.scenario === "switched" && bannerState.autoSwitchedTo) {
      const devAssistConfig = vscode.workspace.getConfiguration("checkmarxDeveloperAssist");
      await devAssistConfig.update("AI Assistant", bannerState.autoSwitchedTo, vscode.ConfigurationTarget.Global);
    }

    const scannerConfigKeys = [
      `${constants.getOssRealtimeScanner()}.${constants.activateOssRealtimeScanner}`,
      `${constants.getAscaRealtimeScanner()}.${constants.activateAscaRealtimeScanner}`,
      `${constants.getSecretsScanner()}.${constants.activateSecretsScanner}`,
      `${constants.getContainersRealtimeScanner()}.${constants.activateContainersRealtimeScanner}`,
      `${constants.getIacRealtimeScanner()}.${constants.activateIacRealtimeScanner}`
    ];

    const config = vscode.workspace.getConfiguration();

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
      productName,
      bannerState
    );

    const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      const newScannerImgUri = panel.webview.asWebviewUri(
        vscode.Uri.file(
          MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("welcomePageScanner_light.svg", "welcomePageScanner.svg"))
        )
      );

      const newAiBoxinfo = panel.webview.asWebviewUri(
        vscode.Uri.file(
          MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("cxDevAssistAIError_light.png", "cxDevAssistAIError.png"))
        )
      );

      const newDoubleCheckUri = panel.webview.asWebviewUri(
        vscode.Uri.file(
          MediaPathResolver.getMediaFilePath("icons", ThemeUtils.selectIconByTheme("double-check_light.svg", "double-check.svg"))
        )
      );

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
        productName,
        bannerState
      );
    });

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
      } else if (message.type === 'openSettings') {
        vscode.commands.executeCommand(commands.openSettings, commands.openSettingsArgsAiAssistant);
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
