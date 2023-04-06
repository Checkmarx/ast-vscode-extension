import * as vscode from "vscode";
import { AstResult } from "../../models/results";
import { getResultsFilePath, getChanges } from "../utils";
import { triageUpdate } from "../ast/ast";
import { get } from "../common/globalState";
import * as fs from "fs";
import { PROJECT_ID_KEY, SAST, SCA, KICS } from "../common/constants";
import { Logs } from "../../models/logs";
import { AstDetailsDetached } from "../../resultsView/ast_details_view";
import { REFRESH_TREE } from "../common/commands";
import { getLearnMore } from "./learnMore";
import { TriageCommand } from "../../models/triageCommand";

export async function updateResults(
  result: AstResult,
  context: vscode.ExtensionContext,
  comment: string
): Promise<boolean> {
  let r = true;
  let resultHash = "";
  const resultJsonPath = getResultsFilePath();
  if (fs.existsSync(resultJsonPath) && result) {
    // Read local results from JSON file
    const jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, "utf-8"));
    if (result.type === SAST) {
      resultHash = result.data.resultHash;
    }
    if (result.type === KICS) {
      resultHash = result.kicsNode?.id;
    }
    if (result.type === SCA) {
      resultHash = result.scaNode?.id;
    }
    // Search for the changed result in the result list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jsonResults.results.forEach((element: AstResult | any, index: number) => {
      // Update the result in the array
      if (element.data.resultHash === resultHash || element.id === resultHash) {
        jsonResults.results[index] = result;
        return;
      }
    });
    // Update the result in the local version
    try {
      fs.writeFileSync(resultJsonPath, JSON.stringify(jsonResults));
    } catch (error) {
      r = false;
    }
    // Update the result in ast
    const projectId = get(context, PROJECT_ID_KEY)?.id;
    const update = await triageUpdate(
      projectId ? projectId : "",
      result.similarityId,
      result.type,
      result.state,
      comment,
      result.severity
    );
    if (update !== 0) {
      r = false;
    }
  }
  return r;
}

export async function triageSubmit(
  result: AstResult,
  context: vscode.ExtensionContext,
  data: TriageCommand,
  logs: Logs,
  detailsPanel: vscode.WebviewPanel,
  detailsDetachedView: AstDetailsDetached
) {
  // Needed because dependency triage is still not working
  if (result.type === SCA) {
    vscode.window.showErrorMessage("Triage not available for SCA.");
    return;
  }
  // Case there is feedback on the severity
  if (data.severitySelection.length > 0) {
    logs.log("INFO", "Updating severity to " + data.severitySelection);
    // Update severity of the result
    result.setSeverity(data.severitySelection);
    // Update webview title
    if (detailsPanel && detailsPanel.title) {
      detailsPanel.title =
        "(" + result.severity + ") " + result.label.replaceAll("_", " ");
    }
  }

  // Case there is feedback on the state
  if (data.stateSelection.length > 0) {
    logs.log("INFO", "Updating state to " + data.stateSelection);
    // Update severity of the result
    result.setState(data.stateSelection.replace(" ", "_").toUpperCase());
  }

  // Case there is any update to be performed in the webview
  if (
    data.stateSelection.length > 0 ||
    data.severitySelection.length > 0 ||
    data.comment.length > 0
  ) {
    detailsDetachedView?.setResult(result);
    detailsDetachedView.setLoad(false);
    // Update webview html
    if (detailsPanel && detailsPanel.webview) {
      // Change the results locally
      detailsPanel.webview.html =
        await detailsDetachedView.getDetailsWebviewContent(
          detailsPanel.webview
        );
    }
    const r = await updateResults(result, context, data.comment);
    if (r) {
      // Reload results tree to apply the changes
      await vscode.commands.executeCommand(REFRESH_TREE);
      getChanges(logs, context, result, detailsPanel);
      getLearnMore(logs, context, result, detailsPanel);
      // Information message
      vscode.window.showInformationMessage(
        "Feedback submited successfully! Results refreshed."
      );
    } else {
      vscode.window.showErrorMessage("Triage Error.");
    }
  }

  // Case the submit is sent without any change
  else {
    logs.log("ERROR", "Make a change before submiting");
  }
}
