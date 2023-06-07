import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { GptView } from "../views/gptView/gptView";
import { cx } from "../cx";
export class Gpt {
	private thinkID: number;
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly logs: Logs,
		private gptPanel: vscode.WebviewPanel,
		private gptView: GptView
	) {
		this.context = context;
		this.logs = logs;
		this.gptPanel = gptPanel;
		this.thinkID = 0;
	}
	private kicsIcon = this.gptView.getAskKicsIcon();

	async runGpt(userMessage: string, user: string) {
		// Update webview to show the user message
		this.gptPanel?.webview.postMessage({
			command: "userMessage",
			message: { message: userMessage, user: user }
		});
		await this.sleep(1000);
		// Update webview to show gpt thinking
		this.gptPanel?.webview.postMessage({
			command: "thinking",
			thinkID: this.thinkID,
			icon: this.kicsIcon
		});
		// Get response from gpt and show the response in the webview
		cx.runGpt(userMessage).then(messages => {
			//this.logs.info(messages[0].message);
			const m = messages[messages.length - 1];
			this.gptPanel?.webview.postMessage({
				command: "response",
				message: messages[messages.length - 1],
				thinkID: this.thinkID,
				icon: this.kicsIcon
			});
			this.thinkID += 1;
		}).catch((e) => {
			this.gptPanel?.webview.postMessage({
				command: "response",
				message: "Ask KICS error : " + e,
				thinkID: this.thinkID
			});
		});
	}

	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}