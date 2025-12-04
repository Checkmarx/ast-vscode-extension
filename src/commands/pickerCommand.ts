import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commands";
import { constants } from "../utils/common/constants";
import { multiStepInput } from "../views/resultsView/astMultiStepInput";
import { dastMultiStepInput } from "../views/resultsView/dastMultiStepInput";
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

  private createSwitchToSastModeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.switchToSastMode, async () => {
        // Save current DAST state before switching
        this.saveDastState();

        // Restore SAST state
        this.restoreSastState();

        // Update mode
        updateState(this.context, constants.scanModeKey, {
          id: constants.scanModeSast,
          name: constants.scanModeSast,
          displayScanId: undefined,
          scanDatetime: undefined
        });

        // Set context for UI visibility
        vscode.commands.executeCommand(commands.setContext, "ast-results.scanMode", constants.scanModeSast);
        vscode.window.showInformationMessage("Switched to SAST/SCA mode");
        vscode.commands.executeCommand(commands.refreshTree);
      })
    );
  }

  private createSwitchToDastModeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.switchToDastMode, async () => {
        // Save current SAST state before switching
        this.saveSastState();

        // Restore DAST state (or clear if none)
        this.restoreDastState();

        // Update mode
        updateState(this.context, constants.scanModeKey, {
          id: constants.scanModeDast,
          name: constants.scanModeDast,
          displayScanId: undefined,
          scanDatetime: undefined
        });

        // Set context for UI visibility
        vscode.commands.executeCommand(commands.setContext, "ast-results.scanMode", constants.scanModeDast);
        vscode.window.showInformationMessage("Switched to DAST mode");
        vscode.commands.executeCommand(commands.refreshTree);
      })
    );
  }

  // Save SAST state (project, branch, scan) to mode-specific keys
  private saveSastState() {
    const project = getFromState(this.context, constants.projectIdKey);
    const branch = getFromState(this.context, constants.branchIdKey);
    const scan = getFromState(this.context, constants.scanIdKey);

    if (project) {
      updateState(this.context, constants.sastProjectIdKey, project);
    }
    if (branch) {
      updateState(this.context, constants.sastBranchIdKey, branch);
    }
    if (scan) {
      updateState(this.context, constants.sastScanIdKey, scan);
    }
  }

  // Restore SAST state from mode-specific keys
  private restoreSastState() {
    const savedProject = getFromState(this.context, constants.sastProjectIdKey);
    const savedBranch = getFromState(this.context, constants.sastBranchIdKey);
    const savedScan = getFromState(this.context, constants.sastScanIdKey);

    updateState(this.context, constants.projectIdKey, savedProject || undefined);
    updateState(this.context, constants.branchIdKey, savedBranch || undefined);
    updateState(this.context, constants.scanIdKey, savedScan || undefined);

    // Clear DAST-specific state from active keys
    updateState(this.context, constants.environmentIdKey, undefined);
  }

  // Save DAST state (environment, scan) to mode-specific keys
  private saveDastState() {
    const environment = getFromState(this.context, constants.environmentIdKey);
    const scan = getFromState(this.context, constants.scanIdKey);

    if (environment) {
      updateState(this.context, constants.dastEnvironmentIdKey, environment);
    }
    if (scan) {
      updateState(this.context, constants.dastScanIdKey, scan);
    }
  }

  // Restore DAST state from mode-specific keys (or clear if none)
  private restoreDastState() {
    const savedEnvironment = getFromState(this.context, constants.dastEnvironmentIdKey);
    const savedScan = getFromState(this.context, constants.dastScanIdKey);

    updateState(this.context, constants.environmentIdKey, savedEnvironment || undefined);
    updateState(this.context, constants.scanIdKey, savedScan || undefined);

    // Clear SAST-specific state from active keys
    updateState(this.context, constants.projectIdKey, undefined);
    updateState(this.context, constants.branchIdKey, undefined);
  }

  // Helper to get current scan mode
  public getCurrentScanMode(): string {
    const mode = getFromState(this.context, constants.scanModeKey);
    return mode?.id ?? constants.scanModeSast; // Default to SAST
  }
}
