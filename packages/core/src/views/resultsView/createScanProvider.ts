import CxScan from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { AstResult } from "../../models/results";
import {
  cx
} from "../../cx";
import {
  constants
} from "../../utils/common/constants";
import { getFromState, Item, updateState } from "../../utils/common/globalState";
import { getRepositoryFullName, getGitBranchName, getResultsJson, updateStatusBarItem } from "../../utils/utils";
import { messages } from "../../utils/common/messages";
import { commands } from "../../utils/common/commandBuilder";
import { loadScanId } from "../../utils/pickers/pickers";
import { setScanButtonDefaultIfScanIsNotRunning } from "../../utils/listener/listeners";

export async function pollForScanResult(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  logs: Logs
) {
  return new Promise<void>((resolve) => {
    setInterval(async () => {
      const scanPreparing = getFromState(context, constants.scanCreatePrepKey);
      if (scanPreparing?.id) {
        return;
      }

      const scanCreateId = getFromState(context, constants.scanCreateIdKey);
      if (scanCreateId?.id) {
        updateStatusBarItem(constants.scanWaiting, true, statusBarItem);
        const scan = await cx.getScan(scanCreateId.id);
        if (
          scan &&
          scan.status.toLocaleLowerCase() !== constants.scanStatusRunning &&
          scan.status.toLocaleLowerCase() !== constants.scanStatusQueued
        ) {
          scanFinished(context, scan, logs);
          updateStatusBarItem(constants.scanWaiting, false, statusBarItem);
          clearInterval(this);
          resolve();
        }
      } else {
        updateStatusBarItem(constants.scanWaiting, false, statusBarItem);
      }
    }, constants.scanPollTimeout);
  });
}

async function createScanForProject(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const scanBranch: Item = context.workspaceState.get(constants.branchIdKey);
  if (scanBranch.id === constants.localBranch) {
    const gitBranchName = await getGitBranchName();
    if (!gitBranchName) {
      throw new Error("Branch name from git not found");
    }
    scanBranch.id = gitBranchName;
  }
  const projectForScan: Item = context.workspaceState.get(constants.projectIdKey);
  const projectName = projectForScan.name.match(new RegExp(`${constants.projectLabel}\\s*(.+)`))[1].trim();
  const workspaceFolder = vscode.workspace.workspaceFolders[0];
  logs.info(messages.scanStartWorkspace + workspaceFolder.uri.fsPath);
  const scanCreateResponse = await cx.scanCreate(
    projectName,
    scanBranch.id,
    workspaceFolder.uri.fsPath
  );
  logs.info(messages.scanCreated + scanCreateResponse.id);
  updateState(context, constants.scanCreateIdKey, {
    id: scanCreateResponse.id,
    name: scanCreateResponse.id,
    displayScanId: undefined,
    scanDatetime: undefined
  });
}

export async function cancelScan(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  logs: Logs
) {
  logs.info(constants.scanCancel);
  updateStatusBarItem(constants.scanCancel, true, statusBarItem);

  const scan = getFromState(context, constants.scanCreateIdKey);
  if (scan && scan.id) {
    try {
      const response = await cx.scanCancel(scan.id);
      logs.info(messages.scanCancellingSent + scan.id + " :" + response);
      updateState(context, constants.scanCreateIdKey, undefined);
    } catch (error) {
      logs.error(error);
    }

  }
  updateStatusBarItem(constants.scanCancel, false, statusBarItem);
}

async function doesFilesMatch(logs: Logs) {
  const files = await vscode.workspace.findFiles("**", undefined);
  if (files.length === 0) {
    await vscode.window.showInformationMessage(messages.scanNoFilesFound);
    return;
  }

  const filesFromExistingScan = await getResultsJson();
  const resultFileNames = extractFileNamesFromResults(
    filesFromExistingScan.results
  );

  // start scan even when there are no results in the current scan
  if (!resultFileNames || !resultFileNames.length) {
    return true;
  }

  if (await doFilesExistInWorkspace(resultFileNames)) {
    logs.info(messages.scanFilesMatch);
    return true;
  } else {
    logs.info(messages.scanFilesNotMatch);
    return await getUserInput(messages.scanProjectsNotMatch);
  }
}

async function doesBranchMatch(context: vscode.ExtensionContext, logs: Logs) {
  const workspaceBranch = getFromState(context, constants.branchName);
  const scanBranch = getFromState(context, constants.branchIdKey);
  if (workspaceBranch && scanBranch && workspaceBranch.id === scanBranch.id) {
    logs.info(messages.scanBranchMatch);
    return true;
  } else {
    return await getUserInput(messages.scanBranchNotMatch);
  }
}

async function doesProjectMatch(context: vscode.ExtensionContext, logs: Logs) {
  const projectForScan: Item = context.workspaceState.get(constants.projectIdKey);
  const projectName = projectForScan?.name.match(new RegExp(`${constants.projectLabel}\\s*(.+)`))[1].trim();
  const workspaceProject = await getRepositoryFullName();
  if (projectForScan && projectName && projectName === workspaceProject) {
    logs.info(messages.scanProjectMatch);
    return true;
  } else {
    return await getUserInput(messages.scanProjectNotMatch);
  }
}

export async function createScan(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
  logs: Logs
) {
  logs.info(messages.scanCheckStart);
  updateState(context, constants.scanCreatePrepKey, { id: true, name: "", displayScanId: undefined, scanDatetime: undefined });
  updateStatusBarItem(constants.scanCreate, true, statusBarItem);

  if (!(await doesProjectMatch(context, logs))) {
    updateStatusBarItem(constants.scanWaiting, false, statusBarItem);
    updateState(context, constants.scanCreatePrepKey, { id: false, name: "", displayScanId: undefined, scanDatetime: undefined });
    return;
  }

  if (getFromState(context, constants.branchIdKey).id !== constants.localBranch) {
    updateStatusBarItem(constants.scanCreateVerifyBranch, true, statusBarItem);

    if (!(await doesBranchMatch(context, logs))) {
      updateStatusBarItem(constants.scanWaiting, false, statusBarItem);
      updateState(context, constants.scanCreatePrepKey, { id: false, name: "", displayScanId: undefined, scanDatetime: undefined });
      return;
    }
  }


  updateStatusBarItem(constants.scanCreateVerifyFiles, true, statusBarItem);
  if (!(await doesFilesMatch(logs))) {
    updateStatusBarItem(constants.scanWaiting, false, statusBarItem);
    updateState(context, constants.scanCreatePrepKey, { id: false, name: "", displayScanId: undefined, scanDatetime: undefined });
    return;
  }

  updateStatusBarItem(constants.scanCreatePreparing, true, statusBarItem);
  try {
    await createScanForProject(context, logs);
  } catch (error) {
    setScanButtonDefaultIfScanIsNotRunning(context);
    throw error;
  }
  updateStatusBarItem(constants.scanWaiting, true, statusBarItem);
  updateState(context, constants.scanCreatePrepKey, { id: false, name: "", displayScanId: undefined, scanDatetime: undefined });

  await vscode.commands.executeCommand(commands.pollScan);
}

async function getUserInput(msg: string): Promise<boolean> {
  // create a promise and wait for it to resolve
  const value = new Promise<boolean>((resolve, reject) => {
    vscode.window.showInformationMessage(msg, constants.yes, constants.no).then(async (val) => {
      if (val && val === constants.yes) {
        resolve(true);
      } else {
        resolve(false);
      }
      reject();
    });
  });
  return value;
}

async function doFilesExistInWorkspace(resultFileNames: string[]) {
  for (const fileName of resultFileNames) {
    const fileExists = await vscode.workspace.findFiles("**/*" + fileName);
    if (fileExists.length > 0) {
      return true;
    }
  }
  return false;
}

function extractFileNamesFromResults(results: string[]) {
  const filenames = [];
  results?.forEach((result) => {
    const astResult = new AstResult(result);
    filenames.push(astResult.fileName);
  });
  return filenames;
}

async function scanFinished(
  context: vscode.ExtensionContext,
  scan: CxScan,
  logs: Logs
) {
  updateState(context, constants.scanCreateIdKey, undefined);

  if (
    scan.status.toLowerCase() === constants.scanStatusComplete ||
    scan.status.toLowerCase() === constants.scanStatusPartial
  ) {
    const userConfirmMessage = messages.scanCompletedLoadResults(
      scan.status,
      scan.id
    );
    const loadResult: boolean = await getUserInput(userConfirmMessage);
    if (loadResult) {
      loadScanId(context, scan.id, logs);
    }
  } else {
    await vscode.window.showInformationMessage(
      messages.scanCompletedStatus(scan.status)
    );
  }
}
