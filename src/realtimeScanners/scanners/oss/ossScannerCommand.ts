/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { OssScannerService } from "./ossScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { CxManifestStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxManifestStatus";
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
    (this.scannerService as OssScannerService).initializeScanner();
    await this.scanAllManifestFilesInWorkspace();

    vscode.languages.registerHoverProvider(
      { scheme: "file" },
      {
        provideHover: (document, position) => {
          const key = `${document.uri.fsPath}:${position.line}`;
          const ossScanner = this.scannerService as any;
          const filePath = document.uri.fsPath;
          const hoverData = ossScanner.hoverMessages?.get(key);
          const diagnostics: vscode.Diagnostic[] =
            ossScanner.diagnosticsMap?.get(filePath) || [];
          const hasDiagnostic = diagnostics.some(
            (d) => d.range.start.line === position.line
          );

          if (!hoverData  || !hasDiagnostic) {
            return;
          }
          // const range = new vscode.Range(position.line, 0, position.line, 1000 ;

          const space = " ";
          const md = new vscode.MarkdownString();
          md.supportHtml = true;
          if (hoverData.status === CxManifestStatus.malicious) {
            md.appendMarkdown(
              `Malicious Package${space.repeat(
                35
              )}<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/0279575cbb18d727a9d704f3113f46b3fac80c80/media/cxAI.png" width="11" height="11" style="vertical-align:baseline;" /> CxAI\n\n`
            );
            md.appendMarkdown(
              `**Package:** ${hoverData.packageName}@${hoverData.version}\n\n`
            );
            md.appendMarkdown(
              `[ Fix with Cx & Copilot](command:cx.fixInChat)${space.repeat(
                2
              )}[ View Cx Package Details](command:cx.viewDetails)${space.repeat(
                2
              )}[ Ignore Cx Package](command:cx.ignore)`
            );
          } 

            else if ([CxManifestStatus.critical, CxManifestStatus.high, CxManifestStatus.medium, CxManifestStatus.low].includes(hoverData.status)) {
            const severityMap = {
              [CxManifestStatus.critical]: 'Critical',
              [CxManifestStatus.high]: 'High', 
              [CxManifestStatus.medium]: 'Medium',
              [CxManifestStatus.low]: 'Low'
            };
            
            const severityName = severityMap[hoverData.status];
            const severityColor = this.getSeverityColor(hoverData.status);
            
            md.appendMarkdown(
              `<span style="color: ${severityColor}; font-weight: bold;">${severityName} Vulnerability Package</span>${space.repeat(
                35
              )}<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/0279575cbb18d727a9d704f3113f46b3fac80c80/media/cxAI.png" width="11" height="11" style="vertical-align:baseline;" /> CxAI\n\n`
            );
            
            md.appendMarkdown(
              `**Package:** ${hoverData.packageName}@${hoverData.version}\n\n`
            );

            // Display vulnerability counts by severity
            if (hoverData.vulnerabilities && hoverData.vulnerabilities.length > 0) {
              const vulnCounts = this.countVulnerabilitiesBySeverity(hoverData.vulnerabilities);
              md.appendMarkdown(`**Vulnerabilities:**\n`);
              md.appendMarkdown(`( `);
              if (vulnCounts.critical > 0) {
                md.appendMarkdown(`• ${vulnCounts.critical} <img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/0279575cbb18d727a9d704f3113f46b3fac80c80/media/critical_untoggle.png" width="11" height="11" style="vertical-align:baseline;" />\n`);
              }
              if (vulnCounts.high > 0) {
                md.appendMarkdown(`• ${vulnCounts.high} <img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/0279575cbb18d727a9d704f3113f46b3fac80c80/media/high_untoggle.png" width="11" height="11" style="vertical-align:baseline;" /> \n`);
              }
              if (vulnCounts.medium > 0) {
                md.appendMarkdown(`• ${vulnCounts.medium} <img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/0279575cbb18d727a9d704f3113f46b3fac80c80/media/medium_untoggle.png" width="11" height="11" style="vertical-align:baseline;" /> \n`);
              }
              if (vulnCounts.low > 0) {
                md.appendMarkdown(`• ${vulnCounts.low} <img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/0279575cbb18d727a9d704f3113f46b3fac80c80/media/low_untoggle.png" width="11" height="11" style="vertical-align:baseline;" /> \n`);
              }
              md.appendMarkdown(`)`);
              
              md.appendMarkdown(`\n`);
              
              // Show descriptions of vulnerabilities (limit to first few)
              // const maxDescriptions = 3;
              // const uniqueDescriptions = [...new Set(hoverData.vulnerabilities.map(v => v.description))];
              // const descriptionsToShow = uniqueDescriptions.slice(0, maxDescriptions);
              
              // md.appendMarkdown(`**Description:**\n`);
              // descriptionsToShow.forEach((desc, index) => {
              //   md.appendMarkdown(`${index + 1}. ${desc}\n`);
              // });
              
              // if (uniqueDescriptions.length > maxDescriptions) {
              //   md.appendMarkdown(`... and ${uniqueDescriptions.length - maxDescriptions} more\n`);
              // }
              
              md.appendMarkdown(`\n`);
            }

            md.appendMarkdown(
              `[ Fix with Cx & Copilot](command:cx.fixInChat)${space.repeat(
                2
              )}[ View Cx Package Details](command:cx.viewDetails)${space.repeat(
                2
              )}[ Ignore Cx Package](command:cx.ignore)`
            );
          }

          md.isTrusted = true;

          return new vscode.Hover(md);
        },
      }
    );
  }

   private countVulnerabilitiesBySeverity(vulnerabilities: Array<{cve: string, description: string, severity: string}>): {critical: number, high: number, medium: number, low: number} {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    
    vulnerabilities.forEach(vuln => {
      const severity = vuln.severity.toLowerCase();
      if (severity === 'critical') {
        counts.critical++;
      } else if (severity === 'high') {
        counts.high++;
      } else if (severity === 'medium') {
        counts.medium++;
      } else if (severity === 'low') {
        counts.low++;
      }
    });
    
    return counts;
  }

   private getSeverityColor(status: CxManifestStatus): string {
    switch (status) {
      case CxManifestStatus.critical:
        return '#FF0000'; // Red
      case CxManifestStatus.high:
        return '#FF6600'; // Orange
      case CxManifestStatus.medium:
        return '#FFAA00'; // Yellow-Orange
      case CxManifestStatus.low:
        return '#00AA00'; // Green
      default:
        return '#666666'; // Gray
    }
  }

  getSeverityImg(status: any) {
    switch (status) {
      case CxManifestStatus.critical:
        vscode.Uri.file(path.join(__dirname, '..', '..','..','..', 'media', 'icons', 'comment.png'));
      case CxManifestStatus.high:
        return '#FF6600'; // Orange
      case CxManifestStatus.medium:
        return '#FFAA00'; // Yellow-Orange
      case CxManifestStatus.low:
        return '#00AA00'; // Green
      default:
        return '#666666'; // Gray
    }
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
