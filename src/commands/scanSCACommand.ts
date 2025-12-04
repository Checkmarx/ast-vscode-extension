import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
import { createSCAScan } from "../views/scaView/scaCreateScanProvider";
import { SCAResultsProvider } from "../views/scaView/scaResultsProvider";

export class ScanSCACommand {
  context: vscode.ExtensionContext;
  runSCAScanStatusBar: vscode.StatusBarItem;
  scaResultsProvider: SCAResultsProvider;
  logs: Logs;
  constructor(
    context: vscode.ExtensionContext,
    runSCAScanStatusBar: vscode.StatusBarItem,
    scaResultsProvider: SCAResultsProvider,
    logs: Logs
  ) {
    this.context = context;
    this.runSCAScanStatusBar = runSCAScanStatusBar;
    this.scaResultsProvider = scaResultsProvider;
    this.logs = logs;
  }

  public registerScaScans() {
    this.createScanCommand();
  }

  private createScanCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.createScaScan, async () => {
        await createSCAScan(
          this.context,
          this.runSCAScanStatusBar,
          this.logs,
          this.scaResultsProvider
        );
      })
    );
  }
}
