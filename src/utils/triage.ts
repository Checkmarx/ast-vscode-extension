import * as vscode from "vscode";
import * as fs from "fs";
import { AstResult } from "../models/results";
import { getResultsFilePath } from "./utils";
import { cx } from "../cx";
import { getFromState, updateState } from "./common/globalState";
import { constants } from "./common/constants";
import { Logs } from "../models/logs";
import { AstDetailsDetached } from "../views/resultsView/astDetailsView";
import { commands } from "./common/commands";
import { getLearnMore } from "../sast/learnMore";
import { TriageCommand } from "../models/triageCommand";
import { messages } from "./common/messages";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";

export async function updateResults(
  result: AstResult,
  context: vscode.ExtensionContext,
  comment: string,
  resultsProvider: AstResultsProvider
) {
  const resultJsonPath = getResultsFilePath();
  if (!(fs.existsSync(resultJsonPath) && result)) {
    throw new Error(messages.fileNotFound);
  }

  // Update on cxOne
  const projectId = getFromState(context, constants.projectIdKey).id;
  await cx.triageUpdate(
    projectId,
    result.similarityId,
    result.type,
    result.state,
    comment,
    result.severity
  );
  // Update local results
  const resultHash = result.getResultHash();
  resultsProvider.loadedResults.forEach((element: AstResult, index: number) => {
    // Update the result in the array
    if (element.data.resultHash === resultHash || element.id === resultHash) {
      resultsProvider.loadedResults[index].severity = result.severity;
      resultsProvider.loadedResults[index].state = result.state;
      resultsProvider.loadedResults[index].status = result.status;
      return;
    }
  });
}

export async function triageSubmit(
  result: AstResult,
  context: vscode.ExtensionContext,
  data: TriageCommand,
  logs: Logs,
  detailsPanel: vscode.WebviewPanel,
  detailsDetachedView: AstDetailsDetached,
  resultsProvider: AstResultsProvider
) {
  // Needed because dependency triage is still not working
  if (result.type === constants.sca) {
    vscode.window.showErrorMessage(messages.triageNotAvailableSca);
    return;
  }
  // Case there is feedback on the severity
  if (data.severitySelection.length > 0) {
    logs.info(messages.triageUpdateSeverity(data.severitySelection));
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
    logs.info(messages.triageUpdateState(data.stateSelection));
    // Update severity of the result
    result.setState(data.stateSelection.replaceAll(" ", "_").toUpperCase());
  }

  // Case the submit is sent without any change
  if (
    data.stateSelection.length === 0 &&
    data.severitySelection.length === 0 &&
    data.comment.length === 0
  ) {
    vscode.window.showErrorMessage(messages.triageNoChange);
    return;
  }
  // Change the results locally
  try {
    await updateResults(result, context, data.comment, resultsProvider);
    updateState(context, constants.triageUpdate, { id: true, name: constants.triageUpdate });
    await vscode.commands.executeCommand(commands.refreshTree);
    if (result.type === "sast" || result.type === "kics") {
      await getChanges(logs, context, result, detailsPanel);
    }
    if (result.type === "sast") {
      await getLearnMore(logs, context, result, detailsPanel);
    }
    vscode.window.showInformationMessage(
      messages.triageSubmitedSuccess
    );
  } catch (error) {
    vscode.window.showErrorMessage(messages.triageError(error));
    return;
  }
  detailsDetachedView?.setResult(result);
  detailsDetachedView.setLoad(false);
  // Update webview html
  detailsPanel.webview.html =
    await detailsDetachedView.getDetailsWebviewContent(detailsPanel?.webview);
}

export async function getChanges(
  logs: Logs,
  context: vscode.ExtensionContext,
  result: AstResult,
  detailsPanel: vscode.WebviewPanel
) {
  const projectId = getFromState(context, constants.projectIdKey)?.id;
  if (projectId) {
    cx.triageShow(projectId, result.similarityId, result.type)
      .then((changes) => {
        detailsPanel?.webview.postMessage({ command: "loadChanges", changes });
      })
      .catch((err) => {
        detailsPanel?.webview.postMessage({
          command: "loadChanges",
          changes: [],
        });
        logs.error(err);
      });
  } else {
    logs.error(messages.projectIdUndefined);
  }
}
