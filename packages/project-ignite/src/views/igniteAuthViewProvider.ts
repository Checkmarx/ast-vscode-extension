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

export class IgniteAuthViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "igniteAuth";
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

    // Listen for theme changes to refresh images
    vscode.window.onDidChangeActiveColorTheme(async () => {
      // Refresh content when theme changes to load correct themed images
      this.updateWebviewContent();
      // Re-send tenant message if authenticated (HTML was regenerated with empty tenant label)
      await this.refreshTenantDisplay();
    });

    // Listen for secrets changes (token added/removed)
    this.context.secrets.onDidChange(() => {
      // Check if the changed secret is our auth token
      this.checkAuthStateAndUpdate();
    });

    // Listen for visibility changes to refresh tenant when panel is reopened
    webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        // Re-send tenant message when panel becomes visible (covers: close/reopen, drag left/right)
        await this.refreshTenantDisplay();
      }
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
        // Send tenant info after auth state update (covers: VS Code restart, initial load)
        await this.refreshTenantDisplay();
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
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("", ThemeUtils.selectIconByTheme("authentication_side_panel_footer_light_theme.svg", "authentication_side_panel_footer.svg")))
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
    <div class="status-message">You are logged in</div>
    <div class="auth-description" id="tenantLabel"></div>
    <button class="logout-button" id="logoutBtn">
      <img src="${logoutIconUri}" alt="logout" />
      <span>Logout</span>
    </button>
  </div>
  <footer>
    <img class="page-footer" src="${footerImageUri}" alt="footer" />
  </footer>

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

    const notLoggedInImageUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("", ThemeUtils.selectIconByTheme("not_logged_in_light_theme.png", "not_logged_in.png")))
    );
    const footerImageUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("", ThemeUtils.selectIconByTheme("authentication_side_panel_footer_light_theme.svg", "authentication_side_panel_footer.svg")))
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
      You're not logged in
    </div>

    <div class="auth-content-box">
      Log in to access your application security findings and manage risks in Checkmarx Developer Assist.
    </div>

    <!-- API Key Button (No tooltip since only one login method) -->
    <button class="auth-button" id="apiKeyBtn">
      <span class="button-label">API Key login</span>
    </button>

    <div class="auth-description">
      <a href="${DOC_LINKS.devAssistHelpLoginUrl}"
         target="_blank" rel="noopener noreferrer">
         Need help logging in?
      </a>
    </div>
  </div>
  <footer>
    <img class="page-footer" src="${footerImageUri}" alt="footer" />
  </footer>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const apiKeyBtn = document.getElementById('apiKeyBtn');
    apiKeyBtn?.addEventListener('click', () => {
      vscode.postMessage({ command: 'authenticate', method: 'apiKey' });
      apiKeyBtn.classList.add('selected');
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
        // Show the authentication webview for API Key entry
        await vscode.commands.executeCommand(commands.showAuth);
        break;
      case 'logout':
        await this.handleLogout();
        break;
      default:
        console.warn(`Unknown command received from Ignite Auth webview: ${message.command}`);
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
      // The view will automatically update due to secrets.onDidChange listener
    }
  }

  /**
   * Common method to refresh tenant display in the webview
   * Used by: theme changes, visibility changes, auth state updates
   * Covers all scenarios: VS Code restart, panel close/reopen, drag left/right
   */
  private async refreshTenantDisplay(): Promise<void> {
    if (this.isAuthenticated) {
      const tenant = await this.getTenantFromToken();
      if (tenant) {
        this.webviewView?.webview.postMessage({ type: 'setTenant', tenant });
      }
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
