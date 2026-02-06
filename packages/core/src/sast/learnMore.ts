import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { AstResult } from "../models/results";
import { cx } from "../cx";

export async function getLearnMore(
  logs: Logs,
  context: vscode.ExtensionContext,
  result: AstResult,
  detailsPanel: vscode.WebviewPanel
) {
  cx.learnMore(result.queryId)
    .then((learn) => {
      detailsPanel?.webview.postMessage({ command: "loadLearnMore", learn, result });
    })
    .catch((err) => {
      detailsPanel?.webview.postMessage({
        command: "loadLearnMore",
        learn: [],
        result: result
      });
      logs.error(err);
    });
}
