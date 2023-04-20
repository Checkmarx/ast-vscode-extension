import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  CLEAR,
  REFRESH_SCA_TREE,
  REFRESH_TREE,
} from "../utils/common/commands";
import { CLEAR_SCA } from "../utils/common/constants";
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

  public registeClearCommands() {
    this.clearCommand();
    this.clearScaCommand();
  }

  private createRefreshTreeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        REFRESH_TREE,
        async () => await this.astResultsProvider.refreshData()
      )
    );
  }

  private createRefreshScaTreeCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        REFRESH_SCA_TREE,
        async () => await this.scaResultsProvider.refreshData()
      )
    );
  }

  private clearCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        CLEAR,
        async () => await this.astResultsProvider.clean()
      )
    );
  }

  private clearScaCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        CLEAR_SCA,
        async () => await this.scaResultsProvider.clean()
      )
    );
  }
}
