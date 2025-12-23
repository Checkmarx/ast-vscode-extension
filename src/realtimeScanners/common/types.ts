import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { CxRealtimeEngineStatus } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { constants } from "../../utils/common/constants";

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
  dispose(): void;
}

export interface IScannerCommand {
  register(): Promise<void>;
  dispose(): void;
}

export interface HoverData {
  packageManager: string;
  packageName: string;
  version: string;
  status: CxRealtimeEngineStatus;
  vulnerabilities?: Array<{ cve: string, description: string, severity: string }>;
  filePath: string;
  line: number;
}

export interface SecretsHoverData {
  title?: string;
  description: string;
  severity: string;
  secretValue: string;
  location?: {
    line: number;
    startIndex: number;
    endIndex: number;
  };
  filePath: string;
}

export interface AscaHoverData {
  ruleName: string;
  description: string;
  severity: string;
  remediationAdvise: string;
  ruleId?: number;
  filePath?: string;
  location?: {
    line: number;
    startIndex: number;
    endIndex: number;
  };
}

export interface ContainersHoverData {
  imageName: string;
  imageTag: string;
  status: CxRealtimeEngineStatus;
  vulnerabilities: Array<{
    cve: string;
    severity: string;
  }>;
  location?: {
    line: number;
    startIndex: number;
    endIndex: number;
  };
  fileType: string;
  filePath: string;
}

export interface IacHoverData {
  similarityId: string;
  title: string;
  description: string;
  severity: string;
  expectedValue: string;
  actualValue: string;
  filePath: string;
  originalFilePath?: string
  location?: {
    line: number;
    startIndex: number;
    endIndex: number;
  };
  fileType: string;
}

const scannerEngineNames = {
  oss: constants.ossRealtimeScannerEngineName,
  secrets: constants.secretsScannerEngineName,
  asca: constants.ascaRealtimeScannerEngineName,
  containers: constants.containersRealtimeScannerEngineName,
  iac: constants.iacRealtimeScannerEngineName
} as const;
export interface CxDiagnosticData {
  cxType: typeof scannerEngineNames[keyof typeof scannerEngineNames];
  item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData;
}