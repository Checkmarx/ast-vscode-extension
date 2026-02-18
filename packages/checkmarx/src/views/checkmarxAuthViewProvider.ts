import * as vscode from "vscode";
import { getNonce } from "@checkmarx/vscode-core/out/utils/utils";
import { Logs } from "@checkmarx/vscode-core/out/models/logs";
import { MediaPathResolver } from "@checkmarx/vscode-core/out/utils/mediaPathResolver";
import { ThemeUtils } from "@checkmarx/vscode-core/out/utils/themeUtils";
import { commands } from "@checkmarx/vscode-core/out/utils/common/commandBuilder";
import { WebViewCommand } from "@checkmarx/vscode-core/out/commands/webViewCommand";
import { AuthService } from "@checkmarx/vscode-core/out/services/authService";
import { uninstallMcp } from "@checkmarx/vscode-core/out/services/mcpSettingsInjector";
import { constants } from "@checkmarx/vscode-core/out/utils/common/constants";
import { DOC_LINKS } from "@checkmarx/vscode-core/out/constants/documentation";

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

    // Listen for theme changes to refresh images
    vscode.window.onDidChangeActiveColorTheme(async () => {
      // Refresh content when theme changes to load correct themed images
      this.updateWebviewContent();
      // Re-send tenant message if authenticated (HTML was regenerated with empty tenant label)
      if (this.isAuthenticated) {
        const tenant = await this.getTenantFromToken();
        if (tenant) {
          this.webviewView?.webview.postMessage({ type: 'setTenant', tenant });
        }
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
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("", ThemeUtils.selectIconByTheme("authentication_side_panel_footer_light_theme.png", "authentication_side_panel_footer.png")))
    );
    const authCssUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("", "auth.css"))
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.webviewView!.webview.cspSource} 'unsafe-inline'; img-src https: data: ${this.webviewView!.webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${authCssUri}" />
</head>

<body class="sidebar-panel">
  <div class="auth-container authenticated">
    <img class="status-image" src="${loggedInImageUri}" alt="logged in" />
    <div class="status-message">You are Logged in</div>
    <div class="auth-description" id="tenantLabel"></div>
    <button class="logout-button" id="logoutBtn">
      <img src="${logoutIconUri}" alt="logout" />
      <span>Logout</span>
    </button>
    <img class="page-footer" src="${footerImageUri}" alt="footer" />
  </div>

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
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("", ThemeUtils.selectIconByTheme("not_logged_in_light_theme.png", "not_logged_in.png")))
    );
    const footerImageUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("", ThemeUtils.selectIconByTheme("authentication_side_panel_footer_light_theme.png", "authentication_side_panel_footer.png")))
    );
    // Load tooltip icon explicitly from this extension's media folder
    const infoTooltipUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'info_tooltip.svg')
    );
    const authCssUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("", "auth.css"))
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.webviewView!.webview.cspSource} 'unsafe-inline'; img-src https: data: ${this.webviewView!.webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${authCssUri}" />
</head>

<body class="sidebar-panel">
  <div class="auth-container unauthenticated">
    <img class="status-image" src="${notLoggedInImageUri}" alt="not logged in" />

    <div class="auth-status-box">
      You are not logged in
    </div>

    <div class="auth-content-box">
      Log in to access your application security findings and manage risks in Checkmarx One.
    </div>

    <!-- OAuth Button -->
    ${showOAuthButton ? `
    <button class="auth-button" id="oauthBtn">
      <span class="button-label">OAuth login</span>
      ${!showApiKeyButton ? `
      <span class="tooltip-wrapper">
        <span class="tooltip-icon" data-icon-url="${infoTooltipUri}" aria-label="More info"></span>
      </span>
      <span class="tooltip-text">
        <span class="tooltip-line">You’ve opted out of signing in with API key. To use another sign-in method instead of an OAuth, update your login preferences in Settings.</span>
      </span>` : ''}
    </button>` : ''}

    <!-- API Key Button -->
    ${showApiKeyButton ? `
    <button class="auth-button" id="apiKeyBtn">
      <span class="button-label">API Key login</span>
      ${!showOAuthButton ? `
      <span class="tooltip-wrapper">
        <span class="tooltip-icon" data-icon-url="${infoTooltipUri}" aria-label="More info"></span>
      </span>
      <span class="tooltip-text">
        <span class="tooltip-line">You’ve opted out of signing in with OAuth. To use another sign-in method instead of an API key, update your login preferences in Settings.</span>
      </span>` : ''}
    </button>` : ''}

    <div class="auth-description">
      <a href="${DOC_LINKS.helpLoginUrl}"
         target="_blank" rel="noopener noreferrer">
         Need help logging in?
      </a>
    </div>
    <img class="page-footer" src="${footerImageUri}" alt="footer" />
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // Set tooltip icon background images from data attributes
    document.querySelectorAll('.tooltip-icon[data-icon-url]').forEach(icon => {
      const url = icon.getAttribute('data-icon-url');
      if (url) {
        icon.style.backgroundImage = \`url('\${url}')\`;
      }
    });

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

