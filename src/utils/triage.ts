import * as vscode from "vscode";
import { AstResult } from "../models/results";
import { getResultsFilePath } from "./utils";
import {triageUpdate} from "./ast";
import { get } from "./globalState";
import * as fs from "fs";
import { PROJECT_ID_KEY, TYPES } from "./constants";
import { Logs } from "../models/logs";
import { AstDetailsDetached } from "../ast_details_view";
import { REFRESH_TREE } from "./commands";

export async function updateResults(result: AstResult,context:vscode.ExtensionContext, comment:string):Promise<boolean> {
  let r = true;
  let resultHash = "";
  const resultJsonPath = getResultsFilePath();
  if (fs.existsSync(resultJsonPath) && result) {
    // Read local results from JSON file
    let jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, "utf-8"));
    if (TYPES[result.type] === "sast") {
      resultHash = result.data.resultHash;
    }
    if (TYPES[result.type] === "kics") {
      resultHash = result.kicsNode!.id;
    }
    if (TYPES[result.type] === "sca") {
      resultHash = result.scaNode!.id;
    }
    // Search for the changed result in the result list
    jsonResults.results.forEach((element: AstResult | any, index: number) => {
      // Update the resul in the array
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
    let projectId = get(context, PROJECT_ID_KEY)?.id;
    await triageUpdate(
      projectId ? projectId : "",
      result.similarityId,
      TYPES[result.type],
      result.state,
      comment,
      result.severity
    );
    /*.catch((err)=>{
      r =false;
      throw new Error(err);
    });*/
  }
  return r;
}

export async function triageSubmit(result:AstResult,context:vscode.ExtensionContext,data:any,logs:Logs,detailsPanel:vscode.WebviewPanel,detailsDetachedView:AstDetailsDetached){
  // Needed because dependency triage is still not working
  if (result.type === "dependency") {
    vscode.window.showErrorMessage("Triage not available for dependency.");
    return;
  }
  // Case there is feedback on the severity
  if (data.severitySelection.length > 0) {
    logs.log("INFO", "Updating severity to " + data.severitySelection);
    // Update severity of the result
    result.setSeverity(data.severitySelection);
    // Update webview title
    detailsPanel!.title =
      "(" + result.severity + ") " + result.label.replaceAll("_", " ");
  }

  // Case there is feedback on the state
  if (data.stateSelection.length > 0) {
    logs.log("INFO", "Updating state to " + data.stateSelection);
    // Update severity of the result
    result.setState(data.stateSelection.replace(" ", "_").toUpperCase());
  }

  // Case there is any update to be performed in the webview
  if (data.stateSelection.length > 0 || data.severitySelection.length > 0) {
    detailsDetachedView!.setResult(result);
    detailsDetachedView.setLoad(false);
    // Update webview html
    detailsPanel!.webview.html = await detailsDetachedView.getDetailsWebviewContent(detailsPanel!.webview);
    // Change the results locally
    let r = await updateResults(result, context, data.comment);
    if (r === true) {
      // Reload results tree to apply the changes
      await vscode.commands.executeCommand(REFRESH_TREE);
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