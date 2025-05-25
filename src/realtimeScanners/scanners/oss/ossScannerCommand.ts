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
          const filePath = document.uri.fsPath;
          const message = ossScanner.hoverMessages?.get(key);
          const diagnostics: vscode.Diagnostic[] =
            ossScanner.diagnosticsMap?.get(filePath) || [];
          const hasDiagnostic = diagnostics.some(
            (d) => d.range.start.line === position.line
          );

          if (!message || !hasDiagnostic) {
            return;
          }
          // const range = new vscode.Range(position.line, 0, position.line, 1000 ;

          const space = " ";
          const md = new vscode.MarkdownString();
          md.supportHtml = true;
          md.appendMarkdown(
            `Malicious Package${space.repeat(
              40
            )}<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/0279575cbb18d727a9d704f3113f46b3fac80c80/media/cxAI.png" width="11" height="11" style="vertical-align:baseline;" /> CxAI\n\n`
          );
          md.appendMarkdown(
            `[ Fix in Chat](command:cx.fixInChat)${space.repeat(
              3
            )}[ View Details](command:cx.viewDetails)${space.repeat(
              3
            )}[ Ignore](command:cx.ignore)`
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
