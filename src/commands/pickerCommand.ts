import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commands";
import { constants } from "../utils/common/constants";
import { multiStepInput } from "../views/resultsView/astMultiStepInput";
import { dastMultiStepInput, dastScanPicker } from "../views/resultsView/dastMultiStepInput";
import {
  branchPicker,
  projectPicker,
  scanInput,
  scanPicker,
} from "../utils/pickers/pickers";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { getFromState, updateState } from "../utils/common/globalState";

export class PickerCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  resultsProvider : AstResultsProvider;
  constructor(context: vscode.ExtensionContext, logs: Logs,resultsProvider : AstResultsProvider) {
    this.context = context;
    this.logs = logs;
    this.resultsProvider = resultsProvider;
  }

  public registerPickerCommands() {
    this.createGeneralPickCommand();
    this.createProjectPickCommand();
    this.createBranchPickCommand();
    this.createScanPickCommand();
    this.createScanInputCommand();
    // DAST commands
    this.createDastGeneralPickCommand();
    this.createDastScanPickCommand();
    this.createSwitchToSastModeCommand();
    this.createSwitchToDastModeCommand();
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

  // DAST-specific commands
  private createDastGeneralPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.dastGeneralPick, async () => {
        await dastMultiStepInput(this.logs, this.context);
      })
    );
  }

  private createDastScanPickCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.dastScanPick, async () => {
        await dastScanPicker(this.logs, this.context);
      })
    );
  }

  private createSwitchToSastModeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.switchToSastMode, async () => {
        // Save current DAST state before switching
        await this.saveDastState();

        // Restore SAST state
        await this.restoreSastState();

        // Update mode
        await this.context.workspaceState.update(constants.scanModeKey, {
          id: constants.scanModeSast,
          name: constants.scanModeSast,
          displayScanId: undefined,
          scanDatetime: undefined
        });

        // Set context for UI visibility
        await vscode.commands.executeCommand(commands.setContext, "ast-results.scanMode", constants.scanModeSast);
        vscode.window.showInformationMessage("Switched to SAST/SCA mode");
        await vscode.commands.executeCommand(commands.refreshTree);
      })
    );
  }

  private createSwitchToDastModeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.switchToDastMode, async () => {
        // Save current SAST state before switching
        await this.saveSastState();

        // Restore DAST state (or clear if none)
        await this.restoreDastState();

        // Update mode
        await this.context.workspaceState.update(constants.scanModeKey, {
          id: constants.scanModeDast,
          name: constants.scanModeDast,
          displayScanId: undefined,
          scanDatetime: undefined
        });

        // Set context for UI visibility
        await vscode.commands.executeCommand(commands.setContext, "ast-results.scanMode", constants.scanModeDast);
        vscode.window.showInformationMessage("Switched to DAST mode");
        await vscode.commands.executeCommand(commands.refreshTree);
      })
    );
  }

  // Save SAST state (project, branch, scan) to mode-specific keys
  private async saveSastState() {
    const project = getFromState(this.context, constants.projectIdKey);
    const branch = getFromState(this.context, constants.branchIdKey);
    const scan = getFromState(this.context, constants.scanIdKey);

    // Always save current state (even if undefined) to the mode-specific keys
    await this.context.workspaceState.update(constants.sastProjectIdKey, project);
    await this.context.workspaceState.update(constants.sastBranchIdKey, branch);
    await this.context.workspaceState.update(constants.sastScanIdKey, scan);
  }

  // Restore SAST state from mode-specific keys
  private async restoreSastState() {
    const savedProject = getFromState(this.context, constants.sastProjectIdKey);
    const savedBranch = getFromState(this.context, constants.sastBranchIdKey);
    const savedScan = getFromState(this.context, constants.sastScanIdKey);

    // Restore SAST state to active keys
    await this.context.workspaceState.update(constants.projectIdKey, savedProject);
    await this.context.workspaceState.update(constants.branchIdKey, savedBranch);
    await this.context.workspaceState.update(constants.scanIdKey, savedScan);

    // Clear DAST-specific state from active keys
    await this.context.workspaceState.update(constants.environmentIdKey, undefined);
    await this.context.workspaceState.update(constants.dastScanDetailsKey, undefined);
  }

  // Save DAST state (environment, scan, scan details) to mode-specific keys
  private async saveDastState() {
    const environment = getFromState(this.context, constants.environmentIdKey);
    const scan = getFromState(this.context, constants.scanIdKey);
    const scanDetails = this.context.workspaceState.get(constants.dastScanDetailsKey);

    // Always save current state (even if undefined) to the mode-specific keys
    await this.context.workspaceState.update(constants.dastEnvironmentIdKey, environment);
    await this.context.workspaceState.update(constants.dastScanIdKey, scan);
    await this.context.workspaceState.update("ast-results-saved-dast-scan-details", scanDetails);
  }

  // Restore DAST state from mode-specific keys (or clear if none)
  private async restoreDastState() {
    const savedEnvironment = getFromState(this.context, constants.dastEnvironmentIdKey);
    const savedScan = getFromState(this.context, constants.dastScanIdKey);
    const savedScanDetails = this.context.workspaceState.get("ast-results-saved-dast-scan-details");

    // Restore DAST state to active keys (will be undefined if never set)
    await this.context.workspaceState.update(constants.environmentIdKey, savedEnvironment);
    await this.context.workspaceState.update(constants.scanIdKey, savedScan);
    await this.context.workspaceState.update(constants.dastScanDetailsKey, savedScanDetails);

    // Clear SAST-specific state from active keys
    await this.context.workspaceState.update(constants.projectIdKey, undefined);
    await this.context.workspaceState.update(constants.branchIdKey, undefined);
  }

  // Helper to get current scan mode
  public getCurrentScanMode(): string {
    const mode = getFromState(this.context, constants.scanModeKey);
    return mode?.id ?? constants.scanModeSast; // Default to SAST
  }
}
