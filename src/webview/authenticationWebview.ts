import * as vscode from "vscode";
import { AuthService } from "../services/authService";
import { isURL } from "validator";
import { getNonce } from "../utils/utils";
import { Logs } from "../models/logs";
import { WelcomeWebview } from "../welcomePage/welcomeWebview";

export class AuthenticationWebview {
  public static readonly viewType = "checkmarxAuth";
  private static currentPanel: AuthenticationWebview | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private readonly logs: Logs | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    logs?: Logs
  ) {
    this.logs = logs;
    this._panel = panel;
    this._panel.webview.html = this._getWebviewContent();
    this._setWebviewMessageListener(this._panel.webview);
    this.initialize();
    this._panel.onDidDispose(
      () => {
        AuthenticationWebview.currentPanel = undefined;
      },
      null,
      this._disposables
    );
  }

  private async initialize() {
    this._panel.webview.postMessage({ type: "showLoader" });
    const authService = AuthService.getInstance(this.context, this.logs);
    let hasToken = false;

    try {
      hasToken = await authService.validateAndUpdateState();
    } catch (error) {
      console.error("Error validating authentication state:", error);
    }
    this._panel.webview.postMessage({
      type: "setAuthState",
      isAuthenticated: hasToken,
    });

    const urls = this.getURIs(this.context);
    this._panel.webview.postMessage({ type: "setUrls", items: urls });

    const tenants = this.getTenants(this.context);
    this._panel.webview.postMessage({ type: "setTenants", items: tenants });
    this._panel.webview.postMessage({ type: "hideLoader" });
  }

  public static show(context: vscode.ExtensionContext, logs?: Logs) {
    if (AuthenticationWebview.currentPanel) {
      AuthenticationWebview.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      AuthenticationWebview.viewType,
      "Checkmarx One Authentication",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      }
    );
    AuthenticationWebview.currentPanel = new AuthenticationWebview(
      panel,
      context,
      logs
    );
  }

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
    return this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, ...paths)
    );
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
    const loginIcon = this.setWebUri("media", "icons", "login.svg");
    const logoutIcon = this.setWebUri("media", "icons", "logout.svg");
    const successIcon = this.setWebUri("media", "icons", "success.svg");
    const errorIcon = this.setWebUri("media", "icons", "error.svg");
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html>

<head>
	<meta charset="UTF-8">
	<link href="${styleBootStrap}" rel="stylesheet">
	<link href="${styleAuth}" rel="stylesheet">
	<script nonce="${nonce}" src="${scriptBootStrap}"></script>
	<title>Checkmarx One Authentication</title>


</head>

<body>
  
    <div id="loading">
		<div class="spinner-border" role="status">
		  <span class="visually-hidden">Checking authentication...</span>
		</div>
	  </div>
<div id="authContainer" class="auth-container hidden">
        <div class="auth-form-title">Checkmarx One Authentication</div>
        <div id="loginForm">
        <div class="radio-group">
        
            <label>
                <input type="radio" name="authMethod" value="oauth" checked> OAuth
            </label>
      
            <label>
                <input type="radio" name="authMethod" value="apiKey">API Key
            </label>
        </div>

        <div  id="oauthForm" class="auth-form">
            <label for="baseUri" class="form-label">Checkmarx One Base URL:</label>
            <input type="text" id="baseUri" class="auth-input" placeholder="Enter Checkmarx One Base URL">
            <div id="urls-list" class="autocomplete-items"></div>
			<div id="urlError" class="text-danger mt-1" style="display: none;"></div>


            <label for="tenant" class="form-label">Tenant Name:</label>
            <input type="text" id="tenant" class="auth-input" placeholder="Enter tenant name">
            <div id="tenants-list" class="autocomplete-items"></div>
        </div>

             <!-- (We need to return it to the next div ) (class="hidden">)   -->
        <div id="apiKeyForm" class="hidden"> 
          <label for="apiKey" class="form-label">Checkmarx One API Key:</label>
			    <input type="password" id="apiKey" placeholder="Enter Checkmarx One API Key" class="auth-input">
        </div>
        <button id="authButton" class="auth-button" disabled><img src="${loginIcon}" alt="login"/>Sign in to Checkmarx</button>
        </div>
        
        <div id="authenticatedMessage" class="hidden authenticated-message"><img src="${successIcon}" alt="success"/>You are connected to Checkmarx One</div>
        <button id="logoutButton" class="auth-button hidden"><img src="${logoutIcon}" alt="logout"/>Log out</button>
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
    <script nonce="${nonce}" src="${scriptUri}"></script>
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
            .then((selection) => {
              if (selection === "Yes") {
                const authService = AuthService.getInstance(this.context);
                authService.logout();
                this._panel.webview.postMessage({ type: "clearFields" });
                this._panel.webview.postMessage({
                  type: "setAuthState",
                  isAuthenticated: false,
                });
                vscode.window.showInformationMessage(
                  "Logged out successfully."
                );
              }
            });
        } else if (message.command === "authenticate") {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Connecting to Checkmarx One...",
              cancellable: false,
            },
            async () => {
              try {
                if (message.authMethod === "oauth") {
                  // Existing OAuth handling
                  const baseUri = message.baseUri.trim();
                  const tenant = message.tenant.trim();
                  const authService = AuthService.getInstance(this.context);
                  await authService.authenticate(baseUri, tenant);
                  setTimeout(() => {
                    this._panel.dispose();
                    WelcomeWebview.show(this.context);
                  }, 1000);
                } else if (message.authMethod === "apiKey") {
                  // New API Key handling
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
                    return;
                  }

                  // If the API Key is valid, save it in the VSCode configuration (or wherever you prefer)
                  authService.saveToken(this.context, message.apiKey);

                  // Sending a success message to the window
                  this._panel.webview.postMessage({
                    type: "validation-success",
                    message: "API Key validated successfully!",
                  });

                  setTimeout(() => {
                    this._panel.dispose();
                    WelcomeWebview.show(this.context);
                    setTimeout(() => {
                      this._panel.webview.postMessage({
                        type: "clear-message-api-validation",
                      });
                    }, 500);
                  }, 1000);
                }
              } catch (error) {
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
