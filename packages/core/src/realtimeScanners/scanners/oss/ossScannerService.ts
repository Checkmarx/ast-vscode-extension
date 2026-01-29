
import * as vscode from "vscode";
import * as path from "path";
import fs from "fs";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { cx } from "../../../cx";
import { HoverData, IScannerConfig, CxDiagnosticData } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import CxOssResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import { CxRealtimeEngineStatus } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { minimatch } from "minimatch";
import { IgnoreFileManager } from "../../common/ignoreFileManager";
import { ThemeUtils } from "../../../utils/themeUtils";

export class OssScannerService extends BaseScannerService {
  private themeChangeListener: vscode.Disposable | undefined;

  private createDecoration(
    iconName: string,
    size: string = "auto"
  ): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.file(
        path.join(__dirname, "..", "..", "..", "media", "icons", iconName)
      ),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      gutterIconSize: size,
    });
  }

  private createDecorationTypes() {
    return {
      malicious: this.createDecoration("malicious.svg"),
      ok: this.createDecoration("realtimeEngines/green_check.svg"),
      unknown: this.createDecoration("realtimeEngines/question_mark.svg"),
      critical: this.createDecoration("realtimeEngines/critical_severity.svg", "12px"),
      high: this.createDecoration("realtimeEngines/high_severity.svg"),
      medium: this.createDecoration("realtimeEngines/medium_severity.svg"),
      low: this.createDecoration("realtimeEngines/low_severity.svg"),
      ignored: this.createDecoration(ThemeUtils.selectIconByTheme('Ignored_light.svg', "Ignored.svg")),
      underline: vscode.window.createTextEditorDecorationType({
        textDecoration: "underline wavy #f14c4c",
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      }),
    };
  }

  private decorationTypes = this.createDecorationTypes();

  private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
  private hoverMessages: Map<string, HoverData> = new Map();

  private decorationsMap = {
    malicious: new Map<string, vscode.DecorationOptions[]>(),
    ok: new Map<string, vscode.DecorationOptions[]>(),
    unknown: new Map<string, vscode.DecorationOptions[]>(),
    critical: new Map<string, vscode.DecorationOptions[]>(),
    high: new Map<string, vscode.DecorationOptions[]>(),
    medium: new Map<string, vscode.DecorationOptions[]>(),
    low: new Map<string, vscode.DecorationOptions[]>(),
    ignored: new Map<string, vscode.DecorationOptions[]>(),
    maliciousIcon: new Map<string, vscode.DecorationOptions[]>(),
    criticalIcon: new Map<string, vscode.DecorationOptions[]>(),
    highIcon: new Map<string, vscode.DecorationOptions[]>(),
    mediumIcon: new Map<string, vscode.DecorationOptions[]>(),
    lowIcon: new Map<string, vscode.DecorationOptions[]>(),
    ignoredIcon: new Map<string, vscode.DecorationOptions[]>(),
  };

  constructor() {
    const config: IScannerConfig = {
      engineName: constants.ossRealtimeScannerEngineName,
      configSection: constants.getOssRealtimeScanner(),
      activateKey: constants.activateOssRealtimeScanner,
      enabledMessage: constants.ossRealtimeScannerStart,
      disabledMessage: constants.ossRealtimeScannerDisabled,
      errorMessage: constants.errorOssScanRealtime,
    };
    super(config);

    // Set up theme change listener using common method
    this.themeChangeListener = BaseScannerService.createThemeChangeHandler(this, 'Ignored_light.svg');
  }

  public clearScanData(uri: vscode.Uri): void {
    const filePath = uri.fsPath;
    this.diagnosticsMap.delete(filePath);
    this.diagnosticCollection.delete(uri);
    this.hoverMessages.delete(filePath);

    Object.values(this.decorationsMap).forEach(map => map.delete(filePath));
  }

  private applyDecorations(uri: vscode.Uri): void {
    const filePath = uri.fsPath;
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri.toString()
    );

    if (editor) {
      const get = (key: keyof typeof this.decorationsMap) => this.decorationsMap[key].get(filePath) || [];

      editor.setDecorations(this.decorationTypes.malicious, get('malicious'));
      editor.setDecorations(this.decorationTypes.ok, get('ok'));
      editor.setDecorations(this.decorationTypes.unknown, get('unknown'));
      editor.setDecorations(this.decorationTypes.critical, get('critical'));
      editor.setDecorations(this.decorationTypes.high, get('high'));
      editor.setDecorations(this.decorationTypes.medium, get('medium'));
      editor.setDecorations(this.decorationTypes.low, get('low'));
      editor.setDecorations(this.decorationTypes.ignored, get('ignored'));

      const allUnderlineDecorations = [
        ...get('maliciousIcon'),
        ...get('criticalIcon'),
        ...get('highIcon'),
        ...get('mediumIcon'),
        ...get('lowIcon'),
        ...get('ignoredIcon'),
      ];

      editor.setDecorations(this.decorationTypes.underline, allUnderlineDecorations);
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

      const ignoredPackagesFile = IgnoreFileManagerInstance.getIgnoredPackagesCount() > 0
        ? IgnoreFileManagerInstance.getIgnoredPackagesTempFile()
        : undefined;

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

    this.decorationsMap.malicious.set(filePath, maliciousDecorations);
    this.decorationsMap.ok.set(filePath, okDecorations);
    this.decorationsMap.unknown.set(filePath, unknownDecorations);
    this.decorationsMap.critical.set(filePath, criticalDecorations);
    this.decorationsMap.high.set(filePath, highDecorations);
    this.decorationsMap.medium.set(filePath, mediumDecorations);
    this.decorationsMap.low.set(filePath, lowDecorations);
    this.decorationsMap.ignored.set(filePath, ignoredDecorations);

    this.decorationsMap.maliciousIcon.set(filePath, maliciousIconDecorations);
    this.decorationsMap.criticalIcon.set(filePath, criticalIconDecorations);
    this.decorationsMap.highIcon.set(filePath, highIconDecorations);
    this.decorationsMap.mediumIcon.set(filePath, mediumIconDecorations);
    this.decorationsMap.lowIcon.set(filePath, lowIconDecorations);

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
      if (diagnosticData?.cxType === constants.ossRealtimeScannerEngineName) {
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
      if (diagnosticData?.cxType === constants.ossRealtimeScannerEngineName) {
        const ossItem = diagnosticData.item as HoverData;
        if (ossItem?.packageName === hoverData.packageName &&
          ossItem?.version === hoverData.version) {

          const range = diagnostic.range;

          this.removeFromAllDecorationMaps(filePath, range);

          const ignoredDecorations = this.decorationsMap.ignored.get(filePath) || [];
          ignoredDecorations.push({ range });
          this.decorationsMap.ignored.set(filePath, ignoredDecorations);

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

    this.decorationsMap.malicious.set(filePath, removeRange(this.decorationsMap.malicious.get(filePath) || []));
    this.decorationsMap.critical.set(filePath, removeRange(this.decorationsMap.critical.get(filePath) || []));
    this.decorationsMap.high.set(filePath, removeRange(this.decorationsMap.high.get(filePath) || []));
    this.decorationsMap.medium.set(filePath, removeRange(this.decorationsMap.medium.get(filePath) || []));
    this.decorationsMap.low.set(filePath, removeRange(this.decorationsMap.low.get(filePath) || []));
    this.decorationsMap.ignored.set(filePath, removeRange(this.decorationsMap.ignored.get(filePath) || []));

    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath);
    if (editor) {
      const get = (key: keyof typeof this.decorationsMap) => this.decorationsMap[key].get(filePath) || [];

      editor.setDecorations(this.decorationTypes.malicious, get('malicious'));
      editor.setDecorations(this.decorationTypes.critical, get('critical'));
      editor.setDecorations(this.decorationTypes.high, get('high'));
      editor.setDecorations(this.decorationTypes.medium, get('medium'));
      editor.setDecorations(this.decorationTypes.low, get('low'));
      editor.setDecorations(this.decorationTypes.ignored, get('ignored'));
    }
  }

  updateProblems<T = unknown>(problems: T, uri: vscode.Uri, fullScanResults?: CxOssResult[]): void {
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
            if (addDiagnostic) {
              unknownDecorations.push({ range });
            }
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

    const ignoredData = ignoreManager.getIgnoredPackagesData();
    const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);

    Object.entries(ignoredData).forEach(([, entry]) => {
      if (entry.type !== constants.ossRealtimeScannerEngineName) {
        return;
      }

      const fileEntry = this.findActiveFileEntry(entry, relativePath);
      if (!fileEntry || !fileEntry.line) {
        return;
      }

      const alreadyHasDecoration = ignoredDecorations.some(decoration =>
        decoration.range.start.line === fileEntry.line
      );

      if (!alreadyHasDecoration) {
        const range = new vscode.Range(
          new vscode.Position(fileEntry.line, 0),
          new vscode.Position(fileEntry.line, 1000)
        );
        ignoredDecorations.push({ range });

        const hoverKey = `${filePath}:${fileEntry.line}`;
        if (!this.hoverMessages.has(hoverKey)) {
          const hoverData: HoverData = {
            packageName: entry.PackageName,
            version: entry.PackageVersion,
            packageManager: entry.PackageManager,
            filePath: filePath,
            line: fileEntry.line,
            status: CxRealtimeEngineStatus.ok
          };
          this.hoverMessages.set(hoverKey, hoverData);
        }
      }
    });

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

    const existingFindingsByPackage = new Map<string, number[]>();
    fullScanResults.forEach(result => {
      const packageKey = `${result.packageManager}:${result.packageName}:${result.version}`;
      if (!existingFindingsByPackage.has(packageKey)) {
        existingFindingsByPackage.set(packageKey, []);
      }
      result.locations.forEach(location => {
        existingFindingsByPackage.get(packageKey)!.push(location.line);
      });
    });

    const activeEntries = Object.entries(ignoredData)
      .filter(([, entry]) => entry.type === constants.ossRealtimeScannerEngineName)
      .flatMap(([packageKey, entry]) =>
        entry.files
          .filter(file => file.active && file.path === relativePath)
          .map(file => ({
            packageKey,
            entry,
            file,
            currentLine: file.line
          }))
      );

    activeEntries.forEach(item => {
      const entryPackageKey = item.packageKey;
      const availableLines = existingFindingsByPackage.get(entryPackageKey);

      if (availableLines && availableLines.length > 0) {
        if (item.currentLine && !availableLines.includes(item.currentLine)) {
          const newLine = availableLines[0];
          const success = ignoreManager.updatePackageLineNumber(item.packageKey, currentFilePath, newLine);

          if (success) {
            this.updateIgnoredDecorationLine(currentFilePath, item.currentLine, newLine);
            this.updateHoverDataLine(currentFilePath, item.currentLine, newLine);
          }
        }
      } else {
        ignoreManager.removePackageEntry(item.packageKey, relativePath);
        if (item.currentLine) {
          this.removeIgnoredDecorationAtLine(currentFilePath, item.currentLine);
        }
      }
    });
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
      diagnostic.source = constants.getCxAi();

      (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data = {
        cxType: constants.ossRealtimeScannerEngineName,
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
      iconDecorations?.push({ range });
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
    Object.values(this.decorationsMap).forEach(map => map.clear());
  }

  public dispose(): void {
    // Dispose theme change listener
    if (this.themeChangeListener) {
      this.themeChangeListener.dispose();
      this.themeChangeListener = undefined;
    }

    // Dispose decoration types
    Object.values(this.decorationTypes).forEach(decoration => {
      if (decoration && typeof decoration.dispose === 'function') {
        decoration.dispose();
      }
    });

    // Call parent dispose if it exists
    if (super.dispose && typeof super.dispose === 'function') {
      super.dispose();
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

  getHoverData(): Map<string, HoverData> {
    return this.hoverMessages;
  }

  getDiagnosticsMap(): Map<string, vscode.Diagnostic[]> {
    return this.diagnosticsMap;
  }

  private updateIgnoredDecorationLine(filePath: string, oldLine: number, newLine: number): void {
    const ignoredDecorations = this.decorationsMap.ignored.get(filePath) || [];

    const oldDecorationIndex = ignoredDecorations.findIndex(decoration =>
      decoration.range.start.line === oldLine
    );

    if (oldDecorationIndex !== -1) {
      const oldDecoration = ignoredDecorations[oldDecorationIndex];
      ignoredDecorations.splice(oldDecorationIndex, 1);

      const newRange = new vscode.Range(
        new vscode.Position(newLine, oldDecoration.range.start.character),
        new vscode.Position(newLine, oldDecoration.range.end.character)
      );
      ignoredDecorations.push({ range: newRange });

      this.decorationsMap.ignored.set(filePath, ignoredDecorations);

      const ignoredIconDecorations = this.decorationsMap.ignoredIcon.get(filePath) || [];
      const oldIconIndex = ignoredIconDecorations.findIndex(decoration =>
        decoration.range.start.line === oldLine
      );

      if (oldIconIndex !== -1) {
        const oldIconDecoration = ignoredIconDecorations[oldIconIndex];
        ignoredIconDecorations.splice(oldIconIndex, 1);

        const newIconRange = new vscode.Range(
          new vscode.Position(newLine, oldIconDecoration.range.start.character),
          new vscode.Position(newLine, oldIconDecoration.range.end.character)
        );
        ignoredIconDecorations.push({ range: newIconRange });
        this.decorationsMap.ignoredIcon.set(filePath, ignoredIconDecorations);
      }

      const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath);
      if (editor) {
        editor.setDecorations(this.decorationTypes.ignored, ignoredDecorations);

        const get = (key: keyof typeof this.decorationsMap) => this.decorationsMap[key].get(filePath) || [];

        const allUnderlineDecorations = [
          ...(get("maliciousIcon") || []),
          ...(get("criticalIcon") || []),
          ...(get("highIcon") || []),
          ...(get("mediumIcon") || []),
          ...(get("lowIcon") || []),
          ...(get("ignoredIcon") || []),
        ];

        editor.setDecorations(this.decorationTypes.underline, allUnderlineDecorations);
      }
    }
  }

  private updateHoverDataLine(filePath: string, oldLine: number, newLine: number): void {
    const oldKey = `${filePath}:${oldLine}`;
    const newKey = `${filePath}:${newLine}`;

    const hoverData = this.hoverMessages.get(oldKey);
    if (hoverData) {
      hoverData.line = newLine;

      this.hoverMessages.set(newKey, hoverData);
      this.hoverMessages.delete(oldKey);
    }
  }


  private removeIgnoredDecorationAtLine(filePath: string, line: number): void {
    const ignoredDecorations = this.decorationsMap.ignored.get(filePath) || [];

    const filteredDecorations = ignoredDecorations.filter(decoration =>
      decoration.range.start.line !== line
    );

    this.decorationsMap.ignored.set(filePath, filteredDecorations);

    const ignoredIconDecorations = this.decorationsMap.ignoredIcon.get(filePath) || [];
    const filteredIconDecorations = ignoredIconDecorations.filter(decoration =>
      decoration.range.start.line !== line
    );
    this.decorationsMap.ignoredIcon.set(filePath, filteredIconDecorations);

    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath);
    if (editor) {
      editor.setDecorations(this.decorationTypes.ignored, filteredDecorations);

      const get = (key: keyof typeof this.decorationsMap) => this.decorationsMap[key].get(filePath) || [];

      const allUnderlineDecorations = [
        ...(get("maliciousIcon") || []),
        ...(get("criticalIcon") || []),
        ...(get("highIcon") || []),
        ...(get("mediumIcon") || []),
        ...(get("lowIcon") || []),
        ...(get("ignoredIcon") || []),
      ];

      editor.setDecorations(this.decorationTypes.underline, allUnderlineDecorations);
    }
  }
}