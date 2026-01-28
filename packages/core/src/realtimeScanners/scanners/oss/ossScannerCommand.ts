/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { OssScannerService } from "./ossScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { CxRealtimeEngineStatus } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
import { MediaPathResolver } from "../../../utils/mediaPathResolver";
import { HoverData } from "../../common/types";
import { ThemeUtils } from "../../../utils/themeUtils";
import * as util from 'util';

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
    const scanner = this.scannerService as OssScannerService;
    await super.initializeScanner();
    scanner.initializeScanner();

    if (this.hoverProviderDisposable) {
      this.hoverProviderDisposable.dispose();
    }

    this.hoverProviderDisposable = vscode.languages.registerHoverProvider(
      { scheme: "file" },
      { provideHover: (doc, pos) => this.getHover(doc, pos, scanner) }
    );

    this.scanAllManifestFilesInWorkspace();
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

    const severityOrder = [CxRealtimeEngineStatus.critical.toLowerCase(), CxRealtimeEngineStatus.high.toLowerCase(), CxRealtimeEngineStatus.medium.toLowerCase(), CxRealtimeEngineStatus.low.toLowerCase()];
    const allVulns = hoverData.vulnerabilities || [];
    const sortedVulns = [...allVulns].sort((a, b) => {
      const aIdx = severityOrder.indexOf(a.severity?.toLowerCase?.() || "");
      const bIdx = severityOrder.indexOf(b.severity?.toLowerCase?.() || "");
      return aIdx - bIdx;
    });
    const top10Vulns = sortedVulns.slice(0, 10);
    const hoverDataForArgs = { ...hoverData, vulnerabilities: top10Vulns };
    const args = encodeURIComponent(JSON.stringify([hoverDataForArgs]));
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
      md.appendMarkdown(this.renderVulnCounts(allVulns));
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
    if (hoverData.status === CxRealtimeEngineStatus.malicious) {
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
    const iconFile = ThemeUtils.selectIconByTheme('malicious_light.png', 'malicious.png');
    const iconPath = MediaPathResolver.getMediaFilePath('icons', iconFile);
    const iconUri = vscode.Uri.file(iconPath).toString();
    return `<img src="${iconUri}" width="15" height="16" style="vertical-align: -12px;"/>`;
  }

  private renderPackageIcon(): string {
    const iconFile = ThemeUtils.selectIconByTheme('Package_light.png', 'Package.png');
    const iconPath = MediaPathResolver.getMediaFilePath('icons', 'realtimeEngines', iconFile);
    const iconUri = vscode.Uri.file(iconPath).toString();
    return `<img src="${iconUri}" width="15" height="16" style="vertical-align: -12px;"/>`;
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
        ([sev, count]) => {
          const iconFile = constants.ossIcons[sev as keyof typeof constants.ossIcons];
          const iconPath = MediaPathResolver.getMediaFilePath('icons', 'realtimeEngines', iconFile);
          const iconUri = vscode.Uri.file(iconPath).toString();
          return `<img src="${iconUri}" width="10" height="11" style="vertical-align: -12px;"/> ${count} &nbsp; `;
        }
      );

    return `${severityDisplayItems.join("")}\n\n\n`;
  }

  private async scanAllManifestFilesInWorkspace() {
    for (const pattern of constants.supportedManifestFilePatterns) {
      const uris = await vscode.workspace.findFiles(pattern);
      for (const uri of uris) {
        try {
          const fileContent = await vscode.workspace.fs.readFile(uri);
          const text = new util.TextDecoder().decode(fileContent);

          const fakeDocument = {
            uri,
            getText: () => text
          } as vscode.TextDocument;
          await this.scannerService.scan(fakeDocument, this.logs);
        } catch (err) {
          this.logs.warn(`Failed to scan manifest file: ${uri.fsPath}`);
        }
      }
    }
  }
  public async dispose(): Promise<void> {
    await super.dispose();
    this.scannerService.dispose();
    this.hoverProviderDisposable?.dispose();
  }

  getScannerService(): OssScannerService {
    return this.scannerService as OssScannerService;
  }
}
