import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { AstResult } from "../models/astResults/AstResult";
import { cx } from "../cx";

export async function getLearnMore(
  logs: Logs,
  context: vscode.ExtensionContext,
  result: AstResult,
  detailsPanel: vscode.WebviewPanel
) {
  cx.learnMore(result.getqueryId())
    .then((learn) => {
      detailsPanel?.webview.postMessage({
        command: "loadLearnMore",
        learn,
        result,
      });
      console.log("Posted message to webview Learn", learn);
      console.log("Posted message to webview Result", result);
    })
    .catch((err) => {
      detailsPanel?.webview.postMessage({
        command: "loadLearnMore",
        learn: [],
        result: result,
      });
      logs.error(err);
    });
}
