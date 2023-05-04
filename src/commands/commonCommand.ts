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
import { getErrorFromState } from "../utils/common/globalState";
import { constants } from "../utils/common/constants";
import { messages } from "../utils/common/messages";

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
          commands.openSettings,
          commands.openSettingsArgs
        );
      })
    );
  }

  public registerErrors() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.showError, () => {
        const err = getErrorFromState(this.context);
        if (err) {
          vscode.window.showErrorMessage(err);
        }
      })
    );
  }

  public executeCheckSettings() {
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isValidCredentials,
      getAstConfiguration() ? true : false
    );
  }

  public async executeCheckScanEnabled() {
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isScanEnabled,
      await isScanEnabled(this.logs)
    );
  }

  public async executeCheckScaScanEnabled() {
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isScaScanEnabled,
      await isSCAScanEnabled()
    );
  }
}
