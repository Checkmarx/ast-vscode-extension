import * as vscode from "vscode";
import * as path from "path";
import fs from "fs";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { cx } from "../../../cx";
import { IScannerConfig } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxOssResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import { CxManifestStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxManifestStatus";
import { minimatch } from "minimatch";

export class OssScannerService extends BaseScannerService {
  private decorationTypes = {
    malicious: vscode.window.createTextEditorDecorationType({
      overviewRulerColor: 'red',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..','..','..', 'media', 'icons', 'malicious.svg')), 
    }),
    ok: vscode.window.createTextEditorDecorationType({
      gutterIconPath: path.join(__dirname, '..', '..','..','..', 'media', 'icons', 'circle-check.svg'),
    }),
    unknown: vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..', '..','..', 'media', 'icons', 'question-mark.svg')),
      gutterIconSize: 'contain'
    })
  };

  private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();

  constructor() {
    const config: IScannerConfig = {
      engineName: constants.ossRealtimeScannerEngineName,
      configSection: constants.ossRealtimeScanner,
      activateKey: constants.activateOssRealtimeScanner,
      enabledMessage: constants.ossRealtimeScannerStart,
      disabledMessage: constants.ossRealtimeScannerDisabled,
      errorMessage: constants.errorOssScanRealtime
    };
    
    super(config);
  }
  
  matchesManifestPattern(filePath: string): boolean {
   const normalizedPath = filePath.replace(/\\/g, '/');
   return constants.supportedManifestFilePatterns.some(pattern => minimatch(normalizedPath, pattern));
  }

  shouldScanFile(document: vscode.TextDocument): boolean {
    if (!super.shouldScanFile(document)) {
      return false;
    }
    
    return this.matchesManifestPattern(document.uri.fsPath);
  }
  
  async scan(document: vscode.TextDocument, logs: Logs): Promise<void> {
    if (!this.shouldScanFile(document)) {
      return;
    }
    
    const originalFilePath = document.uri.fsPath;
    const tempSubFolder = this.getTempSubFolderPath(document, constants.ossRealtimeScannerDirectory);
    
    try {
      this.createTempFolder(tempSubFolder);
      
      const mainTempPath = this.saveMainManifestFile(tempSubFolder, originalFilePath, document.getText());
      this.saveCompanionFile(tempSubFolder, originalFilePath);
      
      logs.info("Start Realtime scan On File: " + originalFilePath);
      
      const scanResults = await cx.ossScanResults(mainTempPath);
      this.updateProblems<CxOssResult[]>(scanResults, document.uri);
      
    } catch (error) {
      console.error(error);
      logs.error(this.config.errorMessage);
    } finally {
      this.deleteTempFolder(tempSubFolder);
    }
  }
  
  private saveMainManifestFile(tempFolder: string, originalFilePath: string, content: string): string {
    const fileName = path.basename(originalFilePath);
    const tempFilePath = path.join(tempFolder, fileName);
    fs.writeFileSync(tempFilePath, content);
    return tempFilePath;
  }
  
  private saveCompanionFile(tempFolder: string, originalFilePath: string): string | null {
    const companionFileName = this.getCompanionFileName(path.basename(originalFilePath));
    if (!companionFileName) {return null;}
    
    const companionOriginalPath = path.join(path.dirname(originalFilePath), companionFileName);
    if (!fs.existsSync(companionOriginalPath)) {return null;}
    
    const companionTempPath = path.join(tempFolder, companionFileName);
    fs.copyFileSync(companionOriginalPath, companionTempPath);
    return companionTempPath;
  }
  
  private getCompanionFileName(fileName: string): string {
    if (fileName === 'package.json') {return 'package-lock.json';}
    if (fileName.includes('.csproj')) {return 'packages.lock.json';}
    return '';
  }
  
  updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void {
    const scanResults = problems as unknown as CxOssResult[];
    const filePath = uri.fsPath;
    console.log("updateProblems", filePath);
    const diagnostics: vscode.Diagnostic[] = [];

    this.diagnosticCollection.delete(uri);
        
    const maliciousDecorations: vscode.DecorationOptions[] = [];
    const okDecorations: vscode.DecorationOptions[] = [];
    const unknownDecorations: vscode.DecorationOptions[] = [];
    
    for (const result of scanResults) {
      const range = new vscode.Range(
        new vscode.Position(result.lineStart, result.startIndex),
        new vscode.Position(result.lineEnd, result.endIndex)
      );
      
      let severity: vscode.DiagnosticSeverity;
      let message: string;

      switch (result.status) {
        case CxManifestStatus.malicious:
          severity = vscode.DiagnosticSeverity.Error;
          message = `Malicious package detected: ${result.packageName}@${result.version}`;
          maliciousDecorations.push({ range });
          diagnostics.push(new vscode.Diagnostic(range, message, severity));
          break;
        case CxManifestStatus.ok:
          okDecorations.push({ range });
          break;
        case CxManifestStatus.unknown:
          unknownDecorations.push({ range });
          break;
        default:
          continue;
      }
      
    }
    this.diagnosticsMap.set(filePath, diagnostics);
    
    this.applyDiagnostics();

    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
    if (editor) { 
      editor.setDecorations(this.decorationTypes.malicious, maliciousDecorations);
      editor.setDecorations(this.decorationTypes.ok, okDecorations);
      editor.setDecorations(this.decorationTypes.unknown, unknownDecorations);
    }
  }

   private applyDiagnostics(): void {
    console.log("applyDiagnostics", this.diagnosticsMap);
    
    this.diagnosticsMap.forEach((diagnostics, filePath) => {
      const vscodeUri = vscode.Uri.file(filePath);
      this.diagnosticCollection.set(vscodeUri, diagnostics);
    });
  }

   public async clearProblems(): Promise<void> {
    await super.clearProblems();
    this.diagnosticsMap.clear();
  }
}