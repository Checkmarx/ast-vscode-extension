/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import {
  QuickPickItem,
  window,
  Disposable,
  CancellationToken,
  QuickInputButton,
  QuickInput,
  ExtensionContext,
  QuickInputButtons,
  Uri,
} from "vscode";
import {
  getBranches,
  getProjectList,
  getResults,
  getScans,
  Item,
  updateBranchId,
  updateProjectId,
  updateScanId,
} from "./utils";

/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 *
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 */
export async function multiStepInput(context: ExtensionContext) {
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

  const title = "Wizard select";

  async function pickProject(input: MultiStepInput, state: Partial<State>) {
    const projectList = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Checkmarx",
      },
      async (progress, token) => {
        progress.report({ message: "Loading projects" });
        const projectList = await getProjectList();
        return projectList;
      }
    );
    const projectListPickItem = projectList.map((label) => ({
      label: label.Name,
      id: label.ID,
    }));

    state.project = await input.showQuickPick({
      title,
      step: 1,
      totalSteps: 3,
      placeholder: "project",
      items: projectListPickItem,
      shouldResume: shouldResume,
    });
    return (input: MultiStepInput) => pickBranch(input, state);
  }

  async function pickBranch(input: MultiStepInput, state: Partial<State>) {
    const projectId = state.project?.id;
    const branches = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Checkmarx",
      },
      async (progress, token) => {
        progress.report({ message: "Loading branches" });
        const projectList = await getBranches(projectId);
        return projectList;
      }
    );
    const branchesPickList = branches.map((label) => ({
      label: label,
      id: label,
    }));

    state.branch = await input.showQuickPick({
      title,
      step: 2,
      totalSteps: 3,
      placeholder: "branch",
      items: branchesPickList,
      shouldResume: shouldResume,
    });
    return (input: MultiStepInput) => pickScan(input, state);
  }

  async function pickScan(input: MultiStepInput, state: Partial<State>) {
    const projectId = state.project?.id;
    const branchId = state.branch?.id;
    const scans = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Checkmarx",
      },
      async (progress, token) => {
        progress.report({ message: "Loading scans" });
        const projectList = await await getScans(
          projectId,
          branchId?.replace("branch ", "")
        );
        return projectList;
      }
    );
    const scansPickList = scans.map((label) => ({
      label: label.CreatedAt,
      id: label.ID,
    }));

    state.scanId = await input.showQuickPick({
      title,
      step: 2,
      totalSteps: 3,
      placeholder: "project ID",
      items: scansPickList,
      shouldResume: shouldResume,
    });
  }

  function shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>((resolve, reject) => {
      // noop
    });
  }

  const state = await collectInputs();
  var i = new Item();
  i.id = state.project.id ? "project " + state.project.id : "project";
  i.name = state.project.label ? state.project.label : "project";
  updateProjectId(context, i);
  var i = new Item();
  i.id = state.branch.id ? "branch " + state.branch.id : "branch";
  i.name = state.branch.label ? state.branch.label : "branch";
  updateBranchId(context, i);
  var i = new Item();
  i.id = state.scanId.id ? state.scanId.id : "scan ID";
  i.name = state.scanId.label ? state.scanId.label : "scan ID";
  updateScanId(context, i);
  await getResults(state.scanId.id!);
  vscode.commands.executeCommand("setContext", "scan_pick", true);
  vscode.commands.executeCommand("setContext", "branch_pick", true);
  vscode.commands.executeCommand("ast-results.refreshTree");
}

// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------

class InputFlowAction {
  static back = new InputFlowAction();
  static cancel = new InputFlowAction();
  static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
  title: string;
  step: number;
  totalSteps: number;
  items: T[];
  activeItem?: T;
  placeholder: string;
  buttons?: QuickInputButton[];
  shouldResume: () => Thenable<boolean>;
}

export class CxQuickPickItem implements vscode.QuickPickItem {
  label!: string;

  description?: string;

  detail?: string;

  picked?: boolean;

  alwaysShow?: boolean;

  id?: string;
}

interface InputBoxParameters {
  title: string;
  step: number;
  totalSteps: number;
  value: string;
  prompt: string;
  validate: (value: string) => Promise<string | undefined>;
  buttons?: QuickInputButton[];
  shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {
  static async run<T>(start: InputStep) {
    const input = new MultiStepInput();
    return input.stepThrough(start);
  }

  private current?: QuickInput;
  private steps: InputStep[] = [];

  private async stepThrough<T>(start: InputStep) {
    let step: InputStep | void = start;
    while (step) {
      this.steps.push(step);
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        step = await step(this);
      } catch (err) {
        if (err === InputFlowAction.back) {
          this.steps.pop();
          step = this.steps.pop();
        } else if (err === InputFlowAction.resume) {
          step = this.steps.pop();
        } else if (err === InputFlowAction.cancel) {
          step = undefined;
        } else {
          throw err;
        }
      }
    }
    if (this.current) {
      this.current.dispose();
    }
  }

  async showQuickPick<
    T extends QuickPickItem,
    P extends QuickPickParameters<T>
  >({
    title,
    step,
    totalSteps,
    items,
    activeItem,
    placeholder,
    buttons,
    shouldResume,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<
        T | (P extends { buttons: (infer I)[] } ? I : never)
      >((resolve, reject) => {
        const input = window.createQuickPick<T>();
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        input.placeholder = placeholder;
        input.items = items;
        if (activeItem) {
          input.activeItems = [activeItem];
        }
        input.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
          ...(buttons || []),
        ];
        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            } else {
              resolve(<any>item);
            }
          }),
          input.onDidChangeSelection((items) => resolve(items[0])),
          input.onDidHide(() => {
            (async () => {
              reject(
                shouldResume && (await shouldResume())
                  ? InputFlowAction.resume
                  : InputFlowAction.cancel
              );
            })().catch(reject);
          })
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }

  async showInputBox<P extends InputBoxParameters>({
    title,
    step,
    totalSteps,
    value,
    prompt,
    validate,
    buttons,
    shouldResume,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<
        string | (P extends { buttons: (infer I)[] } ? I : never)
      >((resolve, reject) => {
        const input = window.createInputBox();
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        input.value = value || "";
        input.prompt = prompt;
        input.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
          ...(buttons || []),
        ];
        let validating = validate("");
        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            } else {
              resolve(<any>item);
            }
          }),
          input.onDidAccept(async () => {
            const value = input.value;
            input.enabled = false;
            input.busy = true;
            if (!(await validate(value))) {
              resolve(value);
            }
            input.enabled = true;
            input.busy = false;
          }),
          input.onDidChangeValue(async (text) => {
            const current = validate(text);
            validating = current;
            const validationMessage = await current;
            if (current === validating) {
              input.validationMessage = validationMessage;
            }
          }),
          input.onDidHide(() => {
            (async () => {
              reject(
                shouldResume && (await shouldResume())
                  ? InputFlowAction.resume
                  : InputFlowAction.cancel
              );
            })().catch(reject);
          })
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }
}
