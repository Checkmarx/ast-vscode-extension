import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commandBuilder";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { SCAResultsProvider } from "../views/scaView/scaResultsProvider";

export class TreeCommand {
  context: vscode.ExtensionContext;
  astResultsProvider: AstResultsProvider;
  scaResultsProvider: SCAResultsProvider;
  logs: Logs;
  constructor(
    context: vscode.ExtensionContext,
    astResultsProvider: AstResultsProvider,
    scaResultsProvider: SCAResultsProvider,
    logs: Logs
  ) {
    this.context = context;
    this.astResultsProvider = astResultsProvider;
    this.scaResultsProvider = scaResultsProvider;
    this.logs = logs;
  }

  public registerRefreshCommands() {
    this.createRefreshTreeCommand();
    this.createRefreshScaTreeCommand();
  }

  public registerClearCommands() {
    this.clearCommand();
    this.clearScaCommand();
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
}
