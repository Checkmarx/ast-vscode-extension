/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import {
  getBranchPickItems,
  getProjectsPickItems,
  getResultsWithProgress,
  getScansPickItems,
} from "../../utils/utils";
import { REFRESH_TREE } from "../../utils/common/commands";
import {
  BRANCH_ID_KEY,
  BRANCH_LABEL,
  PROJECT_ID_KEY,
  PROJECT_LABEL,
  SCAN_ID_KEY,
  SCAN_LABEL,
  SCAN_PICKER_TITLE,
} from "../../utils/common/constants";
import { update } from "../../utils/common/globalState";
import {
  CxQuickPickItem,
  MultiStepInput,
} from "../../utils/pickers/multiStepUtils";

export async function multiStepInput(
  logs: Logs,
  context: vscode.ExtensionContext
) {
  interface State {
    title: string;
    step: number;
    totalSteps: number;
    project: CxQuickPickItem;
    branch: CxQuickPickItem;
    scanId: CxQuickPickItem;
  }

  async function collectInputs() {
    const state = {} as Partial<State>;
    await MultiStepInput.run((input) => pickProject(input, state));
    return state as State;
  }

  async function pickProject(input: MultiStepInput, state: Partial<State>) {
    state.project = await input.showQuickPick({
      title: SCAN_PICKER_TITLE,
      step: 1,
      totalSteps: 3,
      placeholder: PROJECT_LABEL,
      items: await getProjectsPickItems(logs, context),
      shouldResume: shouldResume,
    });
    return (input: MultiStepInput) => pickBranch(input, state);
  }

  async function pickBranch(input: MultiStepInput, state: Partial<State>) {
    let projectId = "";
    if (state.project) {
      projectId = state.project.id;
    }
    state.branch = await input.showQuickPick({
      title: SCAN_PICKER_TITLE,
      step: 2,
      totalSteps: 3,
      placeholder: BRANCH_LABEL,
      items: await getBranchPickItems(logs, projectId, context),
      shouldResume: shouldResume,
    });
    return (input: MultiStepInput) => pickScan(input, state);
  }

  async function pickScan(input: MultiStepInput, state: Partial<State>) {
    let projectId = "";
    if (state.project && state.project.id) {
      projectId = state.project.id;
    }
    let branchId = "";
    if (state.branch && state.branch.id) {
      branchId = state.branch.id;
    }

    state.scanId = await input.showQuickPick({
      title: SCAN_PICKER_TITLE,
      step: 2,
      totalSteps: 3,
      placeholder: SCAN_LABEL,
      items: await getScansPickItems(logs, projectId, branchId, context),
      shouldResume: shouldResume,
    });
  }

  function shouldResume() {
    return new Promise<boolean>(() => {});
  }

  const state = await collectInputs();
  update(context, PROJECT_ID_KEY, {
    id: state.project.id,
    name: `${PROJECT_LABEL} ${state.project.label}`,
  });
  update(context, BRANCH_ID_KEY, {
    id: state.branch.id,
    name: `${BRANCH_LABEL} ${state.branch.label}`,
  });
  update(context, SCAN_ID_KEY, {
    id: state.scanId.id,
    name: `${SCAN_LABEL} ${state.scanId.label}`,
  });

  if (state.scanId?.id) {
    await getResultsWithProgress(logs, state.scanId.id);
    vscode.commands.executeCommand(REFRESH_TREE);
  }
}
