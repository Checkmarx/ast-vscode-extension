import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { CxManifestStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxManifestStatus";

export interface IScannerConfig {
  engineName: string;
  configSection: string;
  activateKey: string;
  enabledMessage: string;
  disabledMessage: string;
  errorMessage: string;
}

export interface IScannerService {
  scan(document: vscode.TextDocument, logs: Logs): Promise<void>;
  clearProblems(): Promise<void>;
  shouldScanFile(document: vscode.TextDocument): boolean;
  updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void;
  diagnosticCollection: vscode.DiagnosticCollection;
}

export interface IScannerCommand {
  register(): Promise<void>;
  dispose(): Promise<void>;
}

export interface HoverData {
  packageName: string;
  version: string;
  status: CxManifestStatus;
  vulnerabilities?: Array<{cve: string, description: string, severity: string}>;
}