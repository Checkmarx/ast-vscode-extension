import * as vscode from "vscode";
import { getNonce } from "@checkmarx/vscode-core/out/utils/utils";
import { Logs } from "@checkmarx/vscode-core/out/models/logs";
import { MediaPathResolver } from "@checkmarx/vscode-core/out/utils/mediaPathResolver";
import { commands } from "@checkmarx/vscode-core/out/utils/common/commandBuilder";
import { WebViewCommand } from "@checkmarx/vscode-core/out/commands/webViewCommand";
import { AuthService } from "@checkmarx/vscode-core/out/services/authService";
import { uninstallMcp } from "@checkmarx/vscode-core/out/services/mcpSettingsInjector";

export type AuthMethodType = "OAuth" | "API Key" | "Both";

export class CheckmarxAuthViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "checkmarxAuth";
    private webviewView?: vscode.WebviewView;
    private readonly context: vscode.ExtensionContext;
    private readonly logs: Logs;
    private isAuthenticated: boolean = false;
    private isUpdating: boolean = false;
    private pendingUpdate: boolean = false;

    constructor(context: vscode.ExtensionContext, _webViewCommand: WebViewCommand, logs: Logs) {
        this.context = context;
        this.logs = logs;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
    ): void {
        this.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.file(MediaPathResolver.getCoreMediaPath())
            ]
        };

        // Set up message handling first (before content is rendered)
        this.setupMessageHandling();

        // Check initial auth state and update content
        this.checkAuthStateAndUpdate();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("checkmarxOne.authentication")) {
                // Force update the view when auth method changes (dropdown and buttons need to update)
                this.updateWebviewContent();
            }
        });

        // Listen for secrets changes (token added/removed)
        this.context.secrets.onDidChange(() => {
            // Check if the changed secret is our auth token
            this.checkAuthStateAndUpdate();
        });
    }

    private async checkAuthStateAndUpdate(): Promise<void> {
        // Prevent concurrent updates - queue if already updating
        if (this.isUpdating) {
            this.pendingUpdate = true;
            return;
        }

        this.isUpdating = true;
        try {
            const authService = AuthService.getInstance(this.context, this.logs);
            // Use validateAndUpdateState to properly validate the token
            // This ensures we only show authenticated state after successful validation
            const newAuthState = await authService.validateAndUpdateState();

            // Only update if state actually changed or this is initial load
            if (this.isAuthenticated !== newAuthState || !this.webviewView?.webview.html) {
                this.isAuthenticated = newAuthState;
                this.updateWebviewContent();
            }
        } finally {
            this.isUpdating = false;

            // Process any pending update
            if (this.pendingUpdate) {
                this.pendingUpdate = false;
                this.checkAuthStateAndUpdate();
            }
        }
    }

    public updateWebviewContent(): void {
        if (!this.webviewView) {
            return;
        }
        this.webviewView.webview.html = this.getWebviewContent();
    }

    private getAuthMethod(): AuthMethodType {
        const config = vscode.workspace.getConfiguration("checkmarxOne");
        return config.get<AuthMethodType>("authentication", "Both");
    }

    private getWebviewContent(): string {
        if (this.isAuthenticated) {
            return this.getAuthenticatedContent();
        }
        return this.getUnauthenticatedContent();
    }

    private getAuthenticatedContent(): string {
        const nonce = getNonce();

        const logoutIconUri = this.webviewView!.webview.asWebviewUri(
            vscode.Uri.file(MediaPathResolver.getMediaFilePath("icons", "logout.svg"))
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data: vscode-resource:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 16px;
            color: var(--vscode-foreground);
        }
        .auth-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .auth-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .auth-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
            line-height: 1.4;
        }
        .status-message {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            border-radius: 4px;
            font-size: 12px;
        }
        .status-icon {
            color: var(--vscode-charts-green);
            font-size: 14px;
        }
        .logout-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            width: 100%;
        }
        .logout-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .logout-button img {
            width: 16px;
            height: 16px;
        }
        .separator {
            border-top: 1px solid var(--vscode-panel-border);
            margin: 8px 0;
        }
        a {
            color: var(--vscode-textLink-foreground);
        }
    </style>
</head>
<body>
    <div class="auth-container">
        <div class="auth-title">Checkmarx Authentication</div>
        <div class="status-message">
            <span class="status-icon">✓</span>
            <span>You are signed in</span>
        </div>
        <button class="logout-button" id="logoutBtn">
            <img src="${logoutIconUri}" alt="logout" />
            Sign out
        </button>
        <div class="separator"></div>
        <div class="auth-description">
            <a href="#" id="editSettingsBtn">Edit in settings.json</a>
        </div>
        <div class="auth-description">
            To learn more about how to use Checkmarx, <a href="https://docs.checkmarx.com/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html">read our docs</a>.
        </div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'logout' });
        });
        document.getElementById('editSettingsBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            vscode.postMessage({ command: 'editSettingsJson' });
        });
    </script>
</body>
</html>`;
    }

    private getUnauthenticatedContent(): string {
        const nonce = getNonce();
        const authMethod = this.getAuthMethod();

        const loginIconUri = this.webviewView!.webview.asWebviewUri(
            vscode.Uri.file(MediaPathResolver.getMediaFilePath("icons", "login.svg"))
        );

        const showOAuthButton = authMethod === "OAuth" || authMethod === "Both";
        const showApiKeyButton = authMethod === "API Key" || authMethod === "Both";

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data: vscode-resource:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 16px;
            color: var(--vscode-foreground);
        }
        .auth-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .auth-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .auth-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
            line-height: 1.4;
        }
        .auth-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            width: 100%;
        }
        .auth-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .auth-button img {
            width: 16px;
            height: 16px;
        }
        .separator {
            border-top: 1px solid var(--vscode-panel-border);
            margin: 8px 0;
        }
        a {
            color: var(--vscode-textLink-foreground);
        }
    </style>
</head>
<body>
    <div class="auth-container">
        <div class="auth-title">Sign in to Checkmarx</div>
        <div class="auth-description">
            Authenticate to access Checkmarx features and scan results.
        </div>
        ${showOAuthButton ? `<button class="auth-button" id="oauthBtn">
            <img src="${loginIconUri}" alt="login" />
            Sign in with OAuth
        </button>` : ''}
        ${showApiKeyButton ? `<button class="auth-button" id="apiKeyBtn">
            <img src="${loginIconUri}" alt="login" />
            Sign in with API Key
        </button>` : ''}
        <div class="separator"></div>
        <div class="auth-description">
            <a href="#" id="editSettingsBtn">Edit in settings.json</a>
        </div>
        <div class="auth-description">
            To learn more about how to use Checkmarx, <a href="https://docs.checkmarx.com/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html">read our docs</a>.
        </div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        ${showOAuthButton ? `document.getElementById('oauthBtn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'authenticate', method: 'oauth' });
        });` : ''}
        ${showApiKeyButton ? `document.getElementById('apiKeyBtn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'authenticate', method: 'apiKey' });
        });` : ''}
        document.getElementById('editSettingsBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            vscode.postMessage({ command: 'editSettingsJson' });
        });
    </script>
</body>
</html>`;
    }

    private setupMessageHandling(): void {
        if (!this.webviewView) {
            return;
        }

        this.webviewView.webview.onDidReceiveMessage(
            async (message: { command: string; method?: string }) => {
                await this.handleWebviewMessage(message);
            }
        );
    }

    private async handleWebviewMessage(message: { command: string; method?: string }): Promise<void> {
        switch (message.command) {
            case 'authenticate':
                // Try auto-authentication for returning users before showing the form
                const authService = AuthService.getInstance(this.context, this.logs);

                if (message.method === 'oauth') {
                    // First, check if we have a valid token with OAuth credentials
                    const hasValidOAuth = await authService.hasOAuthCredentials();
                    if (hasValidOAuth) {
                        // Try auto-authentication with existing valid token
                        const success = await authService.tryAutoAuthenticateOAuth();
                        if (success) {
                            vscode.window.showInformationMessage("Signed in with saved OAuth credentials.");
                            return;
                        }
                    }

                    // If no valid token, check if we have stored OAuth credentials (baseUri/tenant)
                    // This handles the case where user logged out but we preserved their credentials
                    const hasStoredOAuth = authService.hasStoredOAuthCredentials();
                    if (hasStoredOAuth) {
                        // Re-authenticate using stored credentials - opens browser directly
                        vscode.window.showInformationMessage("Re-authenticating with saved OAuth settings...");
                        const token = await authService.reAuthenticateWithStoredOAuth();
                        if (token) {
                            // Re-authentication succeeded
                            return;
                        }
                        // If re-authentication failed, fall through to show the form
                    }
                }

                // For API Key authentication, always show the plugin login form.
                // We do not attempt auto-auth with any previously stored API key
                // to avoid relying on persisted API keys.
                // Show the authentication webview if no credentials or auto-auth failed
                await vscode.commands.executeCommand(commands.showAuth, message.method);
                break;
            case 'logout':
                await this.handleLogout();
                break;
            case 'editSettingsJson':
                await vscode.commands.executeCommand('workbench.action.openSettingsJson');
                break;
            default:
                console.warn(`Unknown command received from Checkmarx Auth webview: ${message.command}`);
        }
    }

    private async handleLogout(): Promise<void> {
        const selection = await vscode.window.showWarningMessage(
            "Are you sure you want to log out?",
            "Yes",
            "Cancel"
        );

        if (selection === "Yes") {
            const authService = AuthService.getInstance(this.context, this.logs);
            await authService.logout();
            vscode.window.showInformationMessage("Logged out successfully.");
            uninstallMcp();
            await vscode.commands.executeCommand(commands.refreshIgnoredStatusBar);
            await vscode.commands.executeCommand(commands.refreshScaStatusBar);
            await vscode.commands.executeCommand(commands.refreshKicsStatusBar);
            await vscode.commands.executeCommand(commands.refreshRiskManagementView);
            // The view will automatically update due to secrets.onDidChange listener
        }
    }
}

