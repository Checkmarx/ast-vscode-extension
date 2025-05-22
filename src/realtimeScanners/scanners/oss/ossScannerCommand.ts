/* eslint-disable @typescript-eslint/no-explicit-any */
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

    vscode.languages.registerHoverProvider(
      { scheme: "file" },
      {
        provideHover: (document, position) => {
          const key = `${document.uri.fsPath}:${position.line}`;
          const ossScanner = this.scannerService as any;
          const message = ossScanner.hoverMessages?.get(key);
          if (!message) {
            return;
          }
          // const range = new vscode.Range(position.line, 0, position.line, 1000); // כיסוי כל השורה

          const space = " ";
          const md = new vscode.MarkdownString();

          md.appendMarkdown(
            `**🚨 Malicious Package Detected${space.repeat(30)}cxAI ⟢**\n\n`
          );
          md.appendMarkdown(`\`${message}\`\n\n`);
          md.appendMarkdown(
            `[💡 Fix in Chat](command:cx.fixInChat) [🔍 View Details](command:cx.viewDetails) [🚫 Ignore](command:cx.ignore)`
          );

          md.isTrusted = true;

          return new vscode.Hover(md);
        },
      }
    );
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
