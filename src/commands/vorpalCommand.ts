import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { fixesMap, installVorpal, scanVorpal } from "../vorpal/scanVorpal";
import { constants } from "../utils/common/constants";

let timeout = null;
export class VorpalCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  debouncedOnTextChange: (...args: any[]) => void;
  // timeout: NodeJS.Timeout;

  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.logs = logs;
    // this.timeout = null;
  }

  public installVorpal() {
    installVorpal(this.logs);
    this.debouncedOnTextChange = this.debounce(this.onTextChange, 2000);
  }

  public registerQuickFix() {
    this.context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        "plaintext",
        new QuickFixProvider()
        // {
        //   providedCodeActionKinds: QuickFixProvider.providedCodeActionKinds,
        // }
      )
    );
  }

  private onTextChange(event) {
    try {
      scanVorpal(event.document);
    } catch (error) {
      console.error(error);
      this.logs.warn("fail to scan vorpal");
    }
  }
  // Debounce function
  private debounce(func, wait) {
    return function (...args) {
      try {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      } catch (error) {
        console.error(error);
      }
    };
  }

  public registerVorpalScanOnChangeTest() {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(this.debouncedOnTextChange)
    );
  }
}
export class QuickFixProvider implements vscode.CodeActionProvider {

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const diagnostics = context.diagnostics.filter(
      (diagnostic) =>
        diagnostic.source === constants.vorpalEngineName &&
        diagnostic.relatedInformation != null &&
        diagnostic.range === range
    );
    if (diagnostics.length === 0) {
      return;
    }
    const fix = new vscode.CodeAction(
      "Fix the example issue",
      vscode.CodeActionKind.QuickFix
    );
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.replace(
      document.uri,
      diagnostics[0].range,
      fixesMap.get(diagnostics[0].code)
    );
    fix.diagnostics = diagnostics;
    fix.isPreferred = true;
    return [fix];
  }
}
