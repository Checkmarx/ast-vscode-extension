import * as vscode from "vscode";
import * as fs from "fs";
import { AstResult } from "../models/results";
import { getResultsFilePath } from "./utils";
import { cx } from "../cx";
import { getFromState, updateState } from "./common/globalState";
import { constants } from "./common/constants";
import { Logs } from "../models/logs";
import { AstDetailsDetached } from "../views/resultsView/astDetailsView";
import { commands } from "./common/commandBuilder";
import { getLearnMore } from "../sast/learnMore";
import { TriageCommand } from "../models/triageCommand";
import { messages } from "./common/messages";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { getStateIdForTriage } from "./utils";

// Build SCA vulnerability string in the format:
// packagename=<name>,packageversion=<version>,vulnerabilityId=<similarityId>,packagemanager=<manager>
export function buildScaVulnerabilityString(result: AstResult): string {
  const sca = result.scaNode;
  const pkgId = sca?.packageIdentifier || result.data?.packageIdentifier || "";
  const parts = typeof pkgId === "string" ? pkgId.split("-") : [];
  const manager = (parts[0] || "");
  const name = parts[1] || "";
  const version = parts.length > 2 ? parts[parts.length - 1] : "";

  const vulnerabilityId = result.similarityId || result.id || "";
  return `packagename=${name},packageversion=${version},vulnerabilityId=${vulnerabilityId},packagemanager=${manager}`;
}

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
  const stateId = getStateIdForTriage(result.state);

  await cx.triageUpdate(
    projectId,
    result.similarityId,
    result.type,
    result.state,
    comment,
    result.severity,
    stateId
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

export async function updateSCAResults(
  result: AstResult,
  context: vscode.ExtensionContext,
  comment: string,
  resultsProvider: AstResultsProvider
) {
  const resultJsonPath = getResultsFilePath();
  if (!(fs.existsSync(resultJsonPath) && result)) {
    throw new Error(messages.fileNotFound);
  }

  const projectId = getFromState(context, constants.projectIdKey).id;
  const vulnerabilities = buildScaVulnerabilityString(result);

  await cx.triageSCAUpdate(
    projectId,
    vulnerabilities,
    result.type,
    result.state,
    comment
  );
  // Update local results
  const resultHash = result.getResultHash();
  resultsProvider.loadedResults.forEach((element: AstResult, index: number) => {
    // Update the result in the array
    if (element.data.resultHash === resultHash || element.id === resultHash) {
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
  // Require comment for SCA triage submissions
  if (result.type === constants.sca && (!data.comment || data.comment.trim().length === 0)) {
    vscode.window.showErrorMessage(messages.scaNoteMandatory);
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
    result.setState(data.stateSelection);
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
    if (result.type === constants.sca) {
      await updateSCAResults(result, context, data.comment, resultsProvider);
    } else {
      await updateResults(result, context, data.comment, resultsProvider);
    }
    updateState(context, constants.triageUpdate, {
      id: true,
      name: constants.triageUpdate,
      scanDatetime: "",
      displayScanId: "",
    });
    await vscode.commands.executeCommand(commands.refreshTree);
    if (result.type === constants.sast || result.type === constants.kics || result.type === constants.sca) {
      await getChanges(logs, context, result, detailsPanel, detailsDetachedView, resultsProvider);
    }
    if (result.type === constants.sast) {
      await getLearnMore(logs, context, result, detailsPanel);
    }
    vscode.window.showInformationMessage(messages.triageSubmitedSuccess);
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
  detailsPanel: vscode.WebviewPanel,
  detailsDetachedView: AstDetailsDetached,
  resultsProvider: AstResultsProvider
) {
  const projectId = getFromState(context, constants.projectIdKey)?.id;
  if (projectId) {
    const changesPromise = result.type === constants.sca
      ? triageSCAShow(projectId, result)
      : triageShow(projectId, result);
    await changesPromise
      .then(async (changes) => {
        const latest = Array.isArray(changes) && changes.length > 0 ? changes[0] : undefined;
        const changedSeverity = latest && latest.Severity && latest.Severity !== result.severity ? latest.Severity : undefined;
        const changedState = latest && latest.State && latest.State !== result.state ? latest.State : undefined;

        if (changedSeverity || changedState) {
          if (changedSeverity) {
            result.setSeverity(changedSeverity);
            if (detailsPanel && detailsPanel.title) {
              detailsPanel.title = "(" + result.severity + ") " + result.label.replaceAll("_", " ");
            }
          }
          if (changedState) {
            const match = constants.state.find(element =>
              element.value.replaceAll(" ", "") === changedState
            )?.tag;
            if (match) { result.setState(match); }
            else { result.setState(changedState); }
          }

          // Update local results array for this result
          const resultHash = result.getResultHash();
          const idx = resultsProvider.loadedResults.findIndex((e: AstResult) => (e.data.resultHash === resultHash || e.id === resultHash));
          if (idx !== -1) {
            const r = resultsProvider.loadedResults[idx];
            r.severity = result.severity;
            r.state = result.state;
            r.status = result.status;
          }

          updateState(context, constants.triageUpdate, {
            id: true,
            name: constants.triageUpdate,
            scanDatetime: "",
            displayScanId: "",
          });
          await vscode.commands.executeCommand(commands.refreshTree);

          if (result.type === constants.sast) {
            await getLearnMore(logs, context, result, detailsPanel);
          }
          detailsDetachedView?.setResult(result);
          detailsDetachedView.setLoad(true);
          detailsPanel.webview.html = await detailsDetachedView.getDetailsWebviewContent(detailsPanel?.webview);
        }

        // Always inform the webview of changes once
        await detailsPanel?.webview.postMessage({ command: "loadChanges", changes });
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

// Separate wrappers for triage show calls
export async function triageShow(projectId: string, result: AstResult) {
  return cx.triageShow(projectId, result.similarityId, result.type);
}

export async function triageSCAShow(projectId: string, result: AstResult) {
  const vulnerabilities = buildScaVulnerabilityString(result);
  return cx.triageSCAShow(projectId, vulnerabilities, constants.sca);
}
