import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commandBuilder";
import {
  cancelScan,
  createScan,
  pollForScanResult,
} from "../views/resultsView/createScanProvider";

export class ScanCommand {
  context: vscode.ExtensionContext;
  runScanStatusBar: vscode.StatusBarItem;
  logs: Logs;
  constructor(
    context: vscode.ExtensionContext,
    runScanStatusBar: vscode.StatusBarItem,
    logs: Logs
  ) {
    this.context = context;
    this.runScanStatusBar = runScanStatusBar;
    this.logs = logs;
  }

  public registerIdeScans() {
    this.createScanCommand();
    this.cancelScanCommand();
    this.pollScanCommand();
  }

  private createScanCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.createScan, async () => {
        await createScan(this.context, this.runScanStatusBar, this.logs);
      })
    );
  }

  private cancelScanCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.cancelScan, async () => {
        await cancelScan(this.context, this.runScanStatusBar, this.logs);
      })
    );
  }

  private pollScanCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.pollScan, async () => {
        await pollForScanResult(this.context, this.runScanStatusBar, this.logs);
      })
    );
  }

  public executePollScan() {
    vscode.commands.executeCommand(commands.pollScan);
  }

}
