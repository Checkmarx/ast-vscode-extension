import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { IgnoreFileManager } from "../realtimeScanners/common/ignoreFileManager";
import { commands } from "../utils/common/commands";
import { cx } from "../cx";
import { CxOneAssistProvider } from "../views/cxOneAssistView/cxOneAssistProvider";

export function registerIgnoredStatusBar(
  context: vscode.ExtensionContext,
  logs: Logs,
  ignoreFileManager: IgnoreFileManager,
  ignoredStatusBarItem: vscode.StatusBarItem,
  cxOneAssistProvider: CxOneAssistProvider
) {
  async function updateIgnoredStatusBar() {
    if (await cx.isValidConfiguration() && (await cx.isCxOneAssistEnabled(logs) || await cx.isStandaloneEnabled(logs))) {
      const count = ignoreFileManager.getIgnoredPackagesCount();
      const hasIgnoreFile = ignoreFileManager.hasIgnoreFile();
      if (hasIgnoreFile) {
        ignoredStatusBarItem.text = `$(circle-slash) ${count}`;
        ignoredStatusBarItem.tooltip = count > 0
          ? `${count} ignored vulnerabilities - Click to view`
          : `No ignored vulnerabilities - Click to view`;
        ignoredStatusBarItem.command = commands.openIgnoredView;
        ignoredStatusBarItem.show();
      } else {
        ignoredStatusBarItem.hide();
      }
      cxOneAssistProvider.updateWebviewContent();
    } else {
      ignoredStatusBarItem.hide();
    }
  }
  context.subscriptions.push(
    vscode.commands.registerCommand(commands.refreshIgnoredStatusBar, async () => {
      await updateIgnoredStatusBar();
    })
  );
  ignoreFileManager.setStatusBarUpdateCallback(updateIgnoredStatusBar);
  updateIgnoredStatusBar();
  return { updateIgnoredStatusBar };
}
