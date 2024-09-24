import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  clearAscaProblems,
  installAsca,
  scanAsca,
} from "../asca/ascaService";
import { constants } from "../utils/common/constants";

let timeout = null;
export class AscaCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  onDidChangeTextDocument: vscode.Disposable;
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.logs = logs;
  }
  public async registerAsca() {
    try {
      const ascaActive = vscode.workspace
        .getConfiguration(constants.CheckmarxAsca)
        .get(constants.ActivateAscaAutoScanning) as boolean;
      if (ascaActive) {
        await this.installAsca();
        await this.registerAscaScanOnChangeText();
        this.logs.info(constants.ascaStart);
      } else {
        await this.disposeAscaScanOnChangeText();
        await clearAscaProblems();
        this.logs.info(constants.ascaDisabled);
      }
    } catch (error) {
      console.error(error);
    }
  }
  public installAsca() {
    installAsca(this.logs);
    this.onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
      // Must be no less than 2000ms. Otherwise, the temporary file can be deleted before the ASCA scan is finished.
      this.debounce(this.onTextChange, 2000)
    );
  }

  public onTextChange(event) {
    try {
      scanAsca(event.document, this.logs);
    } catch (error) {
      console.error(error);
      this.logs.warn("fail to scan ASCA");
    }
  }
  // Debounce function
  public debounce(func, wait) {
    const context = this;
    console.log("onDidChangeTextDocument");
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

  public registerAscaScanOnChangeText() {
    this.context.subscriptions.push(this.onDidChangeTextDocument);
  }
  public disposeAscaScanOnChangeText() {
    if (this.onDidChangeTextDocument) {
      this.onDidChangeTextDocument.dispose();
      this.context.subscriptions.push(this.onDidChangeTextDocument);
    }
  }
}
