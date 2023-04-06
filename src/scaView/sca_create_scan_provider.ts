import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { scaScanCreate, updateStatusBarItem } from "../utils/ast/ast";
import {
  SCA_NO_VULNERABILITIES,
  SCA_SCAN_WAITING,
} from "../utils/common/constants";
import { SCAResultsProvider } from "./sca_results_provider";

async function createScanForProject(logs: Logs) {
  const workspaceFolder = vscode.workspace.workspaceFolders[0];
  let scanCreateResponse;
  logs.info(
    "Initiating scan for workspace Folder: " + workspaceFolder.uri.fsPath
  );
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
  updateStatusBarItem(SCA_SCAN_WAITING, true, statusBarItem);
  logs.info("Checking if scan can be started...");
  // Check if there is a folder opened
  const files = await vscode.workspace.findFiles("**", undefined);
  // if it does not then show error log in output
  if (files.length === 0) {
    logs.error(
      "No files found in workspace. Please open a workspace or folder to be able to start an SCA scan."
    );
    vscode.window.showInformationMessage(
      "No files found in workspace. Please open a workspace or folder to be able to start an SCA scan."
    );
    updateStatusBarItem(
      "$(debug-disconnect) Checkmarx sca",
      true,
      statusBarItem
    );
    scaResultsProvider.refreshData(
      "No files found in workspace. Please open a workspace or folder to be able to start an SCA scan."
    );
  }
  // if there is then start the scan and pool for it
  else {
    await scaResultsProvider.clean();
    await scaResultsProvider.refreshData(
      "Scanning project for vulnerabilities..."
    );
    createScanForProject(logs)
      .then(async (scaResults) => {
        scaResultsProvider.scaResults = scaResults;
        let message = undefined;
        if (scaResults && scaResults.length === 0) {
          message = SCA_NO_VULNERABILITIES;
        }
        logs.info(
          `Scan completed successfully, ${scaResults.length} result(s) loaded into the SCA results tree`
        );
        await scaResultsProvider.refreshData(message);
        updateStatusBarItem("$(check) Checkmarx sca", true, statusBarItem);
      })
      .catch((err) => {
        updateStatusBarItem(
          "$(debug-disconnect) Checkmarx sca",
          true,
          statusBarItem
        );
        logs.error("Scan did not complete : " + err);
      });
  }
}
