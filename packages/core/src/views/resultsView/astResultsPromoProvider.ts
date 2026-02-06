import * as vscode from 'vscode';
import { PromotionalCardView } from '../shared/PromotionalCardView';
import { Logs } from '../../models/logs';

export class AstResultsPromoProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private readonly isSca: boolean;

	constructor(private readonly context: vscode.ExtensionContext, private readonly logs: Logs, isSca: boolean = false) {
		this.isSca = isSca;
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
		this._view = webviewView;
		webviewView.webview.options = { enableScripts: true };
		this.render();
		webviewView.webview.onDidReceiveMessage(msg => {
			PromotionalCardView.handleMessage(msg);
		});
	}

	private render() {
		const promoConfig = this.isSca
			? PromotionalCardView.getScaConfig()
			: PromotionalCardView.getSastConfig();
		const styles = PromotionalCardView.generateStyles();
		const html = PromotionalCardView.generateHtml(promoConfig);
		const script = PromotionalCardView.generateScript();
		if (!this._view) { return; }
		this._view.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline';" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>${styles}</style>
    </head>
    <body>
      ${html}
      <script>
        const vscode = acquireVsCodeApi();
        ${script}
      </script>
    </body>
    </html>`;
	}
}
