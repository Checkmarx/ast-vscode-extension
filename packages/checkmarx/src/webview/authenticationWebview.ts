import * as vscode from "vscode";
import { AuthService } from "@checkmarx/vscode-core/out/services/authService";
import { isURL } from "validator";
import { getNonce } from "@checkmarx/vscode-core/out/utils/utils";
import { Logs } from "@checkmarx/vscode-core/out/models/logs";
import { WelcomeWebview } from "../welcomePage/welcomeWebview";
import { WebViewCommand } from "@checkmarx/vscode-core/out/commands/webViewCommand";
import { cx } from "@checkmarx/vscode-core/out/cx";
import { initializeMcpConfiguration, uninstallMcp } from "@checkmarx/vscode-core/out/services/mcpSettingsInjector";
import { hasAnySupportedAiExtension } from "@checkmarx/vscode-core/out/utils/aiAssistantUtil";
import { CommonCommand } from "@checkmarx/vscode-core/out/commands/commonCommand";
import { commands } from "@checkmarx/vscode-core/out/utils/common/commandBuilder";
import { MediaPathResolver } from "@checkmarx/vscode-core/out/utils/mediaPathResolver";
import { ThemeUtils } from "@checkmarx/vscode-core/out/utils/themeUtils";
import { getMessages } from "@checkmarx/vscode-core/out/config/extensionMessages";

export class AuthenticationWebview {
  public static readonly viewType = "checkmarxAuth";
  private static currentPanel: AuthenticationWebview | undefined;
  private static isAuthenticating: boolean = false;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private readonly logs: Logs | undefined;
  private webview: WebViewCommand;
  private readonly messages: ReturnType<typeof getMessages>;
  private readonly authMethod: string | undefined;
  private constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    logs?: Logs,
    webview?: WebViewCommand,
    messages?: ReturnType<typeof getMessages>,
    authMethod?: string
  ) {
    this.logs = logs;
    this._panel = panel;
    this.webview = webview;
    this.messages = messages || getMessages(); // Use provided messages or get them
    this.authMethod = authMethod;
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

    // Listen for authentication configuration changes
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("checkmarxOne.authentication")) {
          // Close the form panel when auth type changes in settings
          // This ensures the form always matches the currently selected auth method
          this._panel.dispose();
        }
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
    await this._panel.webview.postMessage({ type: "showLoader" });
    const authService = AuthService.getInstance(this.context, this.logs);
    let hasToken = false;

    try {
      hasToken = await authService.validateAndUpdateState();
    } catch (error) {
      console.error("Error validating authentication state:", error);
    }
    const setAuthStateMessage = { type: "setAuthState", isAuthenticated: hasToken };
    await this._panel.webview.postMessage(setAuthStateMessage);

    const urls = this.getURIs(this.context);
    const setUrlsMessage = { type: "setUrls", items: urls };
    await this._panel.webview.postMessage(setUrlsMessage);

    const tenants = this.getTenants(this.context);
    const setTenantsMessage = { type: "setTenants", items: tenants };
    await this._panel.webview.postMessage(setTenantsMessage);
    await this._panel.webview.postMessage({ type: "hideLoader" });
  }

  public static show(context: vscode.ExtensionContext, webViewCommand: WebViewCommand, logs?: Logs, authMethod?: string) {
    if (AuthenticationWebview.currentPanel) {
      // If panel exists but auth method changed, dispose and create new panel
      if (AuthenticationWebview.currentPanel.authMethod !== authMethod) {
        AuthenticationWebview.currentPanel._panel.dispose();
        AuthenticationWebview.currentPanel = undefined;
      } else {
        // Same auth method, just reveal the existing panel
        AuthenticationWebview.currentPanel._panel.reveal(vscode.ViewColumn.One);
        // Ensure the currently visible form matches requested method
        if (authMethod) {
          AuthenticationWebview.currentPanel._panel.webview.postMessage({ type: "setAuthMethod", method: authMethod });
        }
        return;
      }
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
      messages,
      authMethod
    );
  }

  /**
   * Disposes any currently open authentication webview panel.
   * Called when authentication succeeds via any method to ensure forms are closed.
   * Safe to call multiple times (idempotent).
   * 
   * @param force - If true, dispose even if panel is currently authenticating.
   *                If false (default), skip disposal if panel is handling its own auth.
   */
  public static disposeAll(force: boolean = false): void {
    // Don't dispose if panel is currently processing its own authentication
    // Let schedulePostAuth() handle disposal to complete post-auth actions
    if (!force && AuthenticationWebview.isAuthenticating) {
      return;
    }

    if (AuthenticationWebview.currentPanel) {
      AuthenticationWebview.currentPanel._panel.dispose();
      AuthenticationWebview.currentPanel = undefined;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getTenants(context: vscode.ExtensionContext, url = ""): string[] {
    const urlMap =
      context.globalState.get<{ [key: string]: string[] }>(
        "recentURLsAndTenant"
      ) || {};
    //return tenant without
    return [...new Set(Object.values(urlMap).flat())];

    //TODO: Should return the tenants for the given URL
    // return urlMap[url] || [];
  }

  public getURIs(context: vscode.ExtensionContext): string[] {
    const urlMap =
      context.globalState.get<{ [key: string]: string[] }>(
        "recentURLsAndTenant"
      ) || {};
    return Object.keys(urlMap);
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
        await vscode.commands.executeCommand(commands.refreshScaStatusBar);
        await vscode.commands.executeCommand(commands.refreshKicsStatusBar);
        await vscode.commands.executeCommand(commands.refreshRiskManagementView);
        await vscode.commands.executeCommand(commands.clearKicsDiagnostics);
        if (isAiEnabled && hasAnySupportedAiExtension()) {
          await initializeMcpConfiguration(options.apiKey);
        } else {
          await uninstallMcp();
        }
        setTimeout(() => {
          this._panel.webview.postMessage({ type: "clear-message-api-validation" });
        }, 500);
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
    const scriptUri = this.setWebUri("media", "auth.js");
    const styleAuth = this.setWebUri("media", "auth.css");
    // Removed login icon for login buttons per request
    const logoutIcon = this.setWebUri("media", "icons", "logout.svg");
    const successIcon = this.setWebUri("media", "icons", "success.svg");
    const errorIcon = this.setWebUri("media", "icons", "error.svg");
    const footerImageUri = this.setWebUri("media", ThemeUtils.selectIconByTheme("checkmarx_page_footer_light_theme.svg", "checkmarx_page_footer.svg"));
    const nonce = getNonce();
    const messages = this.messages;

    // Determine initial visible form and classes
    const oauthVisibleInitially = !this.authMethod || this.authMethod === 'oauth';
    const oauthFormClass = oauthVisibleInitially ? 'auth-form' : 'auth-form hidden';
    const apiKeyFormClass = oauthVisibleInitially ? 'auth-form hidden' : 'auth-form';

    // Set login title based on auth method
    const loginTitle = oauthVisibleInitially ? 'OAuth Log in' : 'API Key Log in';

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
        <div class="login-form-title" id="loginTitle">${loginTitle}</div>
            <!-- OAuth Form -->
            <div id="oauthForm" class="${oauthFormClass}">
                <label for="baseUri" class="form-label">Checkmarx One Base URL</label>
                <input type="text" id="baseUri" class="auth-input">
                <div id="urls-list" class="autocomplete-items"></div>
                <div id="urlError" class="text-danger mt-1" style="display: none;"></div>

                <label for="tenant" class="form-label">Tenant Name</label>
                <input type="text" id="tenant" class="auth-input">
                <div id="tenants-list" class="autocomplete-items"></div>
            </div>

            <!-- API Key Form -->
            <div id="apiKeyForm" class="${apiKeyFormClass}">
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
        if (message.command === "validateURL") {
          const isValid = isURL(message.baseUri.trim());
          this._panel.webview.postMessage({
            type: "urlValidationResult",
            isValid,
          });
        } else if (message.command === "requestLogoutConfirmation") {
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
                await vscode.commands.executeCommand(commands.refreshScaStatusBar);
                await vscode.commands.executeCommand(commands.refreshKicsStatusBar);
                await vscode.commands.executeCommand(commands.refreshRiskManagementView);
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
                if (message.authMethod === "oauth") {
                  // Mark that we're processing authentication to prevent external disposal
                  AuthenticationWebview.isAuthenticating = true;

                  try {
                    // Existing OAuth handling
                    const baseUri = message.baseUri.trim();
                    const tenant = message.tenant.trim();
                    const authService = AuthService.getInstance(this.context);
                    const token = await authService.authenticate(baseUri, tenant);
                    const isAiEnabled = await cx.isAiMcpServerEnabled();
                    const commonCommand = new CommonCommand(this.context, this.logs);
                    await commonCommand.executeCheckStandaloneEnabled();
                    await commonCommand.executeCheckCxOneAssistEnabled();
                    if (token !== "") {
                      this.schedulePostAuth(isAiEnabled, { apiKey: token });
                      // Clear flag after delay to allow schedulePostAuth to complete (success case only)
                      setTimeout(() => {
                        AuthenticationWebview.isAuthenticating = false;
                      }, 2000);
                    }
                    else {
                      // Clear flag immediately on authentication failure to allow retry
                      AuthenticationWebview.isAuthenticating = false;
                      this._panel.webview.postMessage({ command: "enableAuthButton" });
                    }
                  } catch (oauthError) {
                    // Clear flag immediately on error to allow retry
                    AuthenticationWebview.isAuthenticating = false;
                    throw oauthError; // Re-throw to be caught by outer catch
                  }
                } else if (message.authMethod === "apiKey") {
                  // Mark that we're processing authentication to prevent external disposal
                  AuthenticationWebview.isAuthenticating = true;

                  try {
                    // New API Key handling
                    const authService = AuthService.getInstance(this.context);

                    // Validate the API Key using AuthService
                    const isValid = await authService.validateApiKey(
                      message.apiKey
                    );
                    if (!isValid) {
                      // Clear flag immediately on validation failure to allow retry
                      AuthenticationWebview.isAuthenticating = false;
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
                    // Save auth method for returning user flow
                    // NOTE: We intentionally preserve OAuth credentials (baseUri/tenant) so users can
                    // switch back to OAuth later without re-entering their credentials
                    await authService.saveLastAuthMethod('apiKey');
                    const isAiEnabled = await cx.isAiMcpServerEnabled();
                    const commonCommand = new CommonCommand(this.context, this.logs);
                    await commonCommand.executeCheckStandaloneEnabled();
                    await commonCommand.executeCheckCxOneAssistEnabled();
                    this._panel.webview.postMessage({
                      type: "validation-success",
                      message: "API Key validated successfully!",
                    });
                    this.schedulePostAuth(isAiEnabled, { apiKey: message.apiKey });
                    // Clear flag after delay to allow schedulePostAuth to complete (success case only)
                    setTimeout(() => {
                      AuthenticationWebview.isAuthenticating = false;
                    }, 2000);
                  } catch (apiKeyError) {
                    // Clear flag immediately on error to allow retry
                    AuthenticationWebview.isAuthenticating = false;
                    throw apiKeyError; // Re-throw to be caught by outer catch
                  }
                }
              } catch (error) {
                // Clear flag immediately on any error to allow retry
                AuthenticationWebview.isAuthenticating = false;
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

