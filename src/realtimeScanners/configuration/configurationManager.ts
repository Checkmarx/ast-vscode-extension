import * as vscode from "vscode";
import { IScannerConfig } from "../common/types";

export class ConfigurationManager {
  isScannerActive(config: IScannerConfig): boolean {
    return vscode.workspace
      .getConfiguration(config.configSection)
      .get(config.activateKey) as boolean;
  }

  registerConfigChangeListener(callback: (configSection: (section: string, scope?: vscode.ConfigurationScope) => boolean) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      callback(event.affectsConfiguration);
    });
  }
}