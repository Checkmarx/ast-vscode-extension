import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { installVorpal, scanVorpal } from "../vorpal/scanVorpal";

let timeout = null;
export class VorpalCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  onDidChangeTextDocument: vscode.Disposable;
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.logs = logs;
  }
  public registerVorpal() {
    const vorpalActive = vscode.workspace
      .getConfiguration("CheckmarxVorpal")
      .get("Activate Vorpal Auto Scanning") as boolean;
    if (vorpalActive) {
      this.installVorpal();
      this.registerVorpalScanOnChangeText();
    } else {
      this.disposeVorpalScanOnChangeText();
    }
  }
  public installVorpal() {
    installVorpal(this.logs);
    this.onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
      this.debounce(this.onTextChange, 2000)
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

  public registerVorpalScanOnChangeText() {
    this.context.subscriptions.push(this.onDidChangeTextDocument);
  }
  public disposeVorpalScanOnChangeText() {
    // const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(this.debouncedOnTextChange);
    if (this.onDidChangeTextDocument) {
      this.onDidChangeTextDocument.dispose();
      this.context.subscriptions.push(this.onDidChangeTextDocument);
    }
  }
}
