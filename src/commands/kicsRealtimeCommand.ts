import * as vscode from "vscode";
import { KicsProvider } from "../kics/kicsRealtimeProvider";
import { Logs } from "../models/logs";
import {
 commands
} from "../utils/common/commands";

export class KICSRealtimeCommand {
  context: vscode.ExtensionContext;
  kicsProvider: KicsProvider;
  logs: Logs;
  constructor(
    context: vscode.ExtensionContext,
    kicsProvider: KicsProvider,
    logs: Logs
  ) {
    this.context = context;
    this.kicsProvider = kicsProvider;
    this.logs = logs;
  }

  public registerKicsScans() {
    this.createScanCommand();
  }

  public registerSettings() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.kicsSetings, () => {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          `Checkmarx KICS`
        );
      })
    );
  }

  public registerKicsRemediation() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.kicsRemediation,
        async (
          fixedResults,
          kicsResults,
          file,
          diagnosticCollection,
          fixAll,
          fixLine
        ) => {
          await this.kicsProvider.kicsRemediation(
            fixedResults,
            kicsResults,
            file,
            diagnosticCollection,
            fixAll,
            fixLine,
            this.logs
          );
        }
      )
    );
  }

  private createScanCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.kicsRealtime,
        async () => await this.kicsProvider.runKics()
      )
    );
  }
}
