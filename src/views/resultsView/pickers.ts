import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import {
  getBranchPickItems,
  getProjectsPickItems,
  getResultsWithProgress,
  getScansPickItems,
  loadScanId,
} from "../../utils/utils";
import { REFRESH_TREE } from "../../utils/common/commands";
import {
  BRANCH_ID_KEY,
  BRANCH_LABEL,
  BRANCH_PLACEHOLDER,
  PROJECT_ID_KEY,
  PROJECT_LABEL,
  PROJECT_PLACEHOLDER,
  SCAN_ID_KEY,
  SCAN_LABEL,
  SCAN_PLACEHOLDER,
} from "../../utils/common/constants";
import { get, update } from "../../utils/common/globalState";
import { CxQuickPickItem } from "../../utils/pickers/multiStepUtils";
import { messages } from "../../utils/common/messages";

export async function projectPicker(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = PROJECT_PLACEHOLDER;
  quickPick.items = await getProjectsPickItems(logs, context);
  quickPick.onDidChangeSelection(async ([item]) => {
    update(context, PROJECT_ID_KEY, {
      id: item.id,
      name: `${PROJECT_LABEL} ${item.label}`,
    });
    update(context, BRANCH_ID_KEY, { id: undefined, name: BRANCH_LABEL });
    update(context, SCAN_ID_KEY, { id: undefined, name: SCAN_LABEL });
    await vscode.commands.executeCommand(REFRESH_TREE);
    quickPick.hide();
  });
  quickPick.show();
}

export async function branchPicker(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const projectItem = get(context, PROJECT_ID_KEY);
  // Check if project is picked
  if (!projectItem || !projectItem.id) {
    vscode.window.showErrorMessage(messages.pickerProjectMissing);
    return;
  }
  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = BRANCH_PLACEHOLDER;
  quickPick.items = await getBranchPickItems(logs, projectItem.id, context);
  quickPick.onDidChangeSelection(async ([item]) => {
    update(context, BRANCH_ID_KEY, {
      id: item.id,
      name: `${BRANCH_LABEL} ${item.label}`,
    });
    if (projectItem.id && item.id) {
      const scanList = await getScansPickItems(
        logs,
        projectItem.id,
        item.id,
        context
      );
      if (scanList.length > 0) {
        update(context, SCAN_ID_KEY, {
          id: scanList[0].id,
          name: `${SCAN_LABEL} ${scanList[0].label}`,
        });
        await getResultsWithProgress(logs, scanList[0].id);
      } else {
        update(context, SCAN_ID_KEY, { id: undefined, name: SCAN_LABEL });
      }
    } else {
      vscode.window.showErrorMessage(messages.pickerBranchProjectMissing);
    }
    await vscode.commands.executeCommand(REFRESH_TREE);
    quickPick.hide();
  });
  quickPick.show();
}

export async function scanPicker(context: vscode.ExtensionContext, logs: Logs) {
  const projectItem = get(context, PROJECT_ID_KEY);
  const branchItem = get(context, BRANCH_ID_KEY);
  if (!branchItem?.id || !projectItem?.id) {
    vscode.window.showErrorMessage(messages.pickerBranchProjectMissing);
    return;
  }

  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = SCAN_PLACEHOLDER;
  quickPick.items = await getScansPickItems(
    logs,
    projectItem.id,
    branchItem.id,
    context
  );
  quickPick.onDidChangeSelection(async ([item]) => {
    update(context, SCAN_ID_KEY, {
      id: item.id,
      name: `${SCAN_LABEL} ${item.label}`,
    });
    if (item.id) {
      await getResultsWithProgress(logs, item.id);
      await vscode.commands.executeCommand(REFRESH_TREE);
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
