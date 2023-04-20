import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { CREATE_SCA_SCAN } from "../utils/common/commands";
import { createSCAScan } from "../views/scaView/scaCreateScanProvider";
import { SCAResultsProvider } from "../views/scaView/scaResultsProvider";

export class SCACommand {
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
      vscode.commands.registerCommand(CREATE_SCA_SCAN, async () => {
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
