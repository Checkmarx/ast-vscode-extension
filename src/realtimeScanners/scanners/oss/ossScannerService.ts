

import * as vscode from "vscode";
import * as path from "path";
import fs from "fs";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { cx } from "../../../cx";
import { HoverData, IScannerConfig, CxDiagnosticData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxOssResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { minimatch } from "minimatch";
import { IgnoreFileManager } from "../../common/ignoreFileManager";



export class OssScannerService extends BaseScannerService {


  private createDecoration(
    iconName: string,
    size: string = "auto"
  ): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.file(
        path.join(__dirname, "..", "..", "..", "..", "media", "icons", iconName)
      ),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      gutterIconSize: size,
    });
  }

  private decorationTypes = {
    malicious: this.createDecoration("malicious.svg"),
    ok: this.createDecoration("circle-check.svg"),
    unknown: this.createDecoration("question-mark.svg"),
    critical: this.createDecoration("critical_untoggle.svg", "12px"),
    high: this.createDecoration("high_untoggle.svg"),
    medium: this.createDecoration("medium_untoggle.svg"),
    low: this.createDecoration("low_untoggle.svg"),
    ignored: this.createDecoration("Ignored.svg"),
    underline: vscode.window.createTextEditorDecorationType({
      textDecoration: "underline wavy #f14c4c",
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    }),
  };

  private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
  private hoverMessages: Map<string, HoverData> = new Map();
  private maliciousDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private okDecorationsMap: Map<string, vscode.DecorationOptions[]> = new Map();
  private unknownDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private criticalDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private highDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private mediumDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private lowDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();

  private maliciousIconDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private criticalIconDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private highIconDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private mediumIconDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private lowIconDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private ignoredDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();
  private ignoredIconDecorationsMap: Map<string, vscode.DecorationOptions[]> =
    new Map();

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

  public clearScanData(uri: vscode.Uri): void {
    const filePath = uri.fsPath;
    this.diagnosticsMap.delete(filePath);
    this.diagnosticCollection.delete(uri);
    this.hoverMessages.delete(filePath);
    this.maliciousDecorationsMap.delete(filePath);
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
      const criticalDecorations =
        this.criticalDecorationsMap.get(filePath) || [];
      const highDecorations = this.highDecorationsMap.get(filePath) || [];
      const mediumDecorations = this.mediumDecorationsMap.get(filePath) || [];
      const lowDecorations = this.lowDecorationsMap.get(filePath) || [];

      const maliciousIcons =
        this.maliciousIconDecorationsMap.get(filePath) || [];
      const criticalIcons = this.criticalIconDecorationsMap.get(filePath) || [];
      const highIcons = this.highIconDecorationsMap.get(filePath) || [];
      const mediumIcons = this.mediumIconDecorationsMap.get(filePath) || [];
      const lowIcons = this.lowIconDecorationsMap.get(filePath) || [];
      const ignoredDecorations = this.ignoredDecorationsMap.get(filePath) || [];
      const ignoredIcons = this.ignoredIconDecorationsMap.get(filePath) || [];

      const allUnderlineDecorations = [
        ...maliciousIcons,
        ...criticalIcons,
        ...highIcons,
        ...mediumIcons,
        ...lowIcons,
        ...ignoredIcons,
      ];

      editor.setDecorations(
        this.decorationTypes.malicious,
        maliciousDecorations
      );
      editor.setDecorations(this.decorationTypes.ok, okDecorations);
      editor.setDecorations(this.decorationTypes.unknown, unknownDecorations);
      editor.setDecorations(this.decorationTypes.critical, criticalDecorations);
      editor.setDecorations(this.decorationTypes.high, highDecorations);
      editor.setDecorations(this.decorationTypes.medium, mediumDecorations);
      editor.setDecorations(this.decorationTypes.low, lowDecorations);
      editor.setDecorations(this.decorationTypes.ignored, ignoredDecorations);
      editor.setDecorations(
        this.decorationTypes.underline,
        allUnderlineDecorations
      );
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

      const IgnoreFileManagerInstance = IgnoreFileManager.getInstance();
      IgnoreFileManagerInstance.setScannedFilePath(originalFilePath, mainTempPath);

      const ignoredPackagesFile = IgnoreFileManagerInstance.getIgnoredPackagesTempFile();

      const scanResults = await cx.ossScanResults(mainTempPath, ignoredPackagesFile || "");

      const fullScanResults = IgnoreFileManager.getInstance().getIgnoredPackagesCount() > 0
        ? await cx.ossScanResults(mainTempPath, "")
        : undefined;

      this.updateProblems<CxOssResult[]>(scanResults, document.uri, fullScanResults);
    } catch (error) {
      this.storeAndApplyResults(
        originalFilePath,
        document.uri,
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        []
      );
      console.error(error);
      logs.error(this.config.errorMessage + `: ${error.message}`);
    } finally {
      this.deleteTempFolder(tempSubFolder);
    }
  }

  private storeAndApplyResults(
    filePath: string,
    uri: vscode.Uri,
    diagnostics: vscode.Diagnostic[],
    maliciousDecorations: vscode.DecorationOptions[],
    okDecorations: vscode.DecorationOptions[],
    unknownDecorations: vscode.DecorationOptions[],
    criticalDecorations: vscode.DecorationOptions[],
    highDecorations: vscode.DecorationOptions[],
    mediumDecorations: vscode.DecorationOptions[],
    lowDecorations: vscode.DecorationOptions[],
    ignoredDecorations: vscode.DecorationOptions[],
    maliciousIconDecorations: vscode.DecorationOptions[],
    criticalIconDecorations: vscode.DecorationOptions[],
    highIconDecorations: vscode.DecorationOptions[],
    mediumIconDecorations: vscode.DecorationOptions[],
    lowIconDecorations: vscode.DecorationOptions[]
  ): void {
    this.diagnosticsMap.set(filePath, diagnostics);
    this.maliciousDecorationsMap.set(filePath, maliciousDecorations);
    this.okDecorationsMap.set(filePath, okDecorations);
    this.unknownDecorationsMap.set(filePath, unknownDecorations);
    this.criticalDecorationsMap.set(filePath, criticalDecorations);
    this.highDecorationsMap.set(filePath, highDecorations);
    this.mediumDecorationsMap.set(filePath, mediumDecorations);
    this.lowDecorationsMap.set(filePath, lowDecorations);

    this.maliciousIconDecorationsMap.set(filePath, maliciousIconDecorations);
    this.criticalIconDecorationsMap.set(filePath, criticalIconDecorations);
    this.highIconDecorationsMap.set(filePath, highIconDecorations);
    this.mediumIconDecorationsMap.set(filePath, mediumIconDecorations);
    this.lowIconDecorationsMap.set(filePath, lowIconDecorations);
    this.ignoredDecorationsMap.set(filePath, ignoredDecorations);

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


  public updatePackageDecorationToIgnored(hoverData: HoverData): void {
    const filePath = hoverData.filePath;
    const fileUri = vscode.Uri.file(filePath);

    const diagnostics = this.diagnosticsMap.get(filePath) || [];
    const updatedDiagnostics = diagnostics.filter(diagnostic => {
      const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
      if (diagnosticData?.cxType === 'oss') {
        const ossItem = diagnosticData.item as HoverData;
        return !(ossItem?.packageName === hoverData.packageName &&
          ossItem?.version === hoverData.version);
      }
      return true;
    });

    this.diagnosticsMap.set(filePath, updatedDiagnostics);
    this.diagnosticCollection.set(fileUri, updatedDiagnostics);

    for (const diagnostic of diagnostics) {
      const diagnosticData = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
      if (diagnosticData?.cxType === 'oss') {
        const ossItem = diagnosticData.item as HoverData;
        if (ossItem?.packageName === hoverData.packageName &&
          ossItem?.version === hoverData.version) {

          const range = diagnostic.range;

          this.removeFromAllDecorationMaps(filePath, range);

          const ignoredDecorations = this.ignoredDecorationsMap.get(filePath) || [];
          ignoredDecorations.push({ range });
          this.ignoredDecorationsMap.set(filePath, ignoredDecorations);

          const editor = vscode.window.visibleTextEditors.find(
            (e) => e.document.uri.fsPath === filePath
          );

          if (editor) {
            editor.setDecorations(this.decorationTypes.ignored, ignoredDecorations);

            editor.setDecorations(this.decorationTypes.underline, []);
          }

          break;
        }
      }
    }
  }

  private removeFromAllDecorationMaps(filePath: string, range: vscode.Range): void {
    const removeRange = (decorations: vscode.DecorationOptions[]) => {
      return decorations.filter(d =>
        !(d.range.start.line === range.start.line &&
          d.range.start.character === range.start.character &&
          d.range.end.line === range.end.line &&
          d.range.end.character === range.end.character)
      );
    };

    const maliciousDecorations = this.maliciousDecorationsMap.get(filePath) || [];
    this.maliciousDecorationsMap.set(filePath, removeRange(maliciousDecorations));

    const criticalDecorations = this.criticalDecorationsMap.get(filePath) || [];
    this.criticalDecorationsMap.set(filePath, removeRange(criticalDecorations));

    const highDecorations = this.highDecorationsMap.get(filePath) || [];
    this.highDecorationsMap.set(filePath, removeRange(highDecorations));

    const mediumDecorations = this.mediumDecorationsMap.get(filePath) || [];
    this.mediumDecorationsMap.set(filePath, removeRange(mediumDecorations));

    const lowDecorations = this.lowDecorationsMap.get(filePath) || [];
    this.lowDecorationsMap.set(filePath, removeRange(lowDecorations));

    const ignoredDecorations = this.ignoredDecorationsMap.get(filePath) || [];
    this.ignoredDecorationsMap.set(filePath, removeRange(ignoredDecorations));

    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath);
    if (editor) {
      editor.setDecorations(this.decorationTypes.malicious, this.maliciousDecorationsMap.get(filePath) || []);
      editor.setDecorations(this.decorationTypes.critical, this.criticalDecorationsMap.get(filePath) || []);
      editor.setDecorations(this.decorationTypes.high, this.highDecorationsMap.get(filePath) || []);
      editor.setDecorations(this.decorationTypes.medium, this.mediumDecorationsMap.get(filePath) || []);
      editor.setDecorations(this.decorationTypes.low, this.lowDecorationsMap.get(filePath) || []);
      editor.setDecorations(this.decorationTypes.ignored, this.ignoredDecorationsMap.get(filePath) || []);
    }
  }

  updateProblems<T = unknown>(problems: T, uri: vscode.Uri, fullScanResults?: CxOssResult[]): void {
    const scanResults = problems as unknown as CxOssResult[];
    const filePath = uri.fsPath;



    // Save previous diagnostics to check what disappeared due to ignore
    const previousDiagnostics = this.diagnosticsMap.get(filePath) || [];

    const diagnostics: vscode.Diagnostic[] = [];

    this.diagnosticCollection.delete(uri);

    const maliciousDecorations: vscode.DecorationOptions[] = [];
    const okDecorations: vscode.DecorationOptions[] = [];
    const unknownDecorations: vscode.DecorationOptions[] = [];
    const criticalDecorations: vscode.DecorationOptions[] = [];
    const highDecorations: vscode.DecorationOptions[] = [];
    const mediumDecorations: vscode.DecorationOptions[] = [];
    const lowDecorations: vscode.DecorationOptions[] = [];

    const maliciousIconDecorations: vscode.DecorationOptions[] = [];
    const criticalIconDecorations: vscode.DecorationOptions[] = [];
    const highIconDecorations: vscode.DecorationOptions[] = [];
    const mediumIconDecorations: vscode.DecorationOptions[] = [];
    const lowIconDecorations: vscode.DecorationOptions[] = [];

    for (const result of scanResults) {


      for (let i = 0; i < result.locations.length; i++) {
        const location = result.locations[i];
        const range = new vscode.Range(
          new vscode.Position(location.line, location.startIndex),
          new vscode.Position(location.line, location.endIndex)
        );
        const addDiagnostic = i === 0;



        switch (result.status) {
          case CxRealtimeEngineStatus.malicious:
            this.handleProblemStatus(
              diagnostics,
              maliciousDecorations,
              this.hoverMessages,
              range,
              uri,
              result,
              vscode.DiagnosticSeverity.Error,
              "Malicious package detected",
              addDiagnostic,
              maliciousIconDecorations
            );
            break;
          case CxRealtimeEngineStatus.ok:
            if (addDiagnostic) {
              okDecorations.push({ range });
            }
            break;
          case CxRealtimeEngineStatus.unknown:
            unknownDecorations.push({ range });
            break;
          case CxRealtimeEngineStatus.critical:
            this.handleProblemStatus(
              diagnostics,
              criticalDecorations,
              this.hoverMessages,
              range,
              uri,
              result,
              vscode.DiagnosticSeverity.Error,
              "Critical-risk package",
              addDiagnostic,
              criticalIconDecorations
            );
            break;
          case CxRealtimeEngineStatus.high:
            this.handleProblemStatus(
              diagnostics,
              highDecorations,
              this.hoverMessages,
              range,
              uri,
              result,
              vscode.DiagnosticSeverity.Error,
              "High-risk package",
              addDiagnostic,
              highIconDecorations
            );
            break;
          case CxRealtimeEngineStatus.medium:
            this.handleProblemStatus(
              diagnostics,
              mediumDecorations,
              this.hoverMessages,
              range,
              uri,
              result,
              vscode.DiagnosticSeverity.Error,
              "Medium-risk package",
              addDiagnostic,
              mediumIconDecorations
            );
            break;
          case CxRealtimeEngineStatus.low:
            this.handleProblemStatus(
              diagnostics,
              lowDecorations,
              this.hoverMessages,
              range,
              uri,
              result,
              vscode.DiagnosticSeverity.Error,
              "Low-risk package",
              addDiagnostic,
              lowIconDecorations
            );
            break;
          default:
            continue;
        }
      }
    }
    const ignoredDecorations: vscode.DecorationOptions[] = [];
    const ignoreManager = IgnoreFileManager.getInstance();

    const existingIgnoredDecorations = this.ignoredDecorationsMap.get(filePath) || [];
    ignoredDecorations.push(...existingIgnoredDecorations);

    for (const prevDiagnostic of previousDiagnostics) {
      const prevData = (prevDiagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
      if (prevData?.cxType === 'oss') {
        const prevOssItem = prevData.item as HoverData;

        const stillExists = diagnostics.some(newDiag => {
          const newData = (newDiag as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
          if (newData?.cxType === 'oss') {
            const newOssItem = newData.item as HoverData;
            return newOssItem?.packageName === prevOssItem?.packageName &&
              newOssItem?.version === prevOssItem?.version &&
              newDiag.range.start.line === prevDiagnostic.range.start.line;
          }
          return false;
        });

        if (!stillExists && ignoreManager.isPackageIgnored(prevOssItem.packageName, prevOssItem.version, filePath)) {
          const range = prevDiagnostic.range;
          const alreadyIgnored = ignoredDecorations.some(decoration =>
            decoration.range.start.line === range.start.line &&
            decoration.range.start.character === range.start.character &&
            decoration.range.end.line === range.end.line &&
            decoration.range.end.character === range.end.character
          );

          if (!alreadyIgnored) {
            ignoredDecorations.push({ range });
          }
        }
      }
    }

    this.storeAndApplyResults(
      filePath,
      uri,
      diagnostics,
      maliciousDecorations,
      okDecorations,
      unknownDecorations,
      criticalDecorations,
      highDecorations,
      mediumDecorations,
      lowDecorations,
      ignoredDecorations,
      maliciousIconDecorations,
      criticalIconDecorations,
      highIconDecorations,
      mediumIconDecorations,
      lowIconDecorations
    );

    if (ignoreManager.getIgnoredPackagesCount() > 0 && fullScanResults) {
      this.cleanupIgnoredEntriesWithoutFileWatcher(fullScanResults, filePath, ignoreManager);
    }
  }

  private cleanupIgnoredEntries(fullScanResults: CxOssResult[], currentFilePath: string): void {
    const ignoreManager = IgnoreFileManager.getInstance();
    const ignoredData = ignoreManager.getIgnoredPackagesData();
    const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', currentFilePath);

    const existingFindings = new Set(
      fullScanResults.flatMap(result =>
        result.locations.map(location =>
          `${result.packageManager}:${result.packageName}:${result.version}:${location.line}`
        )
      )
    );

    const activeEntries = Object.entries(ignoredData)
      .flatMap(([packageKey, entry]) =>
        entry.files
          .filter(file => file.active && file.path === relativePath)
          .map(file => ({
            packageKey,
            entry,
            file,
            entryKey: `${entry.PackageManager}:${entry.PackageName}:${entry.PackageVersion}:${file.line}`
          }))
      );

    const toRemove = activeEntries.filter(item => !existingFindings.has(item.entryKey));

    toRemove.forEach(item =>
      ignoreManager.removePackageEntry(item.packageKey, relativePath)
    );

    console.log(`Cleanup: ${activeEntries.length} checked, ${toRemove.length} removed`);
  }

  private cleanupIgnoredEntriesWithoutFileWatcher(
    fullScanResults: CxOssResult[],
    currentFilePath: string,
    ignoreManager: IgnoreFileManager
  ): void {
    ignoreManager.dispose();
    this.cleanupIgnoredEntries(fullScanResults, currentFilePath);

    setTimeout(() => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        ignoreManager.initialize(workspaceFolder);
        ignoreManager.setOssScannerService(this);
      }
    }, 100);
  }
  private handleProblemStatus(
    diagnostics: vscode.Diagnostic[],
    decorations: vscode.DecorationOptions[],
    hoverMessages: Map<string, HoverData>,
    range: vscode.Range,
    uri: vscode.Uri,
    result: CxOssResult,
    severity: vscode.DiagnosticSeverity,
    messagePrefix: string,
    addDiagnostic: boolean,
    iconDecorations?: vscode.DecorationOptions[]
  ): void {
    const message = `${messagePrefix}: ${result.packageName}@${result.version}`;
    if (addDiagnostic) {
      decorations.push({ range });
      const diagnostic = new vscode.Diagnostic(range, message, severity);
      diagnostic.source = 'CxAI';

      (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
        cxType: "oss",
        item: {
          packageManager: result.packageManager,
          packageName: result.packageName,
          version: result.version,
          status: result.status,
          vulnerabilities: result.vulnerabilities,
          filePath: uri.fsPath,
          line: range.start.line
        }
      };
      diagnostics.push(diagnostic);
    } else {
      iconDecorations.push({ range });
    }

    const key = `${uri.fsPath}:${range.start.line}`;
    hoverMessages.set(key, {
      packageManager: result.packageManager,
      packageName: result.packageName,
      version: result.version,
      status: result.status,
      vulnerabilities: result.vulnerabilities,
      filePath: uri.fsPath,
      line: range.start.line
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

  protected getTempSubFolderPath(
    document: vscode.TextDocument,
    baseTempDir: string
  ): string {
    const baseTempPath = super.getTempSubFolderPath(document, baseTempDir);
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "";
    const relativePath = path.relative(workspaceFolder, document.uri.fsPath);
    return path.join(baseTempPath, this.toSafeTempFileName(relativePath));
  }



  private toSafeTempFileName(relativePath: string): string {
    const baseName = path.basename(relativePath);
    const hash = this.generateFileHash(relativePath);
    return `${baseName}-${hash}.tmp`;
  }

}
