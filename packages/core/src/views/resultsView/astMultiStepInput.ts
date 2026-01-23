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
} from "../../utils/pickers/pickers";
import { commands } from "../../utils/common/commandBuilder";
import {
  constants
} from "../../utils/common/constants";
import { updateState } from "../../utils/common/globalState";
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
      title: constants.scanPickerTitle,
      step: 1,
      totalSteps: 3,
      placeholder: constants.projectLabel,
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
      title: constants.scanPickerTitle,
      step: 2,
      totalSteps: 3,
      placeholder: constants.branchLabel,
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
      title: constants.scanPickerTitle,
      step: 2,
      totalSteps: 3,
      placeholder: constants.scanLabel,
      items: await getScansPickItems(logs, projectId, branchId, context),
      shouldResume: shouldResume,
    });
  }

  function shouldResume() {
    return new Promise<boolean>(() => { });
  }

  const state = await collectInputs();
  updateState(context, constants.projectIdKey, {
    id: state.project.id,
    name: `${constants.projectLabel} ${state.project.label}`,
    displayScanId: undefined,
    scanDatetime: undefined
  });
  updateState(context, constants.branchIdKey, {
    id: state.branch.id,
    name: `${constants.branchLabel} ${state.branch.label}`,
    displayScanId: undefined,
    scanDatetime: undefined
  });
  updateState(context, constants.scanIdKey, {
    id: state.scanId.id,
    name: `${constants.scanLabel} ${state.scanId.label}`,
    displayScanId: `${constants.scanLabel} ${state.scanId.formattedId}`,
    scanDatetime: state.scanId.datetime
  });

  if (state.scanId?.id) {
    await getResultsWithProgress(logs, state.scanId.id);
    vscode.commands.executeCommand(commands.refreshTree);
  }
}
