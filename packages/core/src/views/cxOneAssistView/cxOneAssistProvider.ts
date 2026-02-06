import * as vscode from "vscode";
import { CxOneAssistDependencies, CxOneAssistMessage, CxOneAssistWebviewState } from "./CxOneAssistTypes";
import { CxOneAssistWebview } from "./CxOneAssistWebview";
import { CxOneAssistUtils } from "./CxOneAssistUtils";
import { IgnoreFileManager } from "../../realtimeScanners/common/ignoreFileManager";
import { Logs } from "../../models/logs";
import { MediaPathResolver } from "../../utils/mediaPathResolver";
import { commands } from "../../utils/common/commandBuilder";
import { getMessages } from "../../config/extensionMessages";

export class CxOneAssistProvider implements vscode.WebviewViewProvider {
	private webviewView?: vscode.WebviewView;
	private currentState: CxOneAssistWebviewState;
	private readonly dependencies: CxOneAssistDependencies;
	private logs: Logs;

	constructor(context: vscode.ExtensionContext, ignoreFileManager: IgnoreFileManager, logs: Logs) {
		this.dependencies = { context, ignoreFileManager };
		this.currentState = { ignoredCount: 0, hasIgnoreFile: false, isStandaloneEnabled: false, isAuthenticated: false, isCxOneAssistEnabled: false };
		this.logs = logs;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_context: vscode.WebviewViewResolveContext,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_token: vscode.CancellationToken,
	): void {
		this.webviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.dependencies.context.extensionUri, 'media'),
				vscode.Uri.file(MediaPathResolver.getCoreMediaPath())
			]
		};

		this.updateWebviewContent();
		this.setupMessageHandling();
	}

	public async updateWebviewContent(): Promise<void> {
		if (!this.webviewView) {
			return;
		}

		this.currentState = await CxOneAssistUtils.getWebviewState(
			this.dependencies.ignoreFileManager,
			this.dependencies.context,
			this.logs
		);

		if (!this.currentState.isAuthenticated) {
			this.webviewView.webview.html = this.renderUnauthenticatedHtml();
		}
		else if (this.currentState.isCxOneAssistEnabled || this.currentState.isStandaloneEnabled) {
			this.webviewView.webview.html = CxOneAssistWebview.generateHtml(
				this.dependencies.context,
				this.webviewView.webview,
				this.currentState
			);
		}
		else {
			this.webviewView.webview.html = CxOneAssistWebview.renderDisabledStandaloneHtml(
				this.dependencies.context,
				this.webviewView.webview
			);
		}
	}

	private renderUnauthenticatedHtml(): string {
		const nonce = this.getNonce();
		const messages = getMessages();

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; script-src 'nonce-${nonce}';" />
		<style>
		body { font-family: var(--vscode-font-family); padding: 0 20px 1em;color: var(--vscode-foreground); }
		.container { max-width: 520px; margin: 0; }
		h2 { font-size: 16px; margin: 0 0 12px 0; }
		p { line-height: 1.4; white-space: pre-line; }
		a { color: var(--vscode-textLink-foreground); text-decoration: none; }
		a:hover { text-decoration: underline; }
		.box { border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-sideBar-background); }
		.actions { margin-top: 16px; max-width: 300px; }
		.button-link { box-sizing: border-box;display: flex;width: 100%;padding: 4px;border-radius: 2px;text-align: center;cursor: pointer;justify-content: center;align-items: center;border: 1px solid var(--vscode-button-border, transparent);line-height: 18px; background: var(--vscode-button-background); color: var(--vscode-button-foreground);}
		.button-link:hover { background: var(--vscode-button-hoverBackground); text-decoration: none !important;}
		</style>
		</head>
		<body>
		<div class="container">
			<div>
				<p>${messages.authenticationRequiredMessage}</p>
				<center><div class="actions">
					<button class="button-link" type="button" id="openSettingsBtn" title="Open settings">Open settings</button>
				</div></center>
				<p style="margin-top:16px;">To learn more about how to use ${messages.productName} <a href="${messages.learnMoreLink}">read our docs</a>.</p>
			</div>
		</div>
		<script nonce="${nonce}">
			const vscode = acquireVsCodeApi();
			document.getElementById('openSettingsBtn')?.addEventListener('click', () => {
				vscode.postMessage({ command: 'openSettings'});
			});
		</script>
		</body>
		</html>`;
	}

	private getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 16; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	public async onAuthenticationChanged(): Promise<void> {
		await this.updateWebviewContent();
	}

	private setupMessageHandling(): void {
		if (!this.webviewView) {
			return;
		}

		this.webviewView.webview.onDidReceiveMessage(
			(message: CxOneAssistMessage) => {
				this.handleWebviewMessage(message);
			}
		);
	}

	private handleWebviewMessage(message: CxOneAssistMessage): void {
		switch (message.command) {
			case 'openIgnoredView':
				vscode.commands.executeCommand(commands.openIgnoredView);
				break;
			case 'openSettings':
				vscode.commands.executeCommand(commands.viewSettings);
				break;
			default:
				console.warn(`Unknown command received from Checkmarx One Assist webview: ${message.command}`);
		}
	}
}