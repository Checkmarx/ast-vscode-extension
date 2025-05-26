import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logs } from "../../models/logs";
import { IScannerService, IScannerConfig } from "./types";
import { createHash } from "crypto";

export abstract class BaseScannerService implements IScannerService {
  public config: IScannerConfig;
  diagnosticCollection: vscode.DiagnosticCollection;

  constructor(config: IScannerConfig) {
    this.config = config;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
      config.engineName
    );
  }

  abstract scan(document: vscode.TextDocument, logs: Logs): Promise<void>;

  abstract updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void;

  async clearProblems(): Promise<void> {
    this.diagnosticCollection.clear();
  }

  shouldScanFile(document: vscode.TextDocument): boolean {
    const filePath = document.uri.fsPath.replace(/\\/g, "/");

    if (filePath.includes("/node_modules/") || document.uri.scheme !== "file") {
      return false;
    }

    return true;
  }
  // Common utility methods
  protected createTempFolder(folderPath: string): void {
    fs.mkdirSync(folderPath, { recursive: true });
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
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "";
    const relativePath = path.relative(workspaceFolder, document.uri.fsPath);
    return path.join(
      os.tmpdir(),
      baseTempDir,
      this.toSafeTempFileName(relativePath)
    );
  }

  protected toSafeTempFileName(relativePath: string): string {
    const baseName = path.basename(relativePath);
    const hash = createHash("sha256")
      .update(relativePath)
      .digest("hex")
      .substring(0, 16);
    return `${baseName}-${hash}.tmp`;
  }
}
