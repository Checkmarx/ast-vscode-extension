import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logs } from "../../models/logs";
import { IScannerService, IScannerConfig, AscaHoverData, SecretsHoverData } from "./types";
import { createHash } from "crypto";
import { CxRealtimeEngineStatus } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { ThemeUtils } from "../../utils/themeUtils";

export abstract class BaseScannerService implements IScannerService {
  protected editorChangeListener: vscode.Disposable | undefined;

  /**
   * Common theme change handler that can be used by all scanner services
   * @param scannerInstance - The scanner instance with decorationTypes and applyDecorations method
   * @param iconPath - The light theme icon path (defaults to 'Ignored_light.svg')
   * @returns Disposable for the theme change listener
   */
  protected static createThemeChangeHandler(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scannerInstance: any,
    iconPath: string = 'Ignored_light.svg'
  ): vscode.Disposable {
    // Handle case where VS Code APIs might not be available (e.g., in tests)
    if (!vscode.window.onDidChangeActiveColorTheme) {
      // Return a mock disposable for test environments
      return {
        dispose: () => {
          // No-op for test environments
        }
      };
    }

    return vscode.window.onDidChangeActiveColorTheme(() => {
      // Dispose old ignored decoration and recreate with new theme
      if (scannerInstance.decorationTypes?.ignored) {
        scannerInstance.decorationTypes.ignored.dispose();
        scannerInstance.decorationTypes.ignored = scannerInstance.createDecoration(
          ThemeUtils.selectIconByTheme(iconPath, "Ignored.svg")
        );

        // Reapply decorations to all visible editors
        if (vscode.window.visibleTextEditors) {
          vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
            if (scannerInstance.shouldScanFile(editor.document)) {
              scannerInstance.applyDecorations(editor.document.uri);
            }
          });
        }
      }
    });
  }

  public async initializeScanner(): Promise<void> {
    this.editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
      this.onEditorChange.bind(this)
    );
  }

  protected onEditorChange(editor: vscode.TextEditor | undefined): void {
    if (editor && this.shouldScanFile(editor.document) && typeof (this as any).applyDecorations === 'function') {
      (this as any).applyDecorations(editor.document.uri);
    }
  }

  public config: IScannerConfig;
  diagnosticCollection: vscode.DiagnosticCollection;

  private static diagnosticCollections = new Map<string, vscode.DiagnosticCollection>();
  private static hoverDataMaps = new Map<string, Map<string, SecretsHoverData | AscaHoverData[]>>();

  constructor(config: IScannerConfig) {
    this.config = config;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
      config.engineName
    );

    BaseScannerService.diagnosticCollections.set(config.engineName, this.diagnosticCollection);
  }

  protected getOtherScannerCollection(engineName: string): vscode.DiagnosticCollection | undefined {
    return BaseScannerService.diagnosticCollections.get(engineName);
  }
  protected registerHoverDataMap(hoverDataMap: Map<string, SecretsHoverData | AscaHoverData[]>): void {
    BaseScannerService.hoverDataMaps.set(this.config.engineName, hoverDataMap);
  }
  protected getOtherScannerHoverData(engineName: string): Map<string, SecretsHoverData | AscaHoverData[]> | undefined {
    return BaseScannerService.hoverDataMaps.get(engineName);
  }

  abstract scan(document: vscode.TextDocument, logs: Logs): Promise<void>;

  abstract updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void;


  public dispose(): void {
    if (this.editorChangeListener) {
      this.editorChangeListener.dispose();
    }
  }

  async clearProblems(): Promise<void> {
    this.diagnosticCollection.clear();
  }

  shouldScanFile(document: vscode.TextDocument): boolean {
    if (document.uri.scheme !== "file") {
      return false;
    }

    const filePath = document.uri.fsPath.replace(/\\/g, "/");

    if (filePath.includes("/node_modules/")) {
      return false;
    }
    return true;
  }

  // Common utility methods
  protected createTempFolder(folderPath: string): void {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  protected deleteTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn("Failed to delete temp file:", err);
    }
  }

  protected deleteTempFolder(folderPath: string): void {
    try {
      fs.rmSync(folderPath, { recursive: true, force: true });
    } catch (err) {
      console.warn("Failed to delete temp folder:", err);
    }
  }

  protected getTempSubFolderPath(
    document: vscode.TextDocument,
    baseTempDir: string
  ): string {
    return path.join(os.tmpdir(), baseTempDir);
  }

  protected generateFileHash(input: string): string {
    const now = new Date();
    const timeSuffix = `${now.getMinutes()}${now.getSeconds()}`;
    return createHash("sha256")
      .update(input + timeSuffix)
      .digest("hex")
      .substring(0, 16);
  }

  async getFullPathWithOriginalCasing(uri: vscode.Uri): Promise<string | undefined> {
    const dirPath = path.dirname(uri.fsPath);
    const dirUri = vscode.Uri.file(dirPath);
    const entries = await vscode.workspace.fs.readDirectory(dirUri);

    const fileNameLower = path.basename(uri.fsPath).toLowerCase();

    for (const [entryName, _type] of entries) {
      if (entryName.toLowerCase() === fileNameLower) {
        return path.join(dirPath, entryName);
      }
    }
    return undefined;
  }

  private generateTempFileInfo(originalFilePath: string) {
    const originalExt = path.extname(originalFilePath);
    const baseName = path.basename(originalFilePath, originalExt);
    const originalFileName = path.basename(originalFilePath);
    const hash = this.generateFileHash(originalFilePath);

    return {
      originalExt,
      baseName,
      originalFileName,
      hash
    };
  }

  protected saveFile(tempFolder: string, originalFilePath: string, content: string): string {
    const { originalExt, baseName, hash } = this.generateTempFileInfo(originalFilePath);
    const tempFileName = `${baseName}-${hash}${originalExt}`;
    const tempFilePath = path.join(tempFolder, tempFileName);
    fs.writeFileSync(tempFilePath, content);
    return tempFilePath;
  }

  protected createSubFolderAndSaveFile(tempFolder: string, originalFilePath: string, content: string): { tempFilePath: string; tempSubFolder: string } {
    const { originalFileName, hash } = this.generateTempFileInfo(originalFilePath);
    const subFolder = path.join(tempFolder, `${originalFileName}-${hash}`);
    if (!fs.existsSync(subFolder)) {
      fs.mkdirSync(subFolder, { recursive: true });
    }
    const tempFilePath = path.join(subFolder, originalFileName);
    fs.writeFileSync(tempFilePath, content);
    return { tempFilePath, tempSubFolder: subFolder };
  }

  protected getHighestSeverity(severities: string[]): string {
    const severityPriority = [
      CxRealtimeEngineStatus.malicious,
      CxRealtimeEngineStatus.critical,
      CxRealtimeEngineStatus.high,
      CxRealtimeEngineStatus.medium,
      CxRealtimeEngineStatus.low,
      CxRealtimeEngineStatus.unknown,
      CxRealtimeEngineStatus.ok
    ];

    for (const priority of severityPriority) {
      if (severities.includes(priority)) {
        return priority;
      }
    }
  }

  /**
   * Helper function to find an active file entry by relative path with normalized path comparison
   * @param entry - The ignored package entry
   * @param relativePath - The relative path to find
   * @returns The matching file entry or undefined
   */
  protected findActiveFileEntry(
    entry: { files: Array<{ path: string; active: boolean; line?: number }> },
    relativePath: string
  ): { path: string; active: boolean; line?: number } | undefined {
    const normalizedRelativePath = path.normalize(relativePath);
    return entry.files.find(f => path.normalize(f.path) === normalizedRelativePath && f.active);
  }
}
