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
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data: vscode-resource:; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 0;
      margin: 0;
      color: var(--vscode-foreground);
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background-color: rgba(0, 0, 0, 1);
      background-image:
        radial-gradient(ellipse 83.74% 70.01% at 74.82% 90.69%, rgba(42, 12, 105, 0.76) 0%, rgba(8, 8, 8, 0.76) 75.48%),
        radial-gradient(ellipse 70% 40% at 20% 65%, rgba(21, 188, 178, 0.3) 0%, rgba(21, 188, 178, 0.18) 30%, rgba(0, 0, 0, 0) 80%);
      background-repeat: no-repeat;
      background-size: cover;
    }

    body[data-vscode-theme-kind='vscode-light'] {
      background: linear-gradient(0deg, #f6f5ff, #f6f5ff),
        radial-gradient(83.74% 70.01% at 74.82% 90.69%, rgba(213, 194, 253, 0.43) 0%, rgba(246, 245, 255, 0.43) 75.48%);
      background-repeat: no-repeat;
      background-size: cover;
    }

    .auth-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: clamp(160px, 30vh, 283px);
      gap: 4px;
      padding-bottom: 96px;
      box-sizing: border-box;
    }

    .status-image {
      width: 60px;
      height: 60px;
      margin-bottom: 12px;
    }

    /* "You are logged in" text */
    .status-message {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 18px;
      line-height: 150%;
      text-align: center;
      color: rgba(255, 255, 255, 0.9); /* Dark theme text color */
      background: transparent; /* No background */
      margin-bottom: 8px;
      white-space: nowrap; /* Ensure single line */
    }

    body[data-vscode-theme-kind='vscode-light'] .status-message {
      color: rgba(52, 52, 52, 1); /* Light theme text color */
    }

    /* Tenant label */
    /* Dark Theme */
    body:not([data-vscode-theme-kind="vscode-light"]) #tenantLabel {
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      font-size: 15px;
      line-height: 148%;
      color: var(--Tertiery, rgba(143, 143, 143, 1));
      background: transparent;
      width: auto;
      height: auto;
    }

    /* Light Theme */
    body[data-vscode-theme-kind="vscode-light"] #tenantLabel {
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      font-size: 15px;
      line-height: 148%;
      color: var(--Tertiery, rgba(146, 146, 146, 1));
      background: transparent;
      width: auto;
      height: auto;
    }

    /* Logout Button */
    .logout-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--Disabled, rgba(98, 98, 98, 1));
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(50px);
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 15px;
      line-height: 148%;
      color: var(--Secondery, rgba(188, 188, 188, 1));
      transition: all 0.2s ease;
      margin-top: 22px; /* adjust this value to control spacing */
    }

    .logout-button img {
      width: 16px;
      height: 16px;
      color: currentColor; /* Match text color */
    }

    .logout-button:hover {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid var(--Disabled, rgba(111, 111, 111, 1));
      backdrop-filter: blur(50px);
    }

    /* ✅ FIX: Make icon visible in light theme */
    body[data-vscode-theme-kind="vscode-light"] .logout-button img {
      filter: invert(1);
    }

    /* Light Theme Logout Button */
    body[data-vscode-theme-kind='vscode-light'] .logout-button {
      background: rgba(255, 255, 255, 0.3);
      border: 1px solid var(--Tertiery, rgba(146, 146, 146, 1));
      backdrop-filter: blur(50px);
      color: var(--Secondery, rgba(113, 113, 113, 1));
    }

    body[data-vscode-theme-kind='vscode-light'] .logout-button:hover {
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid var(--Tertiery, rgba(146, 146, 146, 1));
      backdrop-filter: blur(50px);
    }

    /* Footer Images */
    .page-footer {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      opacity: 0.95;
    }

    .page-footer-dark { display: block; }
    .page-footer-light { display: none; }

    body[data-vscode-theme-kind='vscode-light'] .page-footer-dark { display: none; }
    body[data-vscode-theme-kind='vscode-light'] .page-footer-light { display: block; }
  </style>
</head>

<body>
  <div class="auth-container">
    <img class="status-image" src="${loggedInImageUri}" alt="logged in" />
    <div class="status-message">You are Logged in</div>
    <div class="auth-description" id="tenantLabel"></div>
    <button class="logout-button" id="logoutBtn">
      <img src="${logoutIconUri}" alt="logout" />
      <span>Logout</span>
    </button>
  </div>

  <img class="page-footer page-footer-dark" src="${footerImageUri}" alt="footer" />
  <img class="page-footer page-footer-light" src="${footerLightImageUri}" alt="footer" />

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'logout' });
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
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data: vscode-resource:; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 0;
      margin: 0;
      color: var(--vscode-foreground);
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background-color: rgba(0, 0, 0, 1);
      background-image:
        radial-gradient(ellipse 83.74% 70.01% at 74.82% 90.69%, rgba(42, 12, 105, 0.76) 0%, rgba(8, 8, 8, 0.76) 75.48%),
        radial-gradient(ellipse 70% 40% at 20% 65%, rgba(21, 188, 178, 0.3) 0%, rgba(21, 188, 178, 0.18) 30%, rgba(0, 0, 0, 0) 80%);
      background-repeat: no-repeat;
      background-size: cover;
    }

    body[data-vscode-theme-kind='vscode-light'] {
      background: linear-gradient(0deg, #f6f5ff, #f6f5ff),
        radial-gradient(83.74% 70.01% at 74.82% 90.69%, rgba(213, 194, 253, 0.43) 0%, rgba(246, 245, 255, 0.43) 75.48%);
      background-repeat: no-repeat;
      background-size: cover;
    }

    /* --- AUTH PANEL --- */
    .auth-container {
      width: 417px;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: clamp(50px, 22vh, 110px);
      padding-top: 8px;
      padding-bottom: 32px;
      gap: 4px;
      box-sizing: border-box;
    }

    .status-image {
      width: 60px;
      height: 60px;
      margin: 0;
    }

    .auth-status-box {
      width: 185px;
      height: 27px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 18px;
      line-height: 150%;
      text-align: center;
      background: transparent;
      border-radius: 2px;
      margin-top: 6px;
      margin-bottom: 6px;
    }

    .auth-content-box {
      width: 280px;
      text-align: center;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      font-size: 12px;
      line-height: 148%;
      background: transparent;
      padding: 0px 7px 7px 7px;
      border-radius: 6px;
      margin-bottom: 14px;
    }

    /* --- BUTTONS --- */
    .auth-button {
      width: 280px;
      height: 40px;
      border-radius: 6px;
      border: 1px solid var(--Disabled, rgba(111, 111, 111, 1));
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(50px);
      padding: 0 12px;
      cursor: pointer;
      font-size: 13px;
      color: var(--vscode-button-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      position: relative;
    }

    .auth-button:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .auth-button.selected {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid #0066ff;
    }

    .auth-button + .auth-button {
      margin-top: 8px;
    }

 /* --- LIGHT THEME BUTTON UPDATES --- */
body[data-vscode-theme-kind='vscode-light'] .auth-button {
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid var(--Tertiery, rgba(146, 146, 146, 1));
    backdrop-filter: blur(50px);
    color: #2f2f2f;
}

body[data-vscode-theme-kind='vscode-light'] .auth-button:hover {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid var(--Tertiery, rgba(146, 146, 146, 1));
    backdrop-filter: blur(50px);
}

body[data-vscode-theme-kind='vscode-light'] .auth-button.selected {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid var(--CTA-Blue, rgba(43, 122, 204, 1));
    backdrop-filter: blur(50px);
}
/* --- BUTTON TEXT STYLE: DARK THEME --- */
body:not([data-vscode-theme-kind='vscode-light']) .auth-button span {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-style: normal; /* Semi Bold handled via 600 */
    font-size: 15px;
    line-height: 148%;
    letter-spacing: 0%;
    vertical-align: bottom;
    color: var(--Secondery, rgba(188, 188, 188, 1)); /* text color */
}

/* --- BUTTON TEXT STYLE: LIGHT THEME --- */
body[data-vscode-theme-kind='vscode-light'] .auth-button span {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-style: normal; /* Semi Bold handled via 600 */
    font-size: 15px;
    line-height: 148%;
    letter-spacing: 0%;
    vertical-align: bottom;
    color: var(--Secondery, rgba(113, 113, 113, 1)); /* text color for light theme */
}

    /* --- LINK --- */
    .auth-description {
      margin-top: 14px;
      width: 280px;
      text-align: left;
    }

    a {
      color: var(--vscode-textLink-foreground);
    }

    /* --- TOOLTIP CSS --- */
    .tooltip-wrapper {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        display: inline-block;
        width: 100%;
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
        padding: 0;
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
        white-space: normal;
        word-break: break-word;
        overflow-wrap: break-word;
        text-align: left;
    }
    .tooltip-icon:hover + .tooltip-text,
    .tooltip-wrapper.open .tooltip-text {
        opacity: 1;
        visibility: visible;
    }

    /* --- FOOTER --- */
    .page-footer {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      opacity: 0.95;
    }
    .page-footer-dark { display: block; }
    .page-footer-light { display: none; }
    body[data-vscode-theme-kind='vscode-light'] .page-footer-dark { display: none; }
    body[data-vscode-theme-kind='vscode-light'] .page-footer-light { display: block; }
  </style>
</head>

<body>
  <div class="auth-container">
    <img class="status-image" src="${notLoggedInImageUri}" alt="not logged in" />

    <div class="auth-status-box">
      You are not logged in
    </div>

    <div class="auth-content-box">
      Log in to Checkmarx One to gain visibility into your application security and manage risks early and efficiently.
    </div>

    <!-- OAuth Button -->
    ${showOAuthButton ? `
    <button class="auth-button" id="oauthBtn">
      <span>OAuth login</span>
      ${!showApiKeyButton ? `
      <span class="tooltip-wrapper">
        <span class="tooltip-icon" aria-label="More info">i</span>
        <span class="tooltip-text">
          <span class="tooltip-line">You’ve opted out of signing in with API key. To use another sign-in method instead of an OAuth, update your login preferences in Settings.</span>
        </span>
      </span>` : ''}
    </button>` : ''}

    <!-- API Key Button -->
    ${showApiKeyButton ? `
    <button class="auth-button" id="apiKeyBtn">
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
      <a href="https://docs.checkmarx.com/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html"
         target="_blank" rel="noopener noreferrer">
         Need help logging in?
      </a>
    </div>
  </div>

  <img class="page-footer page-footer-dark" src="${footerImageUri}" alt="footer" />
  <img class="page-footer page-footer-light" src="${footerLightImageUri}" alt="footer" />

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    ${showOAuthButton ? `
    const oauthBtn = document.getElementById('oauthBtn');
    oauthBtn?.addEventListener('click', () => {
      vscode.postMessage({ command: 'authenticate', method: 'oauth' });
      oauthBtn.classList.add('selected');
      document.getElementById('apiKeyBtn')?.classList.remove('selected');
    });` : ''}

    ${showApiKeyButton ? `
    const apiKeyBtn = document.getElementById('apiKeyBtn');
    apiKeyBtn?.addEventListener('click', () => {
      vscode.postMessage({ command: 'authenticate', method: 'apiKey' });
      apiKeyBtn.classList.add('selected');
      document.getElementById('oauthBtn')?.classList.remove('selected');
    });` : ''}
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

