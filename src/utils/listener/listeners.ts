import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { RepositoryState } from "../types/git";
import { commands } from "../common/commands";
import {
  constants
} from "../common/constants";
import { getFromState, updateState } from "../common/globalState";
import { cx } from "../../cx";
import { getGitAPIRepository, isKicsFile, isSystemFile } from "../utils";
import { messages } from "../common/messages";

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
      logs.info(messages.gitOpenRepo);
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
    const tempBranchName = getFromState(context, constants.branchTempIdKey);
    const branchName = repoState.HEAD?.name;
    if (!branchName || (tempBranchName && tempBranchName.id === branchName)) {
      return;
    }

    updateState(context, constants.branchName, { id: branchName, name: branchName, displayScanId: undefined, scanDatetime: undefined});
    updateState(context, constants.branchTempIdKey, { id: branchName, name: branchName, displayScanId: undefined, scanDatetime: undefined}); //TODO: This is an hack to fix duplicated onchange calls when branch is changed.

    const projectItem = getFromState(context, constants.projectIdKey);
    const currentBranch = getFromState(context, constants.branchIdKey);

    if (projectItem?.id && branchName && branchName !== currentBranch?.id) {
      cx.getBranches(projectItem.id).then((branches) => {
        updateState(context, constants.branchTempIdKey, undefined);
        if (branches?.includes(branchName)) {
          updateState(context, constants.branchIdKey, {
            id: branchName,
            name: `${constants.branchLabel} ${branchName}`,
            displayScanId: undefined,
            scanDatetime: undefined
          });
          updateState(context, constants.scanIdKey, { id: undefined, name: constants.scanLabel, displayScanId: undefined, scanDatetime: undefined});
          vscode.commands.executeCommand(commands.refreshTree);
        }
      });
    } else {
      updateState(context, constants.branchTempIdKey, undefined);
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
        .getConfiguration(constants.cxKics)
        .get(constants.cxKicsAutoScan) as boolean;
      if (onSave) {
        // Check if saved file is within the project
        logs.info(messages.kicsUpdatingResults);
        // Send the current file to the global state, to be used in the command
        updateState(context, constants.kicsRealtimeFile, {
          id: e.uri.fsPath,
          name: e.uri.fsPath,
          displayScanId: undefined,
          scanDatetime: undefined
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
      // Mandatory in order to have the document appearing as displayed for VSCode
      await vscode.window.showTextDocument(e, 1, false);
      updateState(context, constants.kicsRealtimeFile, {
        id: e.uri.fsPath,
        name: e.uri.fsPath,
        displayScanId: undefined,
        scanDatetime: undefined
      });
      await vscode.commands.executeCommand(constants.kicsRealtime);
    }
  });
}

export async function setScanButtonDefaultIfScanIsNotRunning(
  context: vscode.ExtensionContext
) {
  const scan = getFromState(context, constants.scanCreateIdKey);
  if (!scan?.id) {
    vscode.commands.executeCommand(
      "setContext",
      `${constants.extensionName}.isScanEnabled`,
      true
    );
    vscode.commands.executeCommand(
      "setContext",
      `${constants.extensionName}.createScanButton`,
      true
    );
    updateState(context, constants.scanCreatePrepKey, { id: false, name: "" , displayScanId: "", scanDatetime: ""});
  }
  const scanID = getFromState(context, constants.scanIdKey);
  if (scanID === undefined) {
    vscode.commands.executeCommand(
      "setContext",
      `${constants.extensionName}.isScanEnabled`,
      false
    );
    vscode.commands.executeCommand(
      "setContext",
      `${constants.extensionName}.createScanButton`,
      false
    );
    updateState(context, constants.scanCreatePrepKey, { id: false, name: "" , displayScanId: "", scanDatetime: ""});
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
      logs.info(messages.gitExtensionBranch);
      context.subscriptions.push(await getBranchListener(context, logs));
    } else {
      logs.warn(
        messages.gitExtensionMissing
      );
    }
  } else {
    logs.warn(messages.gitExtensionNotInstalled);
  }
}

export async function executeCheckSettingsChange(
  kicsStatusBarItem: vscode.StatusBarItem,
  logs: Logs,
) {
  vscode.workspace.onDidChangeConfiguration(async () => {
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isValidCredentials,
      cx.getAstConfiguration() ? true : false
    );
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isValidCredentials,
      await cx.isScanEnabled(logs)
    );
    const onSave = vscode.workspace
      .getConfiguration(constants.cxKics)
      .get(constants.cxKicsAutoScan) as boolean;
    kicsStatusBarItem.text =
      onSave === true
        ? messages.kicsStatusBarConnect
        : messages.kicsStatusBarDisconnect;
    await vscode.commands.executeCommand(commands.refreshTree);
  });
}
