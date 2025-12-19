import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
import { DOC_LINKS } from "../constants/documentation";
import { AstResultsPromoProvider } from "../views/resultsView/astResultsPromoProvider";
import { CxOneAssistProvider } from "../views/cxOneAssistView/cxOneAssistProvider";
import { AuthenticationWebview } from "../webview/authenticationWebview";
import { WebViewCommand } from "../commands/webViewCommand";
import { IgnoreFileManager } from "../realtimeScanners/common/ignoreFileManager";

export function registerAssistDocumentation(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commands.assistDocumentation, () => {
      vscode.env.openExternal(vscode.Uri.parse(DOC_LINKS.devAssist));
    })
  );
}

export function registerPromoResultsWebview(context: vscode.ExtensionContext, logs: Logs) {
  const promoProvider = new AstResultsPromoProvider(context, logs);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(commands.astResultsPromo, promoProvider)
  );
  return promoProvider;
}

export function registerScaPromoWebview(context: vscode.ExtensionContext, logs: Logs) {
  const promoProvider = new AstResultsPromoProvider(context, logs, true);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(commands.scaAutoScanPromo, promoProvider)
  );
  return promoProvider;
}

export function registerAssistView(context: vscode.ExtensionContext, ignoreFileManager: IgnoreFileManager, logs: Logs) {
  const cxOneAssistProvider = new CxOneAssistProvider(context, ignoreFileManager, logs);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(commands.astCxOneAssist, cxOneAssistProvider)
  );
  return cxOneAssistProvider;
}

export function registerAssistRelatedCommands(context: vscode.ExtensionContext, cxOneAssistProvider: CxOneAssistProvider) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commands.updateCxOneAssist, async () => {
      await cxOneAssistProvider.onAuthenticationChanged();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(commands.authentication, () => {
      vscode.commands.executeCommand(commands.showAuth);
    })
  );
}

export function registerAuthenticationLauncher(context: vscode.ExtensionContext, webViewCommand: WebViewCommand, logs: Logs) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commands.showAuth, () => {
      AuthenticationWebview.show(context, webViewCommand, logs);
    })
  );
}
