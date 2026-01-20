import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { GptView } from "../views/gptView/gptView";
import { cx } from "../cx";
import CxMask from "@checkmarx/ast-cli-javascript-wrapper/dist/main/mask/CxMask";
import { constants } from "../utils/common/constants";

export class Gpt {
	private thinkID: number;
	private kicsIcon: vscode.Uri;
	private userKicsIcon: vscode.Uri;
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
		this.gptView = gptView;
		this.kicsIcon = gptView.getAskKicsIcon();
		this.userKicsIcon = gptView.getAskKicsUserIcon();
	}

	async runGpt(userMessage: string, user: string) {
		const result = this.gptView.getResult();
		// Update webview to show the user message
		this.gptPanel?.webview.postMessage({
			command: "userMessage",
			message: { message: userMessage, user: user },
			icon: this.userKicsIcon
		});
		// disable all the buttons and inputs
		this.gptPanel?.webview.postMessage({
			command: "disable",
		});
		await this.sleep(1000);
		// Update webview to show gpt thinking
		this.gptPanel?.webview.postMessage({
			command: "thinking",
			thinkID: this.thinkID,
			icon: this.kicsIcon
		});
		// Get response from gpt and show the response in the webview

		cx.runGpt(userMessage, result.filename, result.line, result.severity, result.vulnerabilityName).then(messages => {
			// enable all the buttons and inputs
			this.gptPanel?.webview.postMessage({
				command: "enable",
			});
			// send response message
			this.gptPanel?.webview.postMessage({
				command: "response",
				message: { message: messages[0].responses, user: `${constants.aiSecurityChampion}` },
				thinkID: this.thinkID,
				icon: this.kicsIcon
			});
			this.thinkID += 1;
		}).catch((e: Error) => {
			// enable all the buttons and inputs
			this.gptPanel?.webview.postMessage({
				command: "response",
				message: { message: e.message, user: `${constants.aiSecurityChampion}` },
				thinkID: this.thinkID,
				icon: this.kicsIcon
			});
		});
	}
	async mask(filePath: string) {
		let r: CxMask;
		try {
			r = await cx.mask(filePath);
		} catch (error) {
			this.logs.error(error);
		}
		return r;
	}

	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}