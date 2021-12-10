import * as vscode from "vscode";
import { Logs } from "./models/logs";
import { convertDate, getBranchPickItems, getProjectsPickItems, getProjectWithProgress, getProperty, getResultsWithProgress, getScansPickItems, getScanWithProgress } from "./utils/utils";
import { REFRESH_TREE } from "./utils/commands";
import { BRANCH_ID_KEY, BRANCH_LABEL, BRANCH_PLACEHOLDER, PROJECT_ID_KEY, PROJECT_LABEL, PROJECT_PLACEHOLDER, SCAN_ID_KEY, SCAN_LABEL, SCAN_PLACEHOLDER } from "./utils/constants";
import { get, update } from "./utils/globalState";
import { CxQuickPickItem } from "./utils/multiStepUtils";

export async function projectPicker(context: vscode.ExtensionContext, logs: Logs) {
  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = PROJECT_PLACEHOLDER;
  quickPick.items = await getProjectsPickItems(logs);
  quickPick.onDidChangeSelection(async ([item]) => {
    update(context, PROJECT_ID_KEY, { id: item.id, name: `${PROJECT_LABEL} ${item.label}` });
    update(context, BRANCH_ID_KEY, { id: undefined, name: BRANCH_LABEL });
    update(context, SCAN_ID_KEY, { id: undefined, name: SCAN_LABEL });
    await vscode.commands.executeCommand(REFRESH_TREE);
    quickPick.hide();
  });
  quickPick.show();
}

export async function branchPicker(context: vscode.ExtensionContext, logs: Logs) {
  const projectItem = get(context, PROJECT_ID_KEY);
  if (!projectItem || !projectItem.id) {
    vscode.window.showErrorMessage("Please select a project first");
    return;
  }

  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = BRANCH_PLACEHOLDER;
  quickPick.items = await getBranchPickItems(logs, projectItem.id);
  quickPick.onDidChangeSelection(async ([item]) => {
    update(context, BRANCH_ID_KEY, { id: item.id, name: `${BRANCH_LABEL} ${item.label}` });
    update(context, SCAN_ID_KEY, { id: undefined, name: SCAN_LABEL });
    await vscode.commands.executeCommand(REFRESH_TREE);
    quickPick.hide();
  });
  quickPick.show();
}

export async function scanPicker(context: vscode.ExtensionContext, logs: Logs) {
  const projectItem = get(context, PROJECT_ID_KEY);
  const branchItem = get(context, BRANCH_ID_KEY);
  if (!branchItem?.id || !projectItem?.id) {
    vscode.window.showErrorMessage("Please select a project and branch first");
    return;
  }

  const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
  quickPick.placeholder = SCAN_PLACEHOLDER;
  quickPick.items = await getScansPickItems(logs, projectItem.id, branchItem.id);
  quickPick.onDidChangeSelection(async ([item]) => {
    update(context, SCAN_ID_KEY, { id: item.id, name: `${SCAN_LABEL} ${item.label}` });
    await getResultsWithProgress(logs, item.id!); //TODO: Check
    await vscode.commands.executeCommand(REFRESH_TREE);
    quickPick.hide();
  });
  quickPick.show();
}

export async function scanInput(context: vscode.ExtensionContext, logs: Logs) {
  const input = await vscode.window.showInputBox();
  if (!input) {return;}

  const scan = await getScanWithProgress(logs, input);
  if (!scan?.ID || !scan?.ProjectID) {
    vscode.window.showErrorMessage("ScanId not found");
    return;
  }

  const project = await getProjectWithProgress(logs, scan.ProjectID);
  if (!project?.ID) {
    vscode.window.showErrorMessage("Project not found");
    return;
  }

  update(context, PROJECT_ID_KEY, { id: project.ID, name: `${PROJECT_LABEL} ${project.Name}` });
  update(context, BRANCH_ID_KEY, { id: getProperty(scan, 'Branch'), name: `${BRANCH_LABEL} ${getProperty(scan, 'Branch')}` }); //TODO: Hack while we don't have branch in the javasscript wrapper
  update(context, SCAN_ID_KEY, { id: scan.ID, name: `${SCAN_LABEL} ${convertDate(scan.CreatedAt)}` });

  await getResultsWithProgress(logs, scan.ID);
  await vscode.commands.executeCommand(REFRESH_TREE);
}