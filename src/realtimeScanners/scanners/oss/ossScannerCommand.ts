/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { OssScannerService } from "./ossScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
import { HoverData } from "../../common/types";

export class OssScannerCommand extends BaseScannerCommand {
  constructor(
    context: vscode.ExtensionContext,
    logs: Logs,
    configManager: ConfigurationManager
  ) {
    const scannerService = new OssScannerService();
    super(context, logs, scannerService.config, scannerService, configManager);
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

    this.scanAllManifestFilesInWorkspace();

    vscode.workspace.onDidRenameFiles(async (event) => {
      const scanner = this.scannerService as OssScannerService;

      for (const { oldUri, newUri } of event.files) {
        scanner.clearScanData(oldUri);

        const reopenedDoc = await vscode.workspace.openTextDocument(newUri);
        if (reopenedDoc && scanner.shouldScanFile(reopenedDoc)) {
          await scanner.scan(reopenedDoc, this.logs);
        }
      }
    });
  }

  private hoverProviderDisposable: vscode.Disposable | undefined;

  private getHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    scanner: OssScannerService
  ) {
    const key = `${document.uri.fsPath}:${position.line}`;
    const hoverData: HoverData = scanner.getHoverData()?.get(key);
    const diagnostics = scanner.getDiagnosticsMap()?.get(document.uri.fsPath) || [];
    const hasDiagnostic = diagnostics.some(
      (d) => d.range.start.line === position.line
    );

    if (!hoverData || !hasDiagnostic) {
      return;
    }

    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.isTrusted = true;

    const args = encodeURIComponent(JSON.stringify([hoverData]));
    const buttons = buildCommandButtons(args, true, false);
    const isVulnerable = this.isVulnerableStatus(hoverData.status);
    const isMalicious = hoverData.status === CxRealtimeEngineStatus.malicious;
    if (isMalicious) {
      md.appendMarkdown(renderCxAiBadge() + "<br>");
      md.appendMarkdown(this.renderMaliciousIcon() + " ");
    } else if (isVulnerable) {
      md.appendMarkdown(renderCxAiBadge() + "<br>");
      md.appendMarkdown(this.renderPackageIcon() + " ");
    }
    md.appendMarkdown(this.renderID(hoverData));
    if (isVulnerable) {
      md.appendMarkdown(this.renderVulnCounts(hoverData.vulnerabilities || []));
    }

    md.appendMarkdown(`${buttons}<br>`);
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

  private renderID(hoverData: HoverData): string {
    if (hoverData.status == CxRealtimeEngineStatus.malicious) {
      return `
<b>${hoverData.packageName} @ ${hoverData.version}</b>
<i style="color: dimgrey;"> - ${hoverData.status} Package <br></i>
`;
    }
    return `
<b>${hoverData.packageName} @ ${hoverData.version}</b>
<i style="color: dimgrey;"> - ${hoverData.status} severity Package <br></i>
`;
  }

  private renderMaliciousIcon(): string {
    return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/malicious.png" width="15" height="16" style="vertical-align: -12px;"/>`;
  }

  private renderPackageIcon(): string {
    return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/realtimeEngines/Package.png" width="15" height="16" style="vertical-align: -12px;"/>`;
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
      .filter(([, count]) => count > 0)
      .map(
        ([sev, count]) =>
          `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/realtimeEngines/${constants.ossIcons[sev as keyof typeof constants.ossIcons]
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

  getScannerService(): OssScannerService {
    return this.scannerService as OssScannerService;
  }
}
