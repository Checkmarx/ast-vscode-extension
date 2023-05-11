import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { SastNode } from "../../models/sastNode";
import { cx } from "../../cx";

export async function getBfl(scanId: string, queryId: string, resultNodes: SastNode[], logs: Logs) {
  try {
    logs.log("INFO", "Fetching results best fix location");
    console.log("bfl");
    const bflIndex = await cx.getResultsBfl(scanId, queryId, resultNodes);
    if (bflIndex < 0) {
      logs.log("INFO", "No best fix location available for the current results");
    }
    return bflIndex;
  } catch (err) {
    const error = String(err);
    vscode.window.showErrorMessage(error);
    logs.log("ERROR", error);
  }
}
