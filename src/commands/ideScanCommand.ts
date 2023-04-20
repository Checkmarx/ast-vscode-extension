import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { CANCEL_SCAN, CREATE_SCAN, POLL_SCAN } from "../utils/common/commands";
import {
  cancelScan,
  createScan,
  pollForScanResult,
} from "../views/resultsView/createScanProvider";

export class IDECommand {
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
      vscode.commands.registerCommand(CREATE_SCAN, async () => {
        await createScan(this.context, this.runScanStatusBar, this.logs);
      })
    );
  }

  private cancelScanCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(CANCEL_SCAN, async () => {
        await cancelScan(this.context, this.runScanStatusBar, this.logs);
      })
    );
  }

  private pollScanCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(POLL_SCAN, async () => {
        await pollForScanResult(this.context, this.runScanStatusBar, this.logs);
      })
    );
  }
}
