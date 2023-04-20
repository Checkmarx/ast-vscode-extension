import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { RepositoryState } from "../types/git";
import { commands } from "../common/commands";
import {
  BRANCH_ID_KEY,
  BRANCH_LABEL,
  BRANCH_NAME,
  BRANCH_TEMP_ID_KEY,
  EXTENSION_NAME,
  KICS_REALTIME_FILE,
  PROJECT_ID_KEY,
  SCAN_CREATE_ID_KEY,
  SCAN_CREATE_PREP_KEY,
  SCAN_ID_KEY,
  SCAN_LABEL,
} from "../common/constants";
import { get, update } from "../common/globalState";
import { getBranches } from "../../ast/ast";
import { getGitAPIRepository, isKicsFile, isSystemFile } from "../utils";

export async function getBranchListener(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const gitApi = await getGitAPIRepository();
  const state = gitApi.repositories[0]?.state;
  if (state) {
    return addRepositoryListener(context, logs, state);
  } else {
    return gitApi.onDidOpenRepository(async () => {
      logs.info("GIT API - Open repository");
      const repoState = gitApi.repositories[0].state;
      return addRepositoryListener(context, logs, repoState);
    });
  }
}

async function addRepositoryListener(
  context: vscode.ExtensionContext,
  logs: Logs,
  repoState: RepositoryState
) {
  return repoState.onDidChange(() => {
    const tempBranchName = get(context, BRANCH_TEMP_ID_KEY);
    const branchName = repoState.HEAD?.name;
    if (!branchName || (tempBranchName && tempBranchName.id === branchName)) {
      return;
    }

    update(context, BRANCH_NAME, { id: branchName, name: branchName });
    update(context, BRANCH_TEMP_ID_KEY, { id: branchName, name: branchName }); //TODO: This is an hack to fix duplicated onchange calls when branch is changed.

    const projectItem = get(context, PROJECT_ID_KEY);
    const currentBranch = get(context, BRANCH_ID_KEY);

    if (projectItem?.id && branchName && branchName !== currentBranch?.id) {
      getBranches(projectItem.id).then((branches) => {
        update(context, BRANCH_TEMP_ID_KEY, undefined);
        if (branches?.includes(branchName)) {
          update(context, BRANCH_ID_KEY, {
            id: branchName,
            name: `${BRANCH_LABEL} ${branchName}`,
          });
          update(context, SCAN_ID_KEY, { id: undefined, name: SCAN_LABEL });
          vscode.commands.executeCommand(commands.refreshTree);
        }
      });
    } else {
      update(context, BRANCH_TEMP_ID_KEY, undefined);
    }
  });
}

export function addRealTimeSaveListener(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  // Listen to save action in a KICS file
  vscode.workspace.onDidSaveTextDocument(async (e) => {
    // Check if on save setting is enabled
    const isValidKicsFile = isKicsFile(e);
    const isSystemFiles = isSystemFile(e);
    if (isValidKicsFile && isSystemFiles) {
      const onSave = vscode.workspace
        .getConfiguration("CheckmarxKICS")
        .get("Activate KICS Auto Scanning") as boolean;
      if (onSave) {
        // Check if saved file is within the project
        logs.info("File saved updating KICS results");
        // Send the current file to the global state, to be used in the command
        update(context, KICS_REALTIME_FILE, {
          id: e.uri.fsPath,
          name: e.uri.fsPath,
        });
        await vscode.commands.executeCommand("ast-results.kicsRealtime");
      }
    }
  });

  // Listen to open action in a KICS file
  vscode.workspace.onDidOpenTextDocument(async (e: vscode.TextDocument) => {
    // Check if on save setting is enabled
    const isValidKicsFile = isKicsFile(e);
    const isSystemFiles = isSystemFile(e);
    if (isValidKicsFile && isSystemFiles) {
      logs.info("Opened a supported file by KICS. Starting KICS scan");
      // Mandatory in order to have the document appearing as displayed for VSCode
      await vscode.window.showTextDocument(e, 1, false);
      update(context, KICS_REALTIME_FILE, {
        id: e.uri.fsPath,
        name: e.uri.fsPath,
      });
      await vscode.commands.executeCommand("ast-results.kicsRealtime");
    }
  });
}

export async function setScanButtonDefaultIfScanIsNotRunning(
  context: vscode.ExtensionContext
) {
  const scan = get(context, SCAN_CREATE_ID_KEY);
  if (!scan?.id) {
    vscode.commands.executeCommand(
      "setContext",
      `${EXTENSION_NAME}.isScanEnabled`,
      true
    );
    vscode.commands.executeCommand(
      "setContext",
      `${EXTENSION_NAME}.createScanButton`,
      true
    );
    update(context, SCAN_CREATE_PREP_KEY, { id: false, name: "" });
  }
  const scanID = get(context, SCAN_ID_KEY);
  if (scanID === undefined) {
    vscode.commands.executeCommand(
      "setContext",
      `${EXTENSION_NAME}.isScanEnabled`,
      false
    );
    vscode.commands.executeCommand(
      "setContext",
      `${EXTENSION_NAME}.createScanButton`,
      false
    );
    update(context, SCAN_CREATE_PREP_KEY, { id: false, name: "" });
  }
}

export async function gitExtensionListener(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const gitExtension = vscode.extensions.getExtension("vscode.git");
  if (gitExtension) {
    await gitExtension.activate();
    if (gitExtension && gitExtension.exports.enabled) {
      logs.info("Git Extension - Add branch.");
      context.subscriptions.push(await getBranchListener(context, logs));
    } else {
      logs.warn(
        "Git Extension - Could not find active git extension in workspace."
      );
    }
  } else {
    logs.warn("Git extension - Could not find vscode.git installed.");
  }
}
