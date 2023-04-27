import * as vscode from "vscode";
import * as fs from "fs";
import { AstResult } from "../../models/results";
import { getChanges, getResultsFilePath, getResultsWithProgress } from "../utils";
import { Cx } from "../../cx/cx";
import { get } from "../common/globalState";
import { PROJECT_ID_KEY, SCA, SCAN_ID_KEY } from "../common/constants";
import { Logs } from "../../models/logs";
import { AstDetailsDetached } from "../../resultsView/ast_details_view";
import { REFRESH_TREE } from "../common/commands";
import { getLearnMore } from "./learnMore";

export async function updateResults(result: AstResult, context: vscode.ExtensionContext, comment: string) {
  const cx =  new Cx();
  const resultJsonPath = getResultsFilePath();
  if (!(fs.existsSync(resultJsonPath) && result)) {
    throw new Error("File not found");
  }

  try {
    // Change result in json
    let jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, "utf-8"));
    const resultHash = result.getResultHash();
    jsonResults.results.forEach((element: AstResult | any, index: number) => {
      // Update the resul in the array
      if (element.data.resultHash === resultHash || element.id === resultHash) {
        jsonResults.results[index] = result.rawObject;
        return;
      }
    });
    fs.writeFileSync(resultJsonPath, JSON.stringify(jsonResults));

    // Update 
    const projectId = get(context, PROJECT_ID_KEY).id;
    await cx.triageUpdate(
      projectId,
      result.similarityId,
      result.type,
      result.state,
      comment,
      result.severity
    );

  } catch (error) {
    throw new Error(error);
  }

}

export async function triageSubmit(result: AstResult, context: vscode.ExtensionContext, data: any, logs: Logs, detailsPanel: vscode.WebviewPanel, detailsDetachedView: AstDetailsDetached) {
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
    result.rawObject["severity"] = data.severitySelection;
    // Update webview title
    detailsPanel!.title =
      "(" + result.severity + ") " + result.label.replaceAll("_", " ");
  }

  // Case there is feedback on the state
  if (data.stateSelection.length > 0) {
    logs.log("INFO", "Updating state to " + data.stateSelection);
    // Update severity of the result
    result.setState(data.stateSelection.replaceAll(" ", "_").toUpperCase());
    result.rawObject["state"] = data.stateSelection.replaceAll(" ", "_").toUpperCase();
  }

  // Case the submit is sent without any change
  if (data.stateSelection.length === 0 && data.severitySelection.length === 0 && data.comment.length === 0) {
    vscode.window.showErrorMessage("Make a change before submiting");
    return;
  }

  detailsDetachedView!.setResult(result);
  detailsDetachedView.setLoad(false);
  // Update webview html
  detailsPanel!.webview.html =
    await detailsDetachedView.getDetailsWebviewContent(detailsPanel!.webview);
  // Change the results locally
  try {
    await updateResults(result, context, data.comment);
    vscode.commands.executeCommand(REFRESH_TREE);
    
    getChanges(logs, context, result, detailsPanel);
    getLearnMore(logs, context, result, detailsPanel);
    vscode.window.showInformationMessage(
      "Feedback submited successfully! Results refreshed."
    );
  } catch (error) {
    vscode.window.showErrorMessage("Triage Error | " + error);
  }
}