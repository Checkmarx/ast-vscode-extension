import * as vscode from "vscode";
import {
  cx
} from "../cx";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commandBuilder";
import { getErrorFromState } from "../utils/common/globalState";

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

  public async executeCheckSettings() {

    const isConfiguration = await cx.isValidConfiguration();
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isValidCredentials,
      isConfiguration
    );

    vscode.commands.executeCommand(
      commands.setContext,
      commands.isScaScanEnabled,
      true);

    this.executeCheckScanEnabled();
  }

  public async executeCheckScanEnabled() {
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isScanEnabled,
      await cx.isScanEnabled(this.logs)
    );
  }

  public async executeCheckStandaloneEnabled() {
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isStandaloneEnabled,
      await cx.isStandaloneEnabled(this.logs)
    );
  }

  public async executeCheckCxOneAssistEnabled() {
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isCxOneAssistEnabled,
      await cx.isCxOneAssistEnabled(this.logs)
    );
  }

  public async executeCheckScaScanEnabled() {
    vscode.commands.executeCommand(
      commands.setContext,
      commands.isScaScanEnabled,
      await cx.isSCAScanEnabled()
    );
  }
}
