import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";

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
  packageManager: string;
  packageName: string;
  version: string;
  status: CxRealtimeEngineStatus;
  vulnerabilities?: Array<{ cve: string, description: string, severity: string }>;
}

export interface SecretsHoverData {
  title?: string;
  description: string;
  severity: string;
  location?: {
    line: number;
    startIndex: number;
    endIndex: number;
  };
}

export interface CxDiagnosticData {
  cxType: "oss" | "secrets";
  item: HoverData | SecretsHoverData;
}