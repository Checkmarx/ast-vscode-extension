import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commandBuilder";
import { multiStepInput } from "../views/resultsView/astMultiStepInput";
import {
  branchPicker,
  environmentPicker,
  projectPicker,
  scanInput,
  scanPicker,
} from "../utils/pickers/pickers";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";

export class PickerCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  resultsProvider: AstResultsProvider;
  isDastEnabled: boolean;
  constructor(
    context: vscode.ExtensionContext,
    logs: Logs,
    resultsProvider: AstResultsProvider,
    isDastEnabled: boolean,
  ) {
    this.context = context;
    this.logs = logs;
    this.resultsProvider = resultsProvider;
    this.isDastEnabled = isDastEnabled;
  }

  public registerPickerCommands() {
    this.createGeneralPickCommand();
    this.createProjectPickCommand();
    this.createBranchPickCommand();
    this.createScanPickCommand();
    this.createScanInputCommand();
    if (this.isDastEnabled) {
      this.createEnvironmentPickCommand();
    }
  }

  private createGeneralPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.generalPick, async () => {
        await multiStepInput(this.logs, this.context);
      })
    );
  }

  private createProjectPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.projectPick, async () => {
        await projectPicker(this.context, this.logs);
      })
    );
  }

  private createBranchPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.branchPick, async () => {
        await branchPicker(this.context, this.logs);
      })
    );
  }

  private createScanPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.scanPick, async () => {
        await scanPicker(this.context, this.logs);
      })
    );
  }

  private createScanInputCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.scanInput, async () => {
        await scanInput(this.context, this.logs);
      })
    );
  }

  private createEnvironmentPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.environmentPick, async () => {
        await environmentPicker(this.context, this.logs);
      })
    );
  }
}
