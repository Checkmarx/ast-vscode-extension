import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  BRANCH_PICK,
  GENERAL_PICK,
  PROJECT_PICK,
  SCAN_INPUT,
  SCAN_PICK,
} from "../utils/common/commands";
import { multiStepInput } from "../views/resultsView/astMultiStepInput";
import {
  branchPicker,
  projectPicker,
  scanInput,
  scanPicker,
} from "../views/resultsView/pickers";

export class PickerCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.logs = logs;
  }

  public registerPickerCommands() {
    this.createGeneralPickCommand();
    this.createProjectPickCommand();
    this.createBranchPickCommand();
    this.createScanPickCommand();
    this.createScanInputCommand();
  }

  private createGeneralPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(GENERAL_PICK, async () => {
        await multiStepInput(this.logs, this.context);
      })
    );
  }

  private createProjectPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(PROJECT_PICK, async () => {
        await projectPicker(this.context, this.logs);
      })
    );
  }

  private createBranchPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(BRANCH_PICK, async () => {
        await branchPicker(this.context, this.logs);
      })
    );
  }

  private createScanPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(SCAN_PICK, async () => {
        await scanPicker(this.context, this.logs);
      })
    );
  }

  private createScanInputCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(SCAN_INPUT, async () => {
        await scanInput(this.context, this.logs);
      })
    );
  }
}
