import * as vscode from "vscode";
import {Logs} from "../../models/logs";
import {formatLabel, getFormattedDateTime, getFormattedId, getProperty, getScanLabel, PROGRESS_HEADER} from "../utils";
import {commands} from "../common/commands";
import {constants} from "../common/constants";
import {getFromState, updateState, updateStateError} from "../common/globalState";
import {CxQuickPickItem} from "./multiStepUtils";
import {messages} from "../common/messages";
import {cx} from "../../cx";

let currentPage = 0;
const pageSize = 20;

// label, function to search for projects/branchse, etc. override, onDidChange, "pre pick" function to return a bool
export async function projectPicker(
  context: vscode.ExtensionContext,
  logs: Logs,
) {
  const projectCache = new Map<number, CxQuickPickItem[]>();
  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = constants.projectPlaceholder;
  quickPick.items = await getProjectsPickItems(logs, context);
  quickPick.onDidChangeValue(async (value) => {
    try{
      const params = `name=${value}`;
      quickPick.items = await getProjectsPickItemsWithParams(params, logs, context);
    }
    catch (error) {
      updateStateError(context, constants.errorMessage + error);
      vscode.commands.executeCommand(commands.showError);
    }
  });
  quickPick.onDidChangeSelection(async ([item]) => {
    if (item.id === 'nextPage') {
      currentPage++;
      if (projectCache.has(currentPage)) {
        // Use cached items
        quickPick.items = projectCache.get(currentPage)!;
      } else {
        // Fetch new items and cache them
        const params = `limit=${pageSize},offset=${pageSize * currentPage}`;
        const items = await getProjectsPickItemsWithParams(params, logs, context);
        projectCache.set(currentPage, items);
        quickPick.items = items;
      }
    } else if (item.id === 'previousPage') {
      currentPage--;
      if (projectCache.has(currentPage)) {
        // Use cached items
        quickPick.items = projectCache.get(currentPage)!;
      } else {
        // Fetch new items and cache them
        const params = `limit=${pageSize},offset=${pageSize * currentPage}`;
        const items = await getProjectsPickItemsWithParams(params, logs, context);
        projectCache.set(currentPage, items);
        quickPick.items = items;
      }
    } else {
        updateState(context, constants.projectIdKey, {
          id: item.id,
          name: `${constants.projectLabel} ${item.label}`,
          displayScanId: undefined,
          scanDatetime: undefined
        });
    
    
    updateState(context, constants.branchIdKey, { id: undefined, name: constants.branchLabel, displayScanId: undefined, scanDatetime: undefined});
    updateState(context, constants.scanIdKey, { id: undefined, name: constants.scanLabel, displayScanId: undefined, scanDatetime: undefined});

    await vscode.commands.executeCommand(commands.refreshTree);
    quickPick.hide();
  }});
  quickPick.show();
}

export async function branchPicker(
  context: vscode.ExtensionContext,
  logs: Logs,
) {
  const projectItem = getFromState(context, constants.projectIdKey);
  // Check if project is picked
  if (!projectItem || !projectItem.id) {
    vscode.window.showErrorMessage(messages.pickerProjectMissing);
    return;
  }
  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = constants.branchPlaceholder;
  quickPick.items = await getBranchPickItems(logs, projectItem.id, context);
  quickPick.onDidChangeSelection(async ([item]) => {
    updateState(context, constants.branchIdKey, {
      id: item.id,
      name: `${constants.branchLabel} ${item.label}`,
      displayScanId: undefined,
      scanDatetime: undefined
    });
    if (projectItem.id && item.id) {
      const scanList = await getScansPickItems(
        logs,
        projectItem.id,
        item.id,
        context
      );
      if (scanList.length > 0) {
        updateState(context, constants.scanIdKey, {
          id: scanList[0].id,
          name: `${constants.scanLabel} ${scanList[0].label}`,
          displayScanId: `${constants.scanLabel} ${scanList[0].formattedId}`,
          scanDatetime: `${constants.scanDateLabel} ${scanList[0].datetime}`,
        });
        await getResultsWithProgress(logs, scanList[0].id);
      } else {
        updateState(context, constants.scanIdKey, { id: undefined, name: constants.scanLabel, displayScanId: undefined, scanDatetime: undefined });
      }
    } else {
      vscode.window.showErrorMessage(messages.pickerBranchProjectMissing);
    }

    await vscode.commands.executeCommand(commands.refreshTree);
    quickPick.hide();
  });
  quickPick.show();
}

export async function scanPicker(context: vscode.ExtensionContext, logs: Logs) {
  const projectItem = getFromState(context, constants.projectIdKey);
  const branchItem = getFromState(context, constants.branchIdKey);
  if (!branchItem?.id || !projectItem?.id) {
    vscode.window.showErrorMessage(messages.pickerBranchProjectMissing);
    return;
  }

  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = constants.scanPlaceholder;
  quickPick.items = await getScansPickItems(
    logs,
    projectItem.id,
    branchItem.id,
    context
  );
  quickPick.onDidChangeSelection(async ([item]) => {
    updateState(context, constants.scanIdKey, {
      id: item.id,
      name: `${constants.scanLabel} ${item.label}`,
      displayScanId: `${constants.scanLabel} ${item.formattedId}`,
      scanDatetime: `${constants.scanDateLabel} ${item.datetime}`,
    });
    if (item.id) {

      await getResultsWithProgress(logs, item.id);
      await vscode.commands.executeCommand(commands.refreshTree);
      quickPick.hide();
    }
  });
  quickPick.show();
}

export async function scanInput(context: vscode.ExtensionContext, logs: Logs) {
  const input = await vscode.window.showInputBox();
  if (!input) {
    return;
  }

  await loadScanId(context, input, logs);
}

export async function getBranchPickItems(
  logs: Logs,
  projectId: string,
  context: vscode.ExtensionContext
) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info(messages.cancelLoading));
      progress.report({ message: messages.loadingBranches });
      const branchList = await cx.getBranches(projectId);
      try {
        return branchList
          ? branchList.map((label) => ({
            label: label,
            id: label,
          }))
          : [];
      } catch (error) {
        updateStateError(context, constants.errorMessage + error);
        vscode.commands.executeCommand(commands.showError);
        return [];
      }
    }
  );
}

export async function getProjectsPickItems(
  logs: Logs,
  context: vscode.ExtensionContext
) {
  const items = await vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info(messages.cancelLoading));
      progress.report({ message: messages.loadingProjects });
      try {
        currentPage = 0;
        const projectList = await cx.getProjectList();
        return projectList
          ? projectList.map((label) => ({
            label: label.name,
            id: label.id,
          }))
          : [];
      } catch (error) {
        updateStateError(context, constants.errorMessage + error);
        vscode.commands.executeCommand(commands.showError);
        return [];
      }
    }
  );
  if (currentPage > 0) {
    items.unshift({
      label: '$(arrow-left) Previous Page',
      id: 'previousPage',
    });
  }

  items.push({
    label: '$(arrow-right) Next Page',
    id: 'nextPage',
  });
  return items;
}

export async function getProjectsPickItemsWithParams(
  params: string,
  logs: Logs,
  context: vscode.ExtensionContext
) {
  const items = await vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => {
        logs.info(messages.cancelLoading);
        currentPage = 0;
      });
      progress.report({ message: messages.loadingProjects });
      try {
        const projectList = await cx.getProjectListWithParams(params);
        return projectList
          ? projectList.map((label?) => ({
            label: label.name,
            id: label.id,
          }))
          : [];
      } catch (error) {
        updateStateError(context, constants.errorMessage + error);
        vscode.commands.executeCommand(commands.showError);
        return [];
      }
    }
  );
  if (currentPage > 0) {
    items.unshift({
      label: '$(arrow-left) Previous Page',
      id: 'previousPage',
    });
  }

  items.push({
    label: '$(arrow-right) Next Page',
    id: 'nextPage',
  });
  return items;
}

export async function getScansPickItems(
  logs: Logs,
  projectId: string,
  branchName: string,
  context: vscode.ExtensionContext
) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info(messages.cancelLoading));
      progress.report({ message: messages.loadingScans });
      const scanList = await cx.getScans(projectId, branchName);
      try {
        return scanList
          ? scanList.map((label) => ({
            label: formatLabel(label, scanList),
            id: label.id,
            datetime: getFormattedDateTime(label.createdAt),
            formattedId: getFormattedId(label, scanList)
          }))
          : [];
      } catch (error) {
        updateStateError(context, constants.errorMessage + error);
        vscode.commands.executeCommand(commands.showError);
        return [];
      }
    }
  );
}

export async function getResultsWithProgress(logs: Logs, scanId: string) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info(messages.cancelLoading));
      progress.report({ message: messages.loadingResults });
      await cx.getResults(scanId);
    }
  );
}

export async function loadScanId(
  context: vscode.ExtensionContext,
  scanId: string,
  logs: Logs
) {
  const scan = await getScanWithProgress(logs, scanId);
  if (!scan?.id || !scan?.projectID) {
    vscode.window.showErrorMessage(messages.scanIdNotFound);
    return;
  }

  const project = await getProjectWithProgress(logs, scan.projectID);
  if (!project?.id) {
    vscode.window.showErrorMessage(messages.projectNotFound);
    return;
  }

  updateState(context, constants.projectIdKey, {
    id: project.id,
    name: `${constants.projectLabel} ${project.name}`,
    displayScanId: undefined,
    scanDatetime: undefined
  });
  updateState(context, constants.branchIdKey, {
    id: scan.branch,
    name: `${constants.branchLabel} ${getProperty(scan, "branch")}`,
    displayScanId: undefined,
    scanDatetime: undefined
  });
  updateState(context, constants.scanIdKey, {
    id: scan.id,
    name: `${constants.scanLabel} ${getScanLabel(scan.createdAt, scan.id)}`,
    displayScanId: scan.id,
    scanDatetime: `${constants.scanDateLabel} ${getFormattedDateTime(scan.createdAt)}`,
  });

  await getResultsWithProgress(logs, scan.id);
  await vscode.commands.executeCommand(commands.refreshTree);
}

export async function getScanWithProgress(logs: Logs, scanId: string) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info(messages.cancelLoading));
      progress.report({ message: messages.loadingScan });
      return await cx.getScan(scanId);
    }
  );
}

export async function getProjectWithProgress(logs: Logs, projectId: string) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info(messages.cancelLoading));
      progress.report({ message: messages.loadingProject });
      return await cx.getProject(projectId);
    }
  );
}

export async function getBranchesWithProgress(logs: Logs, projectId: string) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info(messages.cancelLoading));
      progress.report({ message: messages.loadingBranches });
      return await cx.getBranches(projectId);
    }
  );
}
