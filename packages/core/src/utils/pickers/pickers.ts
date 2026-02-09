/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import {
  PROGRESS_HEADER,
  getProperty,
  getScanLabel,
  getFormattedDateTime,
  getFormattedId,
  formatLabel,
  getGitBranchName,
} from "../utils";
import { commands } from "../common/commandBuilder";
import { constants, QuickPickPaginationButtons } from "../common/constants";
import {
  getFromState,
  updateState,
  updateStateError,
} from "../common/globalState";
import { CxQuickPickItem } from "./multiStepUtils";
import { messages } from "../common/messages";
import { cx } from "../../cx";
import { getGlobalContext } from "../../activate/activateCore";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function createPicker(
  placeholder: string,
  title: string,
  fetchItems: (
    params: string,
    offset: number,
    pageSize: number
  ) => Promise<CxQuickPickItem[]>,
  handleSelection: (item: CxQuickPickItem) => Promise<void>,
  additionalConstantItem?: any
) {
  let currentPage = 0;
  const pageSize = 20;
  let currentFilter = "";
  const itemsCache = new Map<
    number,
    { items: CxQuickPickItem[]; hasNextPage: boolean }
  >();
  let activeRequestId: number | null = null;
  let hasNextPage = false;
  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = placeholder;
  quickPick.title = title;

  const resetQuickPickState = () => {
    currentPage = 0;
    currentFilter = "";
    itemsCache.clear();
    activeRequestId = null;
  };

  const loadPage = async (page: number, currentFilter: string) => {
    const requestId = Date.now();
    activeRequestId = requestId;

    try {
      quickPick.busy = true;
      const offset = page * pageSize;

      // Fetching a page with one extra item beyond the required size to determine if there are additional pages
      const items = await fetchItems(currentFilter, offset, pageSize + 1);

      if (activeRequestId !== requestId) {
        return;
      }

      hasNextPage = items.length > pageSize;

      const visibleItems = [
        ...(additionalConstantItem ? [additionalConstantItem] : []),
        ...items.slice(0, pageSize),
      ];
      itemsCache.set(page, { items: visibleItems, hasNextPage });
      quickPick.items = visibleItems;

      updatePaginationButtons(hasNextPage, page);
    } catch (error) {
      vscode.window.showErrorMessage(`Error loading items: ${error}`);
    } finally {
      if (activeRequestId === requestId) {
        quickPick.busy = false;
        activeRequestId = null;
      }
    }
  };

  const updatePaginationButtons = (
    hasNextPage: boolean,
    currentPage: number
  ) => {
    quickPick.buttons = [
      ...(currentPage > 0
        ? [
          {
            iconPath: new vscode.ThemeIcon("arrow-left"),
            tooltip: QuickPickPaginationButtons.previousPage,
          },
        ]
        : []),
      ...(hasNextPage
        ? [
          {
            iconPath: new vscode.ThemeIcon("arrow-right"),
            tooltip: QuickPickPaginationButtons.nextPage,
          },
        ]
        : []),
    ];
  };

  quickPick.onDidTriggerButton(async (button) => {
    if (button.tooltip === QuickPickPaginationButtons.previousPage) {
      currentPage--;
    } else if (button.tooltip === QuickPickPaginationButtons.nextPage) {
      currentPage++;
    }

    if (itemsCache.has(currentPage)) {
      quickPick.items = itemsCache.get(currentPage).items;
      hasNextPage = itemsCache.get(currentPage).hasNextPage;
      updatePaginationButtons(hasNextPage, currentPage);
    } else {
      await loadPage(currentPage, currentFilter);
    }
  });

  quickPick.onDidChangeValue(
    debounce(async (value) => {
      currentFilter = value;
      currentPage = 0;
      itemsCache.clear();
      quickPick.items = [];
      await loadPage(currentPage, currentFilter);
    }, 300)
  );

  quickPick.onDidChangeSelection(async ([item]) => {
    await handleSelection(item);
    quickPick.hide();
  });

  resetQuickPickState();
  await loadPage(currentPage, currentFilter);
  quickPick.show();
}

// label, funcao p ir buscar os projects/branches, etc override, onDidChange , funcao de "pre pick" p retornar um bool
export async function projectPicker(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const fetchProjects = async (
    filter: string,
    offset: number,
    pageSize: number
  ) => {
    return await getProjectsPickItemsWithParams(
      logs,
      context,
      filter,
      pageSize,
      offset
    );
  };

  const handleProjectSelection = async (item: CxQuickPickItem) => {
    updateState(context, constants.projectIdKey, {
      id: item.id,
      name: `${constants.projectLabel} ${item.label}`,
      displayScanId: undefined,
      scanDatetime: undefined,
    });
    updateState(context, constants.branchIdKey, {
      id: undefined,
      name: constants.branchLabel,
      displayScanId: undefined,
      scanDatetime: undefined,
    });
    updateState(context, constants.scanIdKey, {
      id: undefined,
      name: constants.scanLabel,
      displayScanId: undefined,
      scanDatetime: undefined,
    });
    await setDefaultBranch(item.id, context, logs);
    await vscode.commands.executeCommand(commands.refreshTree);
  };

  await createPicker(
    constants.projectPlaceholder,
    constants.projectPickerTitle,
    fetchProjects,
    handleProjectSelection
  );
}

export async function branchPicker(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const projectItem = getFromState(context, constants.projectIdKey);
  // Check if project is picked
  if (!projectItem || !projectItem.id) {
    vscode.window.showErrorMessage(messages.pickerProjectMissing);
    return;
  }

  const gitBranchName = await getGitBranchName();
  const localBranch = gitBranchName
    ? {
      label: constants.localBranch,
      id: constants.localBranch,
      alwaysShow: true,
    }
    : undefined;

  const fetchBranches = async (
    filter: string,
    offset: number,
    pageSize: number
  ): Promise<CxQuickPickItem[]> => {
    return await getBranchsPickItemsWithParams(
      logs,
      projectItem.id,
      context,
      filter,
      pageSize,
      offset
    );
  };

  const handleBranchSelection = async (item: CxQuickPickItem) => {
    handleBranchChange(item, context, projectItem, logs);
  };

  await createPicker(
    constants.branchPlaceholder,
    constants.branchPickerTitle,
    fetchBranches,
    handleBranchSelection,
    localBranch
  );
}

async function setDefaultBranch(
  projectId: string,
  context: vscode.ExtensionContext,
  logs: Logs
) {
  try {
    const gitBranchName = await getGitBranchName();
    if (gitBranchName) {
      const branchList = await cx.getBranchesWithParams(
        projectId,
        gitBranchName
      );
      const branchName =
        branchList.length === 0 || branchList[0] !== gitBranchName
          ? constants.localBranch
          : branchList[0];
      handleBranchChange(
        { label: branchName, id: branchName },
        context,
        { id: projectId },
        logs
      );
    }
  } catch (error) {
    logs.error(`Failed to used in a local branch: ${error}`);
    vscode.window.showErrorMessage(`Failed to used in a local branch: ${error}`);
  }
}

async function handleBranchChange(
  item: CxQuickPickItem,
  context: vscode.ExtensionContext,
  projectItem,
  logs: Logs
) {
  updateState(context, constants.branchIdKey, {
    id: item.id,
    name: `${constants.branchLabel} ${item.label}`,
    displayScanId: undefined,
    scanDatetime: undefined,
  });

  if (projectItem.id && item.id) {
    if (item.id === constants.localBranch) {
      updateState(context, constants.scanIdKey, {
        id: undefined,
        name: constants.scanLabel,
        displayScanId: undefined,
        scanDatetime: undefined,
      });
    } else {
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
        updateState(context, constants.scanIdKey, {
          id: undefined,
          name: constants.scanLabel,
          displayScanId: undefined,
          scanDatetime: undefined,
        });
      }
    }
  } else {
    vscode.window.showErrorMessage(messages.pickerBranchProjectMissing);
  }

  await vscode.commands.executeCommand(commands.refreshTree);
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
  return getBranchsPickItemsWithParams(logs, projectId, context, "", 10000, 0);
}

export async function getBranchsPickItemsWithParams(
  logs: Logs,
  projectId: string,
  context: vscode.ExtensionContext,
  filter: string,
  limit: number,
  offset: number
) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info(messages.cancelLoading));
      progress.report({ message: messages.loadingBranches });
      const params = `${filter},limit=${limit},offset=${offset}`;
      const branchList = await cx.getBranchesWithParams(projectId, params);
      try {
        const branches = branchList
          ? branchList.map((label) => ({
            label: label,
            id: label,
          }))
          : [];

        return branches;
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
  return getProjectsPickItemsWithParams(logs, context, "", 10000, 0);
}

export async function getProjectsPickItemsWithParams(
  logs: Logs,
  context: vscode.ExtensionContext,
  filter: string,
  limit: number,
  offset: number
) {
  return await vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => {
        logs.info(messages.cancelLoading);
      });
      progress.report({ message: messages.loadingProjects });
      try {
        const params = `name=${filter},limit=${limit},offset=${offset}`;
        const projectList = await cx.getProjectListWithParams(params);

        return projectList.map((label) => ({
          label: label.name,
          id: label.id,
        }));
      } catch (error) {
        updateStateError(context, constants.errorMessage + error);
        vscode.commands.executeCommand(commands.showError);
        return [];
      }
    }
  );
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
            formattedId: getFormattedId(label, scanList),
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
      const context = getGlobalContext();
      const states = await cx.triageGetStates(false);
      context.globalState.update(constants.customStates, states.payload);
    }
  );
}

export async function loadScanId(
  context: vscode.ExtensionContext,
  scanId: string,
  logs: Logs
) {

  if (scanId && !uuidPattern.test(scanId.trim())) {
    vscode.window.showErrorMessage(messages.scanIdIncorrectFormat);
    return;
  }
  const scan = await getScanWithProgress(logs, scanId);
  if (!scan) {
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
    scanDatetime: undefined,
  });
  updateState(context, constants.branchIdKey, {
    id: scan.branch,
    name: `${constants.branchLabel} ${getProperty(scan, "branch")}`,
    displayScanId: undefined,
    scanDatetime: undefined,
  });
  updateState(context, constants.scanIdKey, {
    id: scan.id,
    name: `${constants.scanLabel} ${getScanLabel(scan.createdAt, scan.id)}`,
    displayScanId: scan.id,
    scanDatetime: `${constants.scanDateLabel} ${getFormattedDateTime(
      scan.createdAt
    )}`,
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
      return await cx.getBranchesWithParams(projectId, "");
    }
  );
}

function debounce(func: (...args: any[]) => void, delay: number) {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}


export async function environmentPicker(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const fetchEnvironments = async (
    filter: string,
    offset: number,
    pageSize: number
  ) => {
    return await getEnvironmentsPickItemsWithParams(
      logs,
      context,
      filter,
      pageSize,
      offset
    );
  };

  const handleEnvironmentSelection = async (item: CxQuickPickItem) => {
    updateState(context, constants.environmentIdKey, {
      id: item.id,
      name: `${constants.environmentLabel} ${item.label}`,
      displayScanId: undefined,
      scanDatetime: undefined,
    });
    await vscode.commands.executeCommand(commands.refreshDastTree);
  };

  await createPicker(
    constants.environmentPlaceholder,
    constants.environmentPickerTitle,
    fetchEnvironments,
    handleEnvironmentSelection
  );
}

export async function getEnvironmentsPickItemsWithParams(
  logs: Logs,
  context: vscode.ExtensionContext,
  filter: string,
  limit: number,
  offset: number
) {
  return await vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => {
        logs.info(messages.cancelLoading);
      });
      progress.report({ message: messages.loadingEnvironments });
      try {
        const from = offset + 1;
        const to = offset + limit;
        let params = `from=${from},to=${to}`;
        if (filter) {
          params += `,search=${filter}`;
        }
        params += ',sort=domain:asc';
        const envList = await cx.getDastEnvironmentsListWithParams(params);
        return envList.map((env) => ({
          label: env.name,
          id: env.id,
        }));
      } catch (error) {
        updateStateError(context, constants.errorMessage + error);
        vscode.commands.executeCommand(commands.showError);
        return [];
      }
    }
  );
}
