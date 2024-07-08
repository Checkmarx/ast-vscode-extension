import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { installVorpal, scanVorpal } from "../vorpal/scanVorpal";

let timeout = null;
export class VorpalCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  onDidChangeTextDocument: vscode.Disposable;
  onDidChangeActiveTextEditor: vscode.Disposable;
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
      this.logs.info("Vorpal Auto Scanning is disabled now.");
    }
  }
  public installVorpal() {
    installVorpal(this.logs);
    this.onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
      // Must be no less than 2000ms. Otherwise, the temporary file can be deleted before the vorpal scan is finished.
      this.debounce(this.onTextChange, 2000) 
    );
  }

  public onTextChange(event) {
    try {
      scanVorpal(event.document, this.logs);
    } catch (error) {
      console.error(error);
      this.logs.warn("fail to scan vorpal");
    }
  }
  // Debounce function
  public debounce(func, wait) {
    const context = this;
    return function (...args) {
      try {
        const later = () => {
          clearTimeout(timeout);
          func.apply(context, args);
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
    this.onDidChangeActiveTextEditor=vscode.window.onDidChangeActiveTextEditor((event)=>{
      if(event && event.document){
        this.onTextChange(event);
      }
    });
    this.context.subscriptions.push(this.onDidChangeActiveTextEditor);

  }
  public disposeVorpalScanOnChangeText() {
    if (this.onDidChangeTextDocument) {
      this.onDidChangeTextDocument.dispose();
      this.context.subscriptions.push(this.onDidChangeTextDocument);
    }
    if (this.onDidChangeActiveTextEditor) {
      this.onDidChangeActiveTextEditor.dispose();
      this.context.subscriptions.push(this.onDidChangeActiveTextEditor);
    }
  }
}
