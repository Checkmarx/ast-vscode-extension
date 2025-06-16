/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { OssScannerService } from "./ossScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import path from "path";

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
    this.registerScanOnChangeText();
    const scanner = this.scannerService as OssScannerService;
    scanner.initializeScanner();

    if (this.hoverProviderDisposable) {
      this.hoverProviderDisposable.dispose();
    }

    this.hoverProviderDisposable = vscode.languages.registerHoverProvider(
      { scheme: "file" },
      { provideHover: (doc, pos) => this.getHover(doc, pos, scanner) }
    );

    await this.scanAllManifestFilesInWorkspace();
  }

  private hoverProviderDisposable: vscode.Disposable | undefined;

  private getHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    scanner: any
  ) {
    const key = `${document.uri.fsPath}:${position.line}`;
    const hoverData = scanner.hoverMessages?.get(key);
    const diagnostics = scanner.diagnosticsMap?.get(document.uri.fsPath) || [];
    const hasDiagnostic = diagnostics.some(
      (d) => d.range.start.line === position.line
    );

    if (!hoverData || !hasDiagnostic) {
      return;
    }

    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.isTrusted = true;

    const pkg = `**Package:** ${hoverData.packageName}@${hoverData.version}\n\n`;
    const buttons = `[ Fix with Cx & Copilot](command:cx.fixInChat)  [ View Cx Package Details](command:cx.viewDetails)  [ Ignore Cx Package](command:cx.ignore)`;

    const isVulnerable = this.isVulnerableStatus(hoverData.status);
    const isMalicious = hoverData.status === CxRealtimeEngineStatus.malicious;

    md.appendMarkdown("Short description of the package\n\n");
    if (isMalicious) {
      md.appendMarkdown(this.renderMaliciousFinding() + "<br>");
      md.appendMarkdown(this.badge("Malicious Package") + "<br>");
    } else if (isVulnerable) {
      md.appendMarkdown(
        this.badge(`${hoverData.status.toString()} Vulnerability Package`) +
        "<br>"
      );
    }
    md.appendMarkdown(`${"&nbsp;".repeat(45)}${buttons}<br>`);
    if (isVulnerable) {
      md.appendMarkdown(this.renderVulnCounts(hoverData.vulnerabilities || []));
    }
    if (isMalicious) {
      md.appendMarkdown(this.renderMaliciousIcon());
    }

    return new vscode.Hover(md);
  }

  private isVulnerableStatus(status: CxRealtimeEngineStatus): boolean {
    return [
      CxRealtimeEngineStatus.critical,
      CxRealtimeEngineStatus.high,
      CxRealtimeEngineStatus.medium,
      CxRealtimeEngineStatus.low,
    ].includes(status);
  }

  private badge(text: string): string {
    return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/CxAi.png"  style="vertical-align: -12px;"/>`;
  }

  private renderMaliciousFinding(): string {
    return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/Itay/newSecretsCards/media/icons/maliciousFindig.png" style="vertical-align: -12px;" />`;
  }

  private renderMaliciousIcon(): string {
    return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/malicious.png" width="10" height="11" style="vertical-align: -12px;"/>`;
  }

  private renderVulnCounts(
    vulnerabilities: Array<{ severity: string }>
  ): string {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of vulnerabilities) {
      const sev = v.severity.toLowerCase();
      if (counts[sev as keyof typeof counts] !== undefined) {
        counts[sev as keyof typeof counts]++;
      }
    }

    const severityDisplayItems = Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(
        ([sev, count]) =>
          `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/${constants.ossIcons[sev as keyof typeof constants.ossIcons]
          }" width="10" height="11" style="vertical-align: -12px;"/> ${count} &nbsp; `
      );

    return `${severityDisplayItems.join("")}\n\n\n`;
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
    this.hoverProviderDisposable?.dispose();
  }
}
