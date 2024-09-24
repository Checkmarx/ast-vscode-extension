import * as vscode from "vscode";
import { cx } from "../cx";
import fs from "fs";
import path from "path";
import * as os from "os";
import { error } from "console";
import { Logs } from "../models/logs";
import CxAsca from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/asca/CxAsca";
import { constants } from "../utils/common/constants";

const ascaDir = "CxVorpal";

export const diagnosticCollection = vscode.languages.createDiagnosticCollection(
  constants.extensionFullName
);

export async function scanAsca(document: vscode.TextDocument, logs: Logs) {

  if (ignoreFiles(document))
    {return;}
  try {
    // SAVE TEMP FILE
    const filePath = saveTempFile(
      path.basename(document.uri.fsPath),
      document.getText()
    );
    // RUN ASCA SCAN
    logs.info("Start ASCA scan On File: " + document.uri.fsPath);
    const scanAscaResult = await cx.scanAsca(filePath);
    // DELETE TEMP FILE
    deleteFile(filePath); 
    console.info("file %s deleted", filePath);
    // HANDLE ERROR
    if (scanAscaResult.error) {
      logs.warn(
        "ASCA Warning: " +
          (scanAscaResult.error.description ?? scanAscaResult.error)
      );
      return;
    }
    // VIEW PROBLEMS
    logs.info(
      scanAscaResult.scanDetails.length +
        " security best practice violations were found in " +
        document.uri.fsPath
    );
    updateProblems(scanAscaResult, document.uri);
  } catch (error) {
    console.error(error);
    logs.error(constants.errorScanAsca);
  }
}

function ignoreFiles(document: vscode.TextDocument): boolean {
  // ignore vscode system files
  return document.uri.scheme !== 'file';
}

export async function clearAscaProblems() {
  diagnosticCollection.clear();
}

function updateProblems(scanAscaResult: CxAsca, uri: vscode.Uri) {
  diagnosticCollection.delete(uri);
  const diagnostics: vscode.Diagnostic[] = [];

  for (let i = 0; i < scanAscaResult.scanDetails.length; i++) {
    const res = scanAscaResult.scanDetails[i];
    const range = new vscode.Range(
      new vscode.Position(res.line - 1, 0),
      new vscode.Position(res.line - 1, 100)
    );
    const diagnostic: vscode.Diagnostic = new vscode.Diagnostic(
      range,
      `${res.ruleName} - ${res.remediationAdvise}`,
      parseSeverity(res.severity)
    );
    diagnostic.source = constants.ascaEngineName;
    diagnostics.push(diagnostic);
  }
  diagnosticCollection.set(uri, diagnostics);
}

function parseSeverity(ascaSeverity: string): vscode.DiagnosticSeverity {
  const severityMap: Record<string, vscode.DiagnosticSeverity> = {
    CRITICAL: vscode.DiagnosticSeverity.Error,
    HIGH: vscode.DiagnosticSeverity.Error,
    MEDIUM: vscode.DiagnosticSeverity.Warning,
    LOW: vscode.DiagnosticSeverity.Information
  };

  const severity = severityMap[ascaSeverity.toUpperCase()];

  if (severity === undefined) {
    console.log(`Invalid ASCASeverity value: ${ascaSeverity}`);
    return vscode.DiagnosticSeverity.Information;
  }

  return severity;
}

function saveTempFile(fileName: string, content: string): string | null {
  try {
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, ascaDir, fileName);
    fs.writeFileSync(tempFilePath, content);
    console.info("Temp file was saved in: " + tempFilePath);
    return tempFilePath;
  } catch (error) {
    console.error("Failed to save temporary file:", error);
    return null;
  }
}

export async function installAsca(logs: Logs) {
  try {
    const res = await cx.installAsca();
    if (res.error) {
      const errorMessage = constants.errorInstallation + " : " + res.error;
      vscode.window.showErrorMessage(errorMessage);
      logs.error(errorMessage);
      return;
    }
  } catch (error) {
    console.log(error);
    logs.warn(constants.errorInstallation);
  }
}

function deleteFile(filePath: string) {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    // when the file sent again before it come back...
  }
}
