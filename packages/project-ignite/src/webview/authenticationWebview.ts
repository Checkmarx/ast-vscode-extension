import * as vscode from "vscode";
import { AuthService } from "@checkmarx/vscode-core/out/services/authService";
import { getNonce } from "@checkmarx/vscode-core/out/utils/utils";
import { Logs } from "@checkmarx/vscode-core/out/models/logs";
import { WelcomeWebview } from "../welcomePage/welcomeWebview";
import { WebViewCommand } from "@checkmarx/vscode-core/out/commands/webViewCommand";
import { cx } from "@checkmarx/vscode-core/out/cx";
import { initializeMcpConfiguration, uninstallMcp } from "@checkmarx/vscode-core/out/services/mcpSettingsInjector";
import { CommonCommand } from "@checkmarx/vscode-core/out/commands/commonCommand";
import { commands } from "@checkmarx/vscode-core/out/utils/common/commandBuilder";
import { MediaPathResolver } from "@checkmarx/vscode-core/out/utils/mediaPathResolver";
import { ThemeUtils } from "@checkmarx/vscode-core/out/utils/themeUtils";
import { getMessages } from "@checkmarx/vscode-core/out/config/extensionMessages";

export class AuthenticationWebview {
  public static readonly viewType = "devAssistAuth";
  private static currentPanel: AuthenticationWebview | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private readonly logs: Logs | undefined;
  private webview: WebViewCommand;
  private readonly messages: ReturnType<typeof getMessages>;
  private constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    logs?: Logs,
    webview?: WebViewCommand,
    messages?: ReturnType<typeof getMessages>
  ) {
    this.logs = logs;
    this._panel = panel;
    this.webview = webview;
    this.messages = messages || getMessages(); // Use provided messages or get them
    this._panel.webview.html = this._getWebviewContent();
    this._setWebviewMessageListener(this._panel.webview);
    this.initialize();

    // Listen for theme changes to refresh images
    this._disposables.push(
      vscode.window.onDidChangeActiveColorTheme(async () => {
        // Refresh content when theme changes to load correct themed images
        this._panel.webview.html = this._getWebviewContent();
        // Re-initialize after content refresh
        await this.initialize();
      })
    );

    this._panel.onDidDispose(
      () => {
        AuthenticationWebview.currentPanel = undefined;
      },
      null,
      this._disposables
    );
  }

  private async initialize() {
    await this._panel.webview.postMessage({ type: "showLoading" });
    const authService = AuthService.getInstance(this.context, this.logs);
    let hasToken = false;

    try {
      hasToken = await authService.validateAndUpdateState();
    } catch (error) {
      console.error("Error validating authentication state:", error);
    }
    const setAuthStateMessage = { type: "setAuthState", isAuthenticated: hasToken };
    await this._panel.webview.postMessage(setAuthStateMessage);
    await this._panel.webview.postMessage({ type: "hideLoading" });
  }

  public static show(context: vscode.ExtensionContext, webViewCommand: WebViewCommand, logs?: Logs) {
    if (AuthenticationWebview.currentPanel) {
      AuthenticationWebview.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const messages = getMessages();

    const panel = vscode.window.createWebviewPanel(
      commands.astResultsPromo,
      `${messages.displayName} Authentication`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.file(MediaPathResolver.getCoreMediaPath())
        ],
      }
    );
    AuthenticationWebview.currentPanel = new AuthenticationWebview(
      panel,
      context,
      logs,
      webViewCommand,
      messages
    );
  }

  private setWebUri(...paths: string[]): vscode.Uri {
    // If the path starts with "media", use MediaPathResolver
    if (paths[0] === "media") {
      const mediaPath = paths.slice(1);
      return this._panel.webview.asWebviewUri(
        vscode.Uri.file(MediaPathResolver.getMediaFilePath(...mediaPath))
      );
    }
    // For node_modules and other paths, use the extension URI
    return this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, ...paths)
    );
  }

  private async markFirstWelcomeAsShown() {
    await this.context.globalState.update("cxFirstWelcome", true);
  }

  private schedulePostAuth(isAiEnabled: boolean, options?: { apiKey?: string }) {
    setTimeout(async () => {
      try {
        this._panel.dispose();
        await this.markFirstWelcomeAsShown();
        WelcomeWebview.show(this.context, isAiEnabled);
        await vscode.commands.executeCommand(commands.updateCxOneAssist);
        await vscode.commands.executeCommand(commands.refreshIgnoredStatusBar);
        if (isAiEnabled) {
          await initializeMcpConfiguration(options.apiKey);
        } else {
          await uninstallMcp();
        }
        // Removed the second setTimeout that was trying to access disposed webview
        // The panel is already disposed above, so we can't send messages to it
      } catch (e) {
        this.logs?.warn?.(`Post-auth refresh failed: ${e?.message ?? e}`);
      }
    }, 1000);
  }

  private _getWebviewContent(): string {
    const styleBootStrap = this.setWebUri(
      "media",
      "bootstrap",
      "bootstrap.min.css"
    );
    const scriptBootStrap = this.setWebUri(
      "media",
      "bootstrap",
      "bootstrap.min.js"
    );
    // Use Project Ignite's auth.js which has the proper loading handlers
    const scriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'auth.js')
    );
    const styleAuth = this.setWebUri("media", "auth.css");
    const logoutIcon = this.setWebUri("media", "icons", "logout.svg");
    const successIcon = this.setWebUri("media", "icons", "success.svg");
    const errorIcon = this.setWebUri("media", "icons", "error.svg");
    const footerImageUri = this.setWebUri("media", ThemeUtils.selectIconByTheme("checkmarx_page_footer_light_theme.svg", "checkmarx_page_footer.svg"));
    const nonce = getNonce();
    const messages = this.messages;

    return `<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <link href="${styleBootStrap}" rel="stylesheet">
    <link href="${styleAuth}" rel="stylesheet">
    <script nonce="${nonce}" src="${scriptBootStrap}"></script>
    <title>Log in</title>
</head>

<body>

    <div id="loading">
        <div class="spinner-border" role="status">
            <span class="visually-hidden">Checking authentication...</span>
        </div>
    </div>
    <div id="authContainer" class="auth-container hidden">
      <div id="loginForm">
        <div class="login-form-title">Log in</div>
            <!-- API Key Form -->
            <div id="apiKeyForm" class="auth-form">
                <label for="apiKey" class="form-label">Checkmarx One API Key</label>
                <input type="password" id="apiKey" class="auth-input">
            </div>
            <button id="authButton" class="auth-button" disabled>Log in</button>
        </div>

        <!-- Authenticated Message -->
        <div id="authenticatedMessage" class="hidden authenticated-message">
            <img src="${successIcon}" alt="success"/>You are connected to ${messages.displayName}
        </div>
        <button id="logoutButton" class="auth-button hidden">
            <img src="${logoutIcon}" alt="logout"/>Log out
        </button>
        <div id="messageBox" class="message">
            <div id="messageSuccessIcon" class="hidden">
                <img src="${successIcon}" alt="success"/>
            </div>
            <div id="messageErrorIcon" class="hidden">
                <img src="${errorIcon}" alt="error"/>
            </div>
            <div id="messageText"></div>
        </div>
    </div>

    <!-- Footer Image -->
    <footer>
      <img class="page-footer" src="${footerImageUri}" alt="footer" />
    </footer>

    <script nonce="${nonce}" src="${scriptUri}"></script>

</body>
</html>`;
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === "requestLogoutConfirmation") {
          vscode.window
            .showWarningMessage(
              "Are you sure you want to log out?",
              "Yes",
              "Cancel"
            )
            .then(async (selection) => {
              if (selection === "Yes") {
                const authService = AuthService.getInstance(this.context);
                authService.logout();
                this.webview.removedetailsPanel();
                this._panel.webview.postMessage({ type: "clearFields" });
                this._panel.webview.postMessage({
                  type: "setAuthState",
                  isAuthenticated: false,
                });
                vscode.window.showInformationMessage(
                  "Logged out successfully."
                );
                uninstallMcp();
                await vscode.commands.executeCommand(commands.refreshIgnoredStatusBar);
              }
            });
        } else if (message.command === "authenticate") {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: this.messages.connectingMessage,
              cancellable: false,
            },
            async () => {
              await this._panel.webview.postMessage({ command: "disableAuthButton" });
              try {
                // API Key only authentication for Developer Assist
                const authService = AuthService.getInstance(this.context);

                // Validate the API Key using AuthService
                const isValid = await authService.validateApiKey(
                  message.apiKey
                );
                if (!isValid) {
                  // Sending an error message to the window
                  this._panel.webview.postMessage({
                    type: "validation-error",
                    message:
                      "API Key validation failed. Please check your key.",
                  });
                  this._panel.webview.postMessage({ command: "enableAuthButton" });
                  return;
                }

                authService.saveToken(this.context, message.apiKey);
                const isAiEnabled = await cx.isAiMcpServerEnabled();
                const commonCommand = new CommonCommand(this.context, this.logs);
                await commonCommand.executeCheckStandaloneEnabled();
                await commonCommand.executeCheckCxOneAssistEnabled();
                this._panel.webview.postMessage({
                  type: "validation-success",
                  message: "API Key validated successfully!",
                });
                this.schedulePostAuth(isAiEnabled, { apiKey: message.apiKey });
              } catch (error) {
                this._panel.webview.postMessage({ command: "enableAuthButton" });
                this._panel.webview.postMessage({
                  type: "validation-error",
                  message: `Authentication failed: ${error.message}`,
                });
              }
            }
          );
        }
      },
      undefined,
      this._disposables
    );
  }

  public dispose() {
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

