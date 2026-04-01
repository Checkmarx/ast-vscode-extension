import * as vscode from "vscode";
import { KicsRealtime } from "../models/kicsRealtime";
export class KicsDiagnostic extends vscode.Diagnostic {
  kicsResult: KicsRealtime;
  constructor(
    range: vscode.Range,
    message: string,
    kicsResult: KicsRealtime,
    severity?: vscode.DiagnosticSeverity
  ) {
    super(range, message, severity);
    this.kicsResult = kicsResult;
  }
}
