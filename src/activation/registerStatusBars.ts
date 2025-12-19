import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { messages } from "../utils/common/messages";
import { commands } from "../utils/common/commands";
import { cx } from "../cx";

export async function registerStatusBars(context: vscode.ExtensionContext, logs: Logs) {
  const runScanStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  const runSCAScanStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  runSCAScanStatusBar.text = messages.scaStatusBarConnect;

  async function updateScaStatusBar() {
    const isStandalone = await cx.isStandaloneEnabled(logs);
    if (!isStandalone) {
      runSCAScanStatusBar.show();
    } else {
      runSCAScanStatusBar.hide();
    }
  }
  await updateScaStatusBar();
  context.subscriptions.push(
    vscode.commands.registerCommand(commands.refreshScaStatusBar, async () => {
      await updateScaStatusBar();
    })
  );

  const kicsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  const ignoredStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);

  context.subscriptions.push(
    vscode.commands.registerCommand(commands.refreshKicsStatusBar, async () => {
      const standalone = await cx.isStandaloneEnabled(logs);
      if (!standalone) {
        kicsStatusBarItem.show();
      } else {
        kicsStatusBarItem.hide();
      }
    })
  );
  await vscode.commands.executeCommand(commands.refreshKicsStatusBar);

  return {
    runScanStatusBar,
    runSCAScanStatusBar,
    kicsStatusBarItem,
    statusBarItem,
    ignoredStatusBarItem,
    updateScaStatusBar
  };
}
