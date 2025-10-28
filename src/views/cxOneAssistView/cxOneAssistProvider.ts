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
		this.currentState = CxOneAssistUtils.getWebviewState(this.dependencies.ignoreFileManager);
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
	public updateWebviewContent(): void {
		if (!this.webviewView) {
			return;
		}

		this.currentState = CxOneAssistUtils.getWebviewState(this.dependencies.ignoreFileManager);

		this.webviewView.webview.html = CxOneAssistWebview.generateHtml(
			this.dependencies.context,
			this.webviewView.webview,
			this.currentState
		);
	}

	/**
	 * Updates the webview state dynamically without regenerating HTML
	 */
	public updateState(): void {
		if (!this.webviewView) {
			return;
		}

		this.currentState = CxOneAssistUtils.getWebviewState(this.dependencies.ignoreFileManager);

		this.webviewView.webview.postMessage({
			command: 'updateState',
			state: this.currentState
		});
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