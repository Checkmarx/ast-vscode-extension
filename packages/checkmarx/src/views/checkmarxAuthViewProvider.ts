import * as vscode from "vscode";
import { getNonce } from "@checkmarx/vscode-core/out/utils/utils";
import { Logs } from "@checkmarx/vscode-core/out/models/logs";
import { MediaPathResolver } from "@checkmarx/vscode-core/out/utils/mediaPathResolver";
import { commands } from "@checkmarx/vscode-core/out/utils/common/commandBuilder";
import { WebViewCommand } from "@checkmarx/vscode-core/out/commands/webViewCommand";
import { AuthService } from "@checkmarx/vscode-core/out/services/authService";
import { uninstallMcp } from "@checkmarx/vscode-core/out/services/mcpSettingsInjector";
import { constants } from "@checkmarx/vscode-core/out/utils/common/constants";

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
                if (this.isAuthenticated) {
                    const tenant = await this.getTenantFromToken();
                    if (tenant) {
                        this.webviewView?.webview.postMessage({ type: 'setTenant', tenant });
                    }
                }
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
        const loggedInImageUri = this.webviewView!.webview.asWebviewUri(
            vscode.Uri.file(MediaPathResolver.getMediaFilePath("", "logged_in.png"))
        );
        const footerImageUri = this.webviewView!.webview.asWebviewUri(
            vscode.Uri.file(MediaPathResolver.getMediaFilePath("", "authentication_side_panel_footer.png"))
        );
        const footerLightImageUri = this.webviewView!.webview.asWebviewUri(
            vscode.Uri.file(MediaPathResolver.getMediaFilePath("", "authentication_side_panel_footer_light_theme.png"))
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
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;

            /* Background same as login page */
            background-color: rgba(0, 0, 0, 1);
            background-image: 
                radial-gradient(
                    circle at 75% 90%,
                    rgba(42, 12, 105, 1) 0%,
                    rgba(8, 8, 8, 1) 75%
                ),
                radial-gradient(
                    circle at 50% 50%,
                    rgba(21, 188, 178, 0.63) 0%,
                    rgba(0, 0, 0, 0) 100%
                );
            background-repeat: no-repeat;
            background-size: cover;
        }

        /* Light theme: match authentication page gradient */
        body[data-vscode-theme-kind="vscode-light"] {
            background:
                linear-gradient(0deg, #F6F5FF, #F6F5FF),
                radial-gradient(
                    83.74% 70.01% at 74.82% 90.69%,
                    rgba(213, 194, 253, 0.43) 0%,
                    rgba(246, 245, 255, 0.43) 75.48%
                );
            background-repeat: no-repeat;
            background-size: cover;
        }
        .auth-container {
            display: flex;
            flex-direction: column;
            gap: 4px; /* gap between status line and tenant line */
            align-items: center;
        }
        .status-image {
            width: 56px;
            height: 56px;
            margin-bottom: 12px;
        }

        .status-message {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 0;
            background: transparent;
            border: none;
            border-radius: 0;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 0;
            text-align: center;
        }

        .auth-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.5; /* 1.5 times the font size */
            text-align: center;
            margin-bottom: 24px; /* controls space to Logout button (~1.5–2 line) */
        }

  .logout-button {
    display: inline-flex; /* instead of flex */
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    background: #000; /* black background */
    color: #fff; /* white text */
    border: 1px solid #fff; /* white border */
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    width: auto; /* let button size naturally */
}
        .logout-button:hover {
            background: #111;
        }

        .logout-button img {
            width: 16px;
            height: 16px;
        }
        /* Light theme: ensure logout icon visible on white button */
        body[data-vscode-theme-kind="vscode-light"] .logout-button img {
            filter: invert(1);
        }

        /* Light theme: outlined logout button to match design */
        body[data-vscode-theme-kind="vscode-light"] .logout-button {
            background: #FFFFFF;
            color: #2F2F2F;
            border: 1px solid #D9DAE6;
            box-shadow: none;
        }
        body[data-vscode-theme-kind="vscode-light"] .logout-button:hover {
            background: #FAFAFF;
            border-color: #C8CAE0;
        }
        body[data-vscode-theme-kind="vscode-light"] .logout-button:active,
        body[data-vscode-theme-kind="vscode-light"] .logout-button:focus {
            background: #F2F2FA;
            border-color: #BFC2D9;
            outline: none;
        }

        .separator {
            border-top: 1px solid var(--vscode-panel-border);
            margin: 8px 0;
        }

        a {
            color: var(--vscode-textLink-foreground);
        }
        .page-footer {
            position: fixed;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0.95;
        }
        /* Theme-specific footer image visibility */
        .page-footer-dark { display: block; }
        .page-footer-light { display: none; }
        body[data-vscode-theme-kind="vscode-light"] .page-footer-dark { display: none; }
        body[data-vscode-theme-kind="vscode-light"] .page-footer-light { display: block; }
    </style>
</head>
<body>
    <div class="auth-container">
        <img class="status-image" src="${loggedInImageUri}" alt="logged in" />
        <div class="status-message">
            <span>You are Logged in</span>
        </div>
        <div class="auth-description" id="tenantLabel"></div>
        <button class="logout-button" id="logoutBtn">
            <img src="${logoutIconUri}" alt="logout" />
            Logout
        </button>
    </div>
    <img class="page-footer page-footer-dark" src="${footerImageUri}" alt="footer" />
    <img class="page-footer page-footer-light" src="${footerLightImageUri}" alt="footer" />
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'logout' });
        });
        document.getElementById('editSettingsBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            vscode.postMessage({ command: 'editSettingsJson' });
        });
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg?.type === 'setTenant' && msg.tenant) {
                const el = document.getElementById('tenantLabel');
                if (el) el.textContent = 'Tenant: ' + msg.tenant;
            }
        });
    </script>
</body>
</html>`;
    }

    private getUnauthenticatedContent(): string {
        const nonce = getNonce();
        const authMethod = this.getAuthMethod();

        // Removed login icon for OAuth/API Key buttons

        const showOAuthButton = authMethod === "OAuth" || authMethod === "Both";
        const showApiKeyButton = authMethod === "API Key" || authMethod === "Both";

        const notLoggedInImageUri = this.webviewView!.webview.asWebviewUri(
            vscode.Uri.file(MediaPathResolver.getMediaFilePath("", "not_logged_in.png"))
        );
        const footerImageUri = this.webviewView!.webview.asWebviewUri(
            vscode.Uri.file(MediaPathResolver.getMediaFilePath("", "authentication_side_panel_footer.png"))
        );
        const footerLightImageUri = this.webviewView!.webview.asWebviewUri(
            vscode.Uri.file(MediaPathResolver.getMediaFilePath("", "authentication_side_panel_footer_light_theme.png"))
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
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;

            /* Fallback color */
            background-color: rgba(0, 0, 0, 1);

            /* Two radial gradients layered */
            background-image: 
                radial-gradient(
                    circle at 75% 90%,
                    rgba(42, 12, 105, 1) 0%,
                    rgba(8, 8, 8, 1) 75%
                ),
                radial-gradient(
                    circle at 50% 50%,
                    rgba(21, 188, 178, 0.63) 0%,
                    rgba(0, 0, 0, 0) 100%
                );
            background-repeat: no-repeat;
            background-size: cover;
        }
        /* Light theme: match authentication page gradient */
        body[data-vscode-theme-kind="vscode-light"] {
            background:
                linear-gradient(0deg, #F6F5FF, #F6F5FF),
                radial-gradient(
                    83.74% 70.01% at 74.82% 90.69%,
                    rgba(213, 194, 253, 0.43) 0%,
                    rgba(246, 245, 255, 0.43) 75.48%
                );
            background-repeat: no-repeat;
            background-size: cover;
        }
        .auth-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
        }
        .status-image {
            width: 56px;
            height: 56px;
            margin-bottom: 12px;
        }
        .auth-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
            text-align: center;
        }
        .auth-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
            line-height: 1.4;
            text-align: center;
            max-width: 320px;
            margin-left: auto;
            margin-right: auto;
            text-wrap: balance;
            word-break: break-word;
        }
        .auth-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 16px;
            background: #000;
            color: var(--vscode-button-foreground);
            border: 1px solid transparent;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            width: 100%;
            position: relative; /* anchor tooltip inside button */
        }
        .auth-button:hover {
            background: #000;
        }
        
        /* Light theme: outlined auth buttons (API Key / OAuth) */
        body[data-vscode-theme-kind="vscode-light"] .auth-button {
            background: #FFFFFF;
            color: #2F2F2F;
            border: 1px solid #D9DAE6;
            box-shadow: none;
        }
        body[data-vscode-theme-kind="vscode-light"] .auth-button:hover {
            background: #FAFAFF;
            border-color: #C8CAE0;
        }
        body[data-vscode-theme-kind="vscode-light"] .auth-button:active,
        body[data-vscode-theme-kind="vscode-light"] .auth-button:focus {
            background: #F2F2FA;
            border-color: #BFC2D9;
            outline: none;
        }
        .auth-button:focus,
        .auth-button:active {
            border-color: #808080;
            outline: none;
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

        /* Tooltip (shown only when a single auth method is available) */
        .tooltip-wrapper {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            display: inline-block;
            width: 100%; /* span button width to center tooltip */
            z-index: 2;
        }
        .tooltip-icon {
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 1px solid #fff;
            color: #fff;
            font-weight: 700;
            font-size: 12px;
            line-height: 1;
            background: transparent;
            cursor: pointer;
            user-select: none;
        }
        /* Light theme: make tooltip icon visible on white button */
        body[data-vscode-theme-kind="vscode-light"] .tooltip-icon {
            border-color: #D9DAE6;
            color: #2F2F2F;
        }
        .tooltip-text {
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            right: 0;
            margin: 0 auto;
            width: min(100%, 320px);
            background: var(--vscode-editorWidget-background, #2a2a2a);
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-editorWidget-border, #3c3c3c);
            border-radius: 6px;
            padding: 0; /* no padding as requested */
            font-size: 12px;
            line-height: 1.4;
            box-shadow: 0 6px 18px rgba(0,0,0,0.35);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity 120ms ease-in-out, visibility 120ms ease-in-out;
            box-sizing: border-box;
            z-index: 3;
        }
        .tooltip-text::after {
            content: '';
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            top: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: transparent transparent var(--vscode-editorWidget-background, #2a2a2a) transparent;
        }
        .tooltip-line {
            display: block;
            white-space: normal; /* allow wrapping */
            word-break: break-word;
            overflow-wrap: break-word;
            text-align: left;
        }
        /* show only when hovering the icon */
        .tooltip-icon:hover + .tooltip-text,
        .tooltip-wrapper.open .tooltip-text {
            opacity: 1;
            visibility: visible;
        }
        .page-footer {
            position: fixed;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0.95;
        }
        /* Theme-specific footer image visibility */
        .page-footer-dark { display: block; }
        .page-footer-light { display: none; }
        body[data-vscode-theme-kind="vscode-light"] .page-footer-dark { display: none; }
        body[data-vscode-theme-kind="vscode-light"] .page-footer-light { display: block; }
    </style>
</head>
<body>
    <div class="auth-container">
        <img class="status-image" src="${notLoggedInImageUri}" alt="not logged in" />
        <div class="auth-title">You are not logged in</div>
        <div class="auth-description">
            Login in to Checkmarx One to gain visibility into your application security and manage risks early and efficiently.
        </div>
        ${showOAuthButton ? `<button class="auth-button" id="oauthBtn">
            <span>OAuth login</span>
            ${!showApiKeyButton ? `
            <span class="tooltip-wrapper">
                <span class="tooltip-icon" aria-label="More info">i</span>
                <span class="tooltip-text">
                    <span class="tooltip-line">You’ve opted out of signing in with API key. To use another sign-in method instead of an OAuth, update your login preferences in Settings.</span>
                </span>
            </span>` : ''}
        </button>` : ''}
        ${showApiKeyButton ? `<button class="auth-button" id="apiKeyBtn">
            <span>API Key login</span>
            ${!showOAuthButton ? `
            <span class="tooltip-wrapper">
                <span class="tooltip-icon" aria-label="More info">i</span>
                <span class="tooltip-text">
                    <span class="tooltip-line">You’ve opted out of signing in with OAuth. To use another sign-in method instead of an API key, update your login preferences in Settings.</span>
                </span>
            </span>` : ''}
        </button>` : ''}
        <div class="auth-description">
            <a href="https://docs.checkmarx.com/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html">Need help logging in?</a>.
        </div>
    </div>
    <img class="page-footer page-footer-dark" src="${footerImageUri}" alt="footer" />
    <img class="page-footer page-footer-light" src="${footerLightImageUri}" alt="footer" />
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

    private async getTenantFromToken(): Promise<string | undefined> {
        try {
            const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());
            if (!token) return undefined;
            // Decode JWT payload (base64url) and read issuer
            const parts = token.split('.');
            if (parts.length < 2) return undefined;
            const payload = parts[1]
                .replace(/-/g, '+')
                .replace(/_/g, '/');
            const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as { iss?: string };
            const iss = json?.iss;
            if (!iss) return undefined;
            const url = new URL(iss);
            const marker = '/auth/realms/';
            const idx = url.pathname.indexOf(marker);
            if (idx === -1) return undefined;
            const rest = url.pathname.slice(idx + marker.length);
            const tenant = rest.split('/')[0];
            return tenant || undefined;
        } catch {
            return undefined;
        }
    }
}

