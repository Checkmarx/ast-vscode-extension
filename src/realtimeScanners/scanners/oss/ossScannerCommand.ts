import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { OssScannerService } from "./ossScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";

export class OssScannerCommand extends BaseScannerCommand {
  constructor(
    context: vscode.ExtensionContext,
    logs: Logs,
    configManager: ConfigurationManager
  ) {
    const scannerService = new OssScannerService();
    super(context, logs, scannerService.config, scannerService, configManager);
    this.debounceStrategy = "per-document";
  }
  
  protected async initializeScanner(): Promise<void> {
    (this.scannerService as OssScannerService).initializeScanner();
    await this.scanAllManifestFilesInWorkspace();
  }

  private async scanAllManifestFilesInWorkspace() {
      for (const pattern of constants.supportedManifestFilePatterns) {
        const uris = await vscode.workspace.findFiles(pattern);
        for (const uri of uris) {
          try {
            const document = await vscode.workspace.openTextDocument(uri);
            await this.scannerService.scan(document, this.logs);
          } catch (err) {
            this.logs.warn(`Failed to scan manifest file: ${uri.fsPath}`);
          }
        }
      }
    }
    public async dispose(): Promise<void> {
    await super.dispose();
    (this.scannerService as OssScannerService).dispose();
   }
}