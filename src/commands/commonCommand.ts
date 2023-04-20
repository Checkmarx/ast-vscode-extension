import * as vscode from "vscode";
import {
  getAstConfiguration,
  isScanEnabled,
  isSCAScanEnabled,
} from "../ast/ast";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commands";
import { getError } from "../utils/common/globalState";

export class CommonCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.logs = logs;
  }

  public registerSettings() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.setings, () => {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          `@ext:checkmarx.ast-results`
        );
      })
    );
  }

  public registerErrors() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.showError, () => {
        const err = getError(this.context);
        if (err) {
          vscode.window.showErrorMessage(err);
        }
      })
    );
  }

  public executeCheckSettings() {
    vscode.commands.executeCommand(
      "setContext",
      commands.isValidCredentials,
      getAstConfiguration() ? true : false
    );
  }

  public async executeCheckScanEnabled() {
    vscode.commands.executeCommand(
      "setContext",
      commands.isScanEnabled,
      await isScanEnabled(this.logs)
    );
  }

  public async executeCheckScaScanEnabled() {
    vscode.commands.executeCommand(
      "setContext",
      commands.isScaScanEnabled,
      await isSCAScanEnabled()
    );
  }

  public async executeCheckSettingsChange(
    kicsStatusBarItem: vscode.StatusBarItem
  ) {
    vscode.workspace.onDidChangeConfiguration(async () => {
      vscode.commands.executeCommand(
        "setContext",
        commands.isValidCredentials,
        getAstConfiguration() ? true : false
      );
      vscode.commands.executeCommand(
        "setContext",
        commands.isValidCredentials,
        await isScanEnabled(this.logs)
      );
      const onSave = vscode.workspace
        .getConfiguration("CheckmarxKICS")
        .get("Activate KICS Auto Scanning") as boolean;
      kicsStatusBarItem.text =
        onSave === true
          ? "$(check) Checkmarx kics"
          : "$(debug-disconnect) Checkmarx kics";
      await vscode.commands.executeCommand(commands.refreshTree);
    });
  }
}
