import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { scaScanCreate } from "../../ast/ast";
import {
  constants
} from "../../utils/common/constants";
import { SCAResultsProvider } from "./scaResultsProvider";
import { messages } from "../../utils/common/messages";
import { updateStatusBarItem } from "../../utils/utils";

async function createScanForProject(logs: Logs) {
  const workspaceFolder = vscode.workspace.workspaceFolders[0];
  let scanCreateResponse = [];
  logs.info(messages.scanStartWorkspace + workspaceFolder.uri.fsPath);
  try {
    scanCreateResponse = await scaScanCreate(workspaceFolder.uri.fsPath);
  } catch (error) {
    logs.error(error);
  }
  return scanCreateResponse;
}

export async function createSCAScan(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  logs: Logs,
  scaResultsProvider: SCAResultsProvider
) {
  updateStatusBarItem(constants.scaScanWaiting, true, statusBarItem);
  logs.info(messages.scaScanStart);
  // Check if there is a folder opened
  const files = await vscode.workspace.findFiles("**", undefined);
  // if it does not then show error log in output
  if (files.length === 0) {
    logs.error(messages.scaNoFilesFound);
    vscode.window.showInformationMessage(messages.scaNoFilesFound);
    updateStatusBarItem(messages.scaStatusBarDisconnect, true, statusBarItem);
    scaResultsProvider.refreshData(messages.scaNoFilesFound);
  }
  // if there is then start the scan and pool for it
  else {
    await scaResultsProvider.clean();
    await scaResultsProvider.refreshData(messages.scaScanning);
    createScanForProject(logs)
      .then(async (scaResults) => {
        scaResultsProvider.scaResults = scaResults;
        let message = undefined;
        if (scaResults && scaResults.length === 0) {
          message = constants.scaNoVulnerabilities;
        }
        logs.info(messages.scaScanCompletedSuccess(scaResults.length));
        await scaResultsProvider.refreshData(message);
        updateStatusBarItem(messages.scaStatusBarConnect, true, statusBarItem);
      })
      .catch((err) => {
        updateStatusBarItem(
          messages.scaStatusBarDisconnect,
          true,
          statusBarItem
        );
        logs.error(messages.scaScanningNotComplete + err);
      });
  }
}
