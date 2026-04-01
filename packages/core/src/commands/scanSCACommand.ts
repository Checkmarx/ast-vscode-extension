import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commandBuilder";
import { createSCAScan } from "../views/scaView/scaCreateScanProvider";
import { SCAResultsProvider } from "../views/scaView/scaResultsProvider";
import { cx } from "../cx";

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

  public async registerScaScans() {
    this.createScanCommand();
  }

  private createScanCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.createSCAScan, async () => {
        !await cx.isStandaloneEnabled(this.logs) ? await createSCAScan(
          this.context,
          this.runSCAScanStatusBar,
          this.logs,
          this.scaResultsProvider
        ) : undefined;
      })
    );
  }
}
