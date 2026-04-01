import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { SCAResultsProvider } from "../views/scaView/scaResultsProvider";
import { TreeItem } from "../utils/tree/treeItem";
import { commands } from "../utils/common/commandBuilder";
import { constants } from "../utils/common/constants";

/**
 * Handles commands related to opening details from diagnostic panel.
 * This includes navigation from the Problems panel to result details.
 */
export class DiagnosticCommand {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logs: Logs,
    private readonly astResultsProvider: AstResultsProvider,
    private readonly scaResultsProvider: SCAResultsProvider,
    private readonly astTree: vscode.TreeView<TreeItem>,
    private readonly scaTree: vscode.TreeView<TreeItem>
  ) { }

  /**
   * Registers the openDetailsFromDiagnostic command.
   * This command is triggered when clicking on diagnostic links in the Problems panel.
   */
  public registerOpenDetailsFromDiagnostic(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.openDetailsFromDiagnostic,
        async (payload?: {
          label?: string;
          fileName?: string;
          line?: number;
          uniqueId?: string;
          packageIdentifier?: string;
          resultId?: string;
        }) => this.handleOpenDetailsFromDiagnostic(payload)
      )
    );
  }

  /**
   * Handles the logic for opening details from a diagnostic.
   * Searches both SAST and SCA Realtime result trees.
   */
  private async handleOpenDetailsFromDiagnostic(payload?: {
    label?: string;
    fileName?: string;
    line?: number;
    uniqueId?: string;
    packageIdentifier?: string;
    resultId?: string;
  }): Promise<void> {
    try {
      if (!payload) {
        return;
      }

      const { uniqueId, fileName, line } = payload;
      this.logs.info(
        `[openDetailsFromDiagnostic] Searching for: uniqueId=${uniqueId}, fileName=${fileName}, line=${line}`
      );

      // Try to find and handle in SAST results tree
      const sastHandled = await this.tryHandleSastResult(uniqueId, fileName, line);
      if (sastHandled) {
        return;
      }

      // Try to find and handle in SCA Realtime results tree
      const scaHandled = await this.tryHandleScaResult(uniqueId, fileName, line);
      if (scaHandled) {
        return;
      }

      // No match found in either tree
      this.logs.error(
        `[openDetailsFromDiagnostic] No match found for uniqueId=${uniqueId}, fileName=${fileName}, line=${line}`
      );
    } catch (error) {
      this.logs.error(`[openDetailsFromDiagnostic] Error: ${error}`);
    }
  }

  /**
   * Attempts to find and handle a result in the SAST results tree.
   */
  private async tryHandleSastResult(
    uniqueId?: string,
    fileName?: string,
    line?: number
  ): Promise<boolean> {
    const handled = await this.astResultsProvider.handleOpenDetailsFromDiagnostic(
      { uniqueId, fileName, line },
      this.astTree,
      commands.newDetails
    );

    if (handled) {
      this.logs.info(`[openDetailsFromDiagnostic] Match found and handled in SAST results`);
    }

    return handled;
  }

  /**
   * Attempts to find and handle a result in the SCA Realtime results tree.
   */
  private async tryHandleScaResult(
    uniqueId?: string,
    fileName?: string,
    line?: number
  ): Promise<boolean> {
    this.logs.info(`[openDetailsFromDiagnostic] Searching in SCA Realtime tree...`);

    const handled = await this.scaResultsProvider.handleOpenDetailsFromDiagnostic(
      { uniqueId, fileName, line },
      this.scaTree,
      commands.newDetails,
      [constants.realtime]
    );

    if (handled) {
      this.logs.info(`[openDetailsFromDiagnostic] Match found and handled in SCA Realtime results`);
    }

    return handled;
  }
}

