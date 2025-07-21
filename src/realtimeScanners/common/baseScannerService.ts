import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logs } from "../../models/logs";
import { IScannerService, IScannerConfig } from "./types";
import { createHash } from "crypto";
import { DiagnosticPriorityManager } from "./diagnosticPriorityManager";

export abstract class BaseScannerService implements IScannerService {
  public config: IScannerConfig;
  diagnosticCollection: vscode.DiagnosticCollection;
  private diagnosticPriorityManager: DiagnosticPriorityManager | null = null;
  private usePrioritySystem: boolean;

  constructor(config: IScannerConfig, priority?: number) {
    this.config = config;
    this.usePrioritySystem = priority !== undefined;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
      config.engineName
    );
    
    if (this.usePrioritySystem && priority !== undefined) {
      this.diagnosticPriorityManager = DiagnosticPriorityManager.getInstance();
      this.diagnosticPriorityManager.registerScanner(
        config.engineName,
        priority,
        this.diagnosticCollection
      );
    }
  }

  abstract scan(document: vscode.TextDocument, logs: Logs): Promise<void>;

  abstract updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void;

  async clearProblems(): Promise<void> {
    if (this.usePrioritySystem && this.diagnosticPriorityManager) {
      this.diagnosticPriorityManager.clearAllDiagnostics(this.config.engineName);
    } else {
      this.diagnosticCollection.clear();
    }
  }

  protected setDiagnosticsWithPriority(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): void {
    if (this.usePrioritySystem && this.diagnosticPriorityManager) {
      this.diagnosticPriorityManager.setDiagnostics(this.config.engineName, uri, diagnostics);
    } else {
      // Fallback to direct diagnostic collection for scanners that don't use priority system
      this.diagnosticCollection.set(uri, diagnostics);
    }
  }

  protected deleteDiagnosticsWithPriority(uri: vscode.Uri): void {
    if (this.usePrioritySystem && this.diagnosticPriorityManager) {
      this.diagnosticPriorityManager.deleteDiagnostics(this.config.engineName, uri);
    } else {
      // Fallback to direct diagnostic collection for scanners that don't use priority system
      this.diagnosticCollection.delete(uri);
    }
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
    return createHash("sha256")
      .update(input)
      .digest("hex")
      .substring(0, 16);
  }
}
