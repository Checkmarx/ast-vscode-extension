import * as vscode from "vscode";
import { CxOneAssistDependencies, CxOneAssistMessage, CxOneAssistWebviewState } from "./CxOneAssistTypes";
import { CxOneAssistWebview } from "./CxOneAssistWebview";
import { CxOneAssistUtils } from "./CxOneAssistUtils";
import { IgnoreFileManager } from "../../realtimeScanners/common/ignoreFileManager";

export class CxOneAssistProvider implements vscode.WebviewViewProvider {
	private webviewView?: vscode.WebviewView;
	private currentState: CxOneAssistWebviewState;
	private readonly dependencies: CxOneAssistDependencies;

	constructor(context: vscode.ExtensionContext, ignoreFileManager: IgnoreFileManager) {
		this.dependencies = {
			context,
			ignoreFileManager
		};
		// Initialize with default state (will be updated in resolveWebviewView)
		this.currentState = {
			ignoredCount: 0,
			hasIgnoreFile: false,
			isAuthenticated: false
		};
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		this.webviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.file(this.dependencies.context.extensionPath).with({ path: this.dependencies.context.extensionPath + "/media" })
			]
		};

		this.updateWebviewContent();
		this.setupMessageHandling();
	}

	/**
	 * Updates the webview content with current state
	 */
	public async updateWebviewContent(): Promise<void> {
		if (!this.webviewView) {
			return;
		}

		this.currentState = await CxOneAssistUtils.getWebviewState(
			this.dependencies.ignoreFileManager,
			this.dependencies.context
		);

		if (this.currentState.isAuthenticated) {
			this.webviewView.webview.html = CxOneAssistWebview.generateHtml(
				this.dependencies.context,
				this.webviewView.webview,
				this.currentState
			);
		} else {
			this.webviewView.webview.html = CxOneAssistWebview.generateUnauthenticatedHtml(
				this.dependencies.context,
				this.webviewView.webview
			);
		}
	}

	/**
	 * Updates the webview state dynamically without regenerating HTML
	 */
	public async updateState(): Promise<void> {
		if (!this.webviewView) {
			return;
		}

		this.currentState = await CxOneAssistUtils.getWebviewState(
			this.dependencies.ignoreFileManager,
			this.dependencies.context
		);

		this.webviewView.webview.postMessage({
			command: 'updateState',
			state: this.currentState
		});
	}

	/**
	 * Called when authentication state changes to refresh the entire webview
	 */
	public async onAuthenticationChanged(): Promise<void> {
		await this.updateWebviewContent();
	}

	/**
	 * Sets up message handling from the webview
	 */
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

	/**
	 * Handles messages received from the webview
	 */
	private handleWebviewMessage(message: CxOneAssistMessage): void {
		switch (message.command) {
			case 'openIgnoredView':
				vscode.commands.executeCommand('ast-results.openIgnoredView');
				break;
			default:
				console.warn(`Unknown command received from CxOne Assist webview: ${message.command}`);
		}
	}
}