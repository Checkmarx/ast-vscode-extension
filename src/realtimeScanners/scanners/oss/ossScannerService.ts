import * as vscode from "vscode";
import * as path from "path";
import fs from "fs";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { cx } from "../../../cx";
import { HoverData, IScannerConfig } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxOssResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import { CxManifestStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxManifestStatus";
import { minimatch } from "minimatch";

export class OssScannerService extends BaseScannerService {
  
  private createDecoration(iconName: string, size: string = "auto"): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.file(
        path.join(__dirname, "..", "..", "..", "..", "media", "icons", iconName)
      ),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      gutterIconSize: size
    });
  }

  private decorationTypes = {
    malicious: this.createDecoration("malicious.svg"),
    ok: this.createDecoration("circle-check.svg"),
    unknown: this.createDecoration("question-mark.svg"),
    critical: this.createDecoration("critical_untoggle.svg", "12px"),
    high: this.createDecoration("high_untoggle.svg"),
    medium: this.createDecoration("medium_untoggle.svg"),
    low: this.createDecoration("low_untoggle.svg")
  };


  private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
  private hoverMessages: Map<string, HoverData> = new Map();
  private maliciousDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private okDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private unknownDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private criticalDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private highDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private mediumDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private lowDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();

  private documentOpenListener: vscode.Disposable | undefined;
  private editorChangeListener: vscode.Disposable | undefined;

  constructor() {
    const config: IScannerConfig = {
      engineName: constants.ossRealtimeScannerEngineName,
      configSection: constants.ossRealtimeScanner,
      activateKey: constants.activateOssRealtimeScanner,
      enabledMessage: constants.ossRealtimeScannerStart,
      disabledMessage: constants.ossRealtimeScannerDisabled,
      errorMessage: constants.errorOssScanRealtime,
    };
    super(config);
  }

  public async initializeScanner(): Promise<void> {
    this.documentOpenListener = vscode.workspace.onDidOpenTextDocument(
      this.onDocumentOpen.bind(this)
    );
    this.editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
      this.onEditorChange.bind(this)
    );
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
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri.toString()
    );

    if (editor) {
      const maliciousDecorations =
        this.maliciousDecorationsMap.get(filePath) || [];
      const okDecorations = this.okDecorationsMap.get(filePath) || [];
      const unknownDecorations = this.unknownDecorationsMap.get(filePath) || [];
      const criticalDecorations = this.criticalDecorationsMap.get(filePath) || [];
      const highDecorations = this.highDecorationsMap.get(filePath) || [];
      const mediumDecorations = this.mediumDecorationsMap.get(filePath) || [];
      const lowDecorations = this.lowDecorationsMap.get(filePath) || [];
      
      editor.setDecorations(this.decorationTypes.malicious, maliciousDecorations);
      editor.setDecorations(this.decorationTypes.ok, okDecorations);
      editor.setDecorations(this.decorationTypes.unknown, unknownDecorations);
      editor.setDecorations(this.decorationTypes.critical, criticalDecorations);
      editor.setDecorations(this.decorationTypes.high, highDecorations);
      editor.setDecorations(this.decorationTypes.medium, mediumDecorations);
      editor.setDecorations(this.decorationTypes.low, lowDecorations);
    }
  }

  private applyDiagnostics(): void {
    this.diagnosticsMap.forEach((diagnostics, filePath) => {
      const vscodeUri = vscode.Uri.file(filePath);
      this.diagnosticCollection.set(vscodeUri, diagnostics);
    });
  }

  matchesManifestPattern(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return constants.supportedManifestFilePatterns.some((pattern) =>
      minimatch(normalizedPath, pattern)
    );
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

    const tempSubFolder = this.getTempSubFolderPath(
      document,
      constants.ossRealtimeScannerDirectory
    );

    try {
      this.createTempFolder(tempSubFolder);
      const mainTempPath = this.saveMainManifestFile(
        tempSubFolder,
        originalFilePath,
        document.getText()
      );
      this.saveCompanionFile(tempSubFolder, originalFilePath);

      logs.info("Start Realtime scan On File: " + originalFilePath);

      const scanResults = await cx.ossScanResults(mainTempPath);
      this.updateProblems<CxOssResult[]>(scanResults, document.uri);
    } catch (error) {
      this.storeAndApplyResults(originalFilePath, document.uri, [], [], [], [], [], [], [], []);
      console.error(error);
      logs.error(this.config.errorMessage + `: ${error.message}`);
    } finally {
      this.deleteTempFolder(tempSubFolder);
    }
  }

  private storeAndApplyResults(filePath: string, uri: vscode.Uri, diagnostics: vscode.Diagnostic[], maliciousDecorations: vscode.DecorationOptions[], okDecorations: vscode.DecorationOptions[], unknownDecorations: vscode.DecorationOptions[], criticalDecorations: vscode.DecorationOptions[], highDecorations: vscode.DecorationOptions[], mediumDecorations: vscode.DecorationOptions[], lowDecorations: vscode.DecorationOptions[]): void {
    this.diagnosticsMap.set(filePath, diagnostics);
    this.maliciousDecorationsMap.set(filePath, maliciousDecorations);
    this.okDecorationsMap.set(filePath, okDecorations);
    this.unknownDecorationsMap.set(filePath, unknownDecorations);
    this.criticalDecorationsMap.set(filePath, criticalDecorations);
    this.highDecorationsMap.set(filePath, highDecorations);
    this.mediumDecorationsMap.set(filePath, mediumDecorations);
    this.lowDecorationsMap.set(filePath, lowDecorations);
  
    this.applyDiagnostics();
    this.applyDecorations(uri);
  }

  private saveMainManifestFile(
    tempFolder: string,
    originalFilePath: string,
    content: string
  ): string {
    const fileName = path.basename(originalFilePath);
    const tempFilePath = path.join(tempFolder, fileName);
    fs.writeFileSync(tempFilePath, content);
    return tempFilePath;
  }

  private saveCompanionFile(
    tempFolder: string,
    originalFilePath: string
  ): string | null {
    const companionFileName = this.getCompanionFileName(
      path.basename(originalFilePath)
    );
    if (!companionFileName) {
      return null;
    }

    const companionOriginalPath = path.join(
      path.dirname(originalFilePath),
      companionFileName
    );
    if (!fs.existsSync(companionOriginalPath)) {
      return null;
    }

    const companionTempPath = path.join(tempFolder, companionFileName);
    fs.copyFileSync(companionOriginalPath, companionTempPath);
    return companionTempPath;
  }

  private getCompanionFileName(fileName: string): string {
    if (fileName === "package.json") {
      return "package-lock.json";
    }
    if (fileName.includes(".csproj")) {
      return "packages.lock.json";
    }
    return "";
  }

  updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void {
    const scanResults = problems as unknown as CxOssResult[];
    const filePath = uri.fsPath;
    
    const diagnostics: vscode.Diagnostic[] = [];

    this.diagnosticCollection.delete(uri);

    const maliciousDecorations: vscode.DecorationOptions[] = [];
    const okDecorations: vscode.DecorationOptions[] = [];
    const unknownDecorations: vscode.DecorationOptions[] = [];
    const criticalDecorations: vscode.DecorationOptions[] = [];
    const highDecorations: vscode.DecorationOptions[] = [];
    const mediumDecorations: vscode.DecorationOptions[] = [];
    const lowDecorations: vscode.DecorationOptions[] = [];
    
    for (const result of scanResults) {
      const range = new vscode.Range(
        new vscode.Position(result.lineStart, result.startIndex),
        new vscode.Position(result.lineEnd, result.endIndex)
      );
      const key = `${uri.fsPath}:${range.start.line}`;
    
      switch (result.status) {
        case CxManifestStatus.malicious:
          this.handleProblemStatus(
            diagnostics,
            maliciousDecorations,
            this.hoverMessages,
            range,
            uri,
            result,
            vscode.DiagnosticSeverity.Error,
            "Malicious package detected"
          );
          break;
        case CxManifestStatus.ok:
          okDecorations.push({ range });
          break;
        case CxManifestStatus.unknown:
          unknownDecorations.push({ range });
          break;
        case CxManifestStatus.critical:
          this.handleProblemStatus(
            diagnostics,
            criticalDecorations,
            this.hoverMessages,
            range,
            uri,
            result,
            vscode.DiagnosticSeverity.Error,
            "Critical-risk package"
          );
          break;
        case CxManifestStatus.high:
          this.handleProblemStatus(
            diagnostics,
            highDecorations,
            this.hoverMessages,
            range,
            uri,
            result,
            vscode.DiagnosticSeverity.Error,
            "High-risk package"
          );
          break;
        case CxManifestStatus.medium:
          this.handleProblemStatus(
            diagnostics,
            mediumDecorations,
            this.hoverMessages,
            range,
            uri,
            result,
            vscode.DiagnosticSeverity.Error,
            "Medium-risk package"
          );
          break;
        case CxManifestStatus.low:
          this.handleProblemStatus(
            diagnostics,
            lowDecorations,
            this.hoverMessages,
            range,
            uri,
            result,
            vscode.DiagnosticSeverity.Error,
            "Low-risk package"
          );
          break;
        default:
          continue;
      }
    }
    
    this.storeAndApplyResults(filePath, uri, diagnostics, maliciousDecorations, okDecorations, unknownDecorations, criticalDecorations, highDecorations, mediumDecorations, lowDecorations);
  }

  private handleProblemStatus(
    diagnostics: vscode.Diagnostic[],
    decorations: vscode.DecorationOptions[],
    hoverMessages: Map<string, HoverData>,
    range: vscode.Range,
    uri: vscode.Uri,
    result: CxOssResult,
    severity: vscode.DiagnosticSeverity,
    messagePrefix: string
  ): void {
    const message = `${messagePrefix}: ${result.packageName}@${result.version}`;
    diagnostics.push(new vscode.Diagnostic(range, message, severity));
    decorations.push({ range });

    const key = `${uri.fsPath}:${range.start.line}`;
    hoverMessages.set(key, {
      packageName: result.packageName,
      version: result.version,
      status: result.status,
      vulnerabilities: result.vulnerabilities
    });
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
