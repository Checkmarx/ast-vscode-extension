import * as vscode from 'vscode';
import { AuthService } from '../services/authService';
import { isURL } from 'validator';
import { getNonce } from '../utils/utils';
import path = require("path");
export class AuthenticationWebview {
    public static readonly viewType = 'checkmarxAuth';
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private static readonly HISTORY_KEY = 'checkmarxOne.history'; // Key for storing history

    private constructor(panel: vscode.WebviewPanel, private context: vscode.ExtensionContext) {
        this._panel = panel;
        this._panel.webview.html = this._getWebviewContent(this._panel.webview);
        this._setWebviewMessageListener(this._panel.webview);

        this.initialize();
    }

    private async initialize() {
        this._panel.webview.postMessage({ type: 'showLoader' });
        const authService = AuthService.getInstance(this.context);
        const hasToken = await authService.validateAndUpdateState();
        this._panel.webview.postMessage({ type: 'setAuthState', isAuthenticated: hasToken });

        const urls = this.getURIs(this.context);
        this._panel.webview.postMessage({ type: 'setUrls', items: urls });

        const tenants = this.getTenants(this.context);
        this._panel.webview.postMessage({ type: 'setTenants', items: tenants });
        this._panel.webview.postMessage({ type: 'hideLoader' });
    }

    public static show(context: vscode.ExtensionContext) {
        const panel = vscode.window.createWebviewPanel(
            AuthenticationWebview.viewType,
            'Checkmarx One Authentication',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [context.extensionUri], }
        );

        return new AuthenticationWebview(panel, context);
    }
    public getTenants(context: vscode.ExtensionContext, url = ""): string[] {
        const urlMap = context.globalState.get<{ [key: string]: string[] }>("recentURLsAndTenant") || {};
        return Object.values(urlMap).flat();

        //TODO: Should return the tenants for the given URL
        // return urlMap[url] || [];
    }
    public getURIs(context: vscode.ExtensionContext): string[] {

        const urlMap = context.globalState.get<{ [key: string]: string[] }>("recentURLsAndTenant") || {};
        return Object.keys(urlMap);
    }

    private _getWebviewContent(webview: vscode.Webview): string {
        const styleBootStrap = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "media", "bootstrap", "bootstrap.min.css")
        );
        const scriptBootStrap = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "media", "bootstrap", "bootstrap.min.js")
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "media", "auth.js")
        );
        const styleAuth = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "media", "auth.css")
        );
        const loginIcon = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, path.join("media", "icons", "login.svg"))
        );
        const logoutIcon = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, path.join("media", "icons", "logout.svg"))
        );
        const successIcon = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, path.join("media", "icons", "success.svg"))
        );
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
                <input type="radio" name="authMethod" value="oauth" checked> By OAuth
            </label>
            <label>
                <input type="radio" name="authMethod" value="apiKey"> By API KEY
            </label>
        </div>
        <div id="oauthForm" class="auth-form">
            <label for="baseUri" class="form-label">Select Base URI:</label>
            <input type="text" id="baseUri" class="auth-input" placeholder="Type here...">
            <div id="urls-list" class="autocomplete-items"></div>
			<div id="urlError" class="text-danger mt-1" style="display: none;"></div>


            <label for="tenant" class="form-label">Select Tenant:</label>
            <input type="text" id="tenant" class="auth-input" placeholder="Type here...">
            <div id="tenants-list" class="autocomplete-items"></div>
        </div>
        <div id="apiKeyForm" class="hidden">
			<input type="password" id="apiKey" placeholder="Enter Checkmarx One API KEY" class="auth-input">
        </div>
        <button id="authButton" class="auth-button" disabled><img src="${loginIcon}" alt="login"/>Sign in to Checkmarx</button>
        </div>
        
        <div id="authenticatedMessage" class="hidden authenticated-message"><img src="${successIcon}" alt="success"/>You are connected to Checkmarx One</div>
        <button id="logoutButton" class="auth-button hidden"><img src="${logoutIcon}" alt="logout"/>Log-out</button>
        <div id="messageBox" class="message"></div>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</html>`;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(async message => {
            if (message.command === 'validateURL') {
                const isValid = isURL(message.baseUri);
                this._panel.webview.postMessage({ type: 'urlValidationResult', isValid });
            }
            else if (message.command === 'requestLogoutConfirmation') {
                vscode.window.showWarningMessage(
                    "Are you sure you want to log out?",
                    "Yes",
                    "Cancel"
                ).then(selection => {
                    if (selection === "Yes") {
                        const authService = AuthService.getInstance(this.context);
                        authService.logout();
                        this._panel.webview.postMessage({ type: 'setAuthState', isAuthenticated: false });
                        vscode.window.showInformationMessage("Logged out successfully.");
                    }
                });
            }
            else if (message.command === 'authenticate') {
                    await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: "Loading to Checkmarx...",
                            cancellable: false
                        }, async () => {

                            try {
                                if (message.authMethod === 'oauth') {
                                    // Existing OAuth handling
                                    const authService = AuthService.getInstance(this.context);
                                    await authService.authenticate(message.baseUri, message.tenant);
                                    vscode.window.showInformationMessage('Successfully authenticated with Checkmarx One!');
                                    setTimeout(() => this._panel.dispose(), 1000);
                                } else if (message.authMethod === 'apiKey') {
                                    // New API Key handling
                                    const authService = AuthService.getInstance(this.context);

                                    // Validate the API Key using AuthService
                                    const isValid = await authService.validateApiKey(message.apiKey);

                                    if (!isValid) {
                                        // Sending an error message to the window
                                        this._panel.webview.postMessage({
                                            type: 'validation-error',
                                            message: 'API Key validation failed. Please check your key.'
                                        });
                                        return;
                                    }

                                    // If the API Key is valid, save it in the VSCode configuration (or wherever you prefer)
                                    authService.saveToken(this.context, message.apiKey);

                                    // Sending a success message to the window
                                    this._panel.webview.postMessage({
                                        type: 'validation-success',
                                        message: 'API Key validated successfully!'
                                    });

                                    // Closing the window after one second
                                    setTimeout(() => this._panel.dispose(), 1000);
                                }
                            } catch (error) {
                                this._panel.webview.postMessage({
                                    type: 'validation-error',
                                    message: `Authentication failed: ${error.message}`
                                });
                            }
                        });
            }
        }, undefined, this._disposables);
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
