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
      gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..','..','..', 'media', 'icons', 'malicious.svg')), 
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    }),
    ok: vscode.window.createTextEditorDecorationType({
      gutterIconPath: path.join(__dirname, '..', '..','..','..', 'media', 'icons', 'circle-check.svg'),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    }),
    unknown: vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..', '..','..', 'media', 'icons', 'question-mark.svg')),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    })
  };

  private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
  private maliciousDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private okDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private unknownDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private documentOpenListener: vscode.Disposable | undefined;
  private editorChangeListener: vscode.Disposable | undefined;

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

  public async initializeScanner(): Promise<void> {
    this.documentOpenListener = vscode.workspace.onDidOpenTextDocument(this.onDocumentOpen.bind(this));
    this.editorChangeListener = vscode.window.onDidChangeActiveTextEditor(this.onEditorChange.bind(this)); 
  }
   private onDocumentOpen(document: vscode.TextDocument): void {
    if (this.matchesManifestPattern(document.uri.fsPath)) {
      this.applyDecorations(document.uri);
    }
  }
  
  private onEditorChange(editor: vscode.TextEditor | undefined): void {
    if (editor && this.matchesManifestPattern(editor.document.uri.fsPath)) {
      this.applyDecorations(editor.document.uri);
    }
  }
 
  private applyDecorations(uri: vscode.Uri): void {
    const filePath = uri.fsPath;
    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
    
    if (editor) {
      const maliciousDecorations = this.maliciousDecorationsMap.get(filePath) || [];
      const okDecorations = this.okDecorationsMap.get(filePath) || [];
      const unknownDecorations = this.unknownDecorationsMap.get(filePath) || [];
      
      editor.setDecorations(this.decorationTypes.malicious, maliciousDecorations);
      editor.setDecorations(this.decorationTypes.ok, okDecorations);
      editor.setDecorations(this.decorationTypes.unknown, unknownDecorations);
    }
  }

  private applyDiagnostics(): void {
    this.diagnosticsMap.forEach((diagnostics, filePath) => {
      const vscodeUri = vscode.Uri.file(filePath);
      this.diagnosticCollection.set(vscodeUri, diagnostics);
    });
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
      this.storeAndApplyResults(originalFilePath, document.uri, [], [], [], []);
      console.error(error);
      logs.error(this.config.errorMessage);
    } finally {
      this.deleteTempFolder(tempSubFolder);
    }
  }

  private storeAndApplyResults(filePath: string, uri: vscode.Uri, diagnostics: vscode.Diagnostic[], maliciousDecorations: vscode.DecorationOptions[], okDecorations: vscode.DecorationOptions[], unknownDecorations: vscode.DecorationOptions[]): void {
    this.diagnosticsMap.set(filePath, diagnostics);
    this.maliciousDecorationsMap.set(filePath, maliciousDecorations);
    this.okDecorationsMap.set(filePath, okDecorations);
    this.unknownDecorationsMap.set(filePath, unknownDecorations);
  
    this.applyDiagnostics();
    this.applyDecorations(uri);
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
    
    this.storeAndApplyResults(filePath, uri, diagnostics, maliciousDecorations, okDecorations, unknownDecorations);
  }

  public async clearProblems(): Promise<void> {
    await super.clearProblems();
    this.diagnosticsMap.clear();
    this.maliciousDecorationsMap.clear();
    this.okDecorationsMap.clear();
    this.unknownDecorationsMap.clear();
  }

  public dispose(): void {
    if (this.documentOpenListener) {
      this.documentOpenListener.dispose();
    }
    
    if (this.editorChangeListener) {
      this.editorChangeListener.dispose();
    }
  }
}