import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commandBuilder";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { SCAResultsProvider } from "../views/scaView/scaResultsProvider";
import { DastResultsProvider } from "../views/dastView/dastResultsProvider";

export class TreeCommand {
  context: vscode.ExtensionContext;
  astResultsProvider: AstResultsProvider;
  scaResultsProvider: SCAResultsProvider;
  dastResultsProvider?: DastResultsProvider;
  logs: Logs;
  constructor(
    context: vscode.ExtensionContext,
    astResultsProvider: AstResultsProvider,
    scaResultsProvider: SCAResultsProvider,
    logs: Logs,
    dastResultsProvider?: DastResultsProvider
  ) {
    this.context = context;
    this.astResultsProvider = astResultsProvider;
    this.scaResultsProvider = scaResultsProvider;
    this.dastResultsProvider = dastResultsProvider;
    this.logs = logs;
  }

  public registerRefreshCommands() {
    this.createRefreshTreeCommand();
    this.createRefreshScaTreeCommand();
    this.createRefreshDastTreeCommand();
  }

  public registerClearCommands() {
    this.clearCommand();
    this.clearScaCommand();
    this.clearDastCommand();
  }

  private createRefreshTreeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.refreshTree,
        async () => await this.astResultsProvider.refreshData()
      )
    );
  }

  private createRefreshScaTreeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.refreshScaTree,
        async () => await this.scaResultsProvider.refreshData()
      )
    );
  }

  private clearCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.clear,
        async () => await this.astResultsProvider.clean()
      )
    );
  }

  private clearScaCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.clearSca,
        async () => await this.scaResultsProvider.clean()
      )
    );
  }

  private createRefreshDastTreeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.refreshDastTree,
        async () => {
          if (this.dastResultsProvider) {
            await this.dastResultsProvider.refreshData();
          }
        }
      )
    );
  }

  private clearDastCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.clearDast,
        async () => {
          if (this.dastResultsProvider) {
            await this.dastResultsProvider.clean();
          }
        }
      )
    );
  }
}
