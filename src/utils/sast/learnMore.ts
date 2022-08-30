import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { AstResult } from "../../models/results";
import { learnMore } from "../ast/ast";

export async function getLearnMore(logs: Logs, context: vscode.ExtensionContext, result: AstResult, detailsPanel: vscode.WebviewPanel) {
	learnMore(result.queryId).then((learn) => {
		detailsPanel?.webview.postMessage({ command: "loadLearnMore", learn });
	}).catch((err) => {
		detailsPanel?.webview.postMessage({ command: "loadLearnMore", learn: []});
		logs.error( err);
	});
}