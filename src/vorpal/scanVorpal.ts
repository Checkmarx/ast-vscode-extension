import * as vscode from "vscode";
import { cx } from "../cx";
import fs from "fs";
import path from "path";
import * as os from "os";
import { error } from "console";
import { Logs } from "../models/logs";
import CxVorpal from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/vorpal/CxVorpal";
import { constants } from "../utils/common/constants";

const vorpalDir = "CxVorpal";

export const diagnosticCollection = vscode.languages.createDiagnosticCollection(
  constants.extensionFullName
);

export async function scanVorpal(document: vscode.TextDocument, logs: Logs) {
  
  if (ignoreFiles(document))
    return;
  try {
    // SAVE TEMP FILE
    const filePath = saveTempFile(
      path.basename(document.uri.fsPath),
      document.getText()
    );
    // RUN VORPAL SCAN
    logs.info("Start Vorpal Scan On File: " + document.uri.fsPath);
    const scanVprpalResult = await cx.scanVorpal(filePath);
    // DELETE TEMP FILE
    deleteFile(filePath); 
    console.info("file %s deleted", filePath);
    // HANDLE ERROR
    if (scanVprpalResult.error) {
      logs.error(
        "Vorpal Error: " +
          (scanVprpalResult.error.description ?? scanVprpalResult.error)
      );
      return;
    }
    // VIEW PROBLEMS
    logs.info(
      scanVprpalResult.scanDetails.length +
        " vulnerabilities were found in " +
        document.uri.fsPath
    );
    updateProblems(scanVprpalResult, document.uri);
  } catch (error) {
    console.error(error);
    logs.error(constants.errorScanVorpal);
  }
}

function ignoreFiles(document: vscode.TextDocument): boolean {
  // ignore our output log file, settings.json
  if (document.languageId.toUpperCase() == 'LOG' ||
    (path.basename(document.uri.fsPath) === 'settings.json' && document.uri.fsPath.includes("User"))) {
    return true;
  }
  return false;
}

export async function clearVorpalProblems() {
  diagnosticCollection.clear();
}

function updateProblems(scanVprpalResult: CxVorpal, uri: vscode.Uri) {
  diagnosticCollection.delete(uri);
  const diagnostics: vscode.Diagnostic[] = [];

  for (let i = 0; i < scanVprpalResult.scanDetails.length; i++) {
    const res = scanVprpalResult.scanDetails[i];
    const range = new vscode.Range(
      new vscode.Position(res.line - 1, 0),
      new vscode.Position(res.line - 1, 100)
    );
    const diagnostic: vscode.Diagnostic = new vscode.Diagnostic(
      range,
      res.ruleName + " - " + res.remediationAdvise,
      parseSavirity(res.severity)
    );
    diagnostic.code = res.ruleId;
    diagnostic.source = constants.vorpalEngineName;
    diagnostics.push(diagnostic);
  }
  diagnosticCollection.set(uri, diagnostics);
}

function parseSavirity(vorpalSavirity: string) {
  switch (vorpalSavirity.toUpperCase()) {
    case "HIGH":
      return vscode.DiagnosticSeverity.Error;
    case "MEDIUM":
      return vscode.DiagnosticSeverity.Warning;
    case "LOW":
      return vscode.DiagnosticSeverity.Information;
    default:
      console.log("Invalid vorpalSavirity value: " + vorpalSavirity);
      return vscode.DiagnosticSeverity.Information;
  }
}
function saveTempFile(fileName: string, content: string): string | null {
  try {
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, vorpalDir, fileName);
    fs.writeFileSync(tempFilePath, content);
    console.info("Temp file was saved in: " + tempFilePath);
    return tempFilePath;
  } catch (error) {
    console.error("Failed to save temporary file:", error);
    return null;
  }
}

export async function installVorpal(logs: Logs) {
  try {
    const res = await cx.installVorpal();
    if (res.error) {
      const errorMessage = constants.errorInstallation + " : " + res.error;
      vscode.window.showErrorMessage(errorMessage);
      logs.error(errorMessage);
      return;
    }
    logs.info(constants.vorpalStart);
  } catch (error) {
    console.log(error);
    logs.warn(constants.errorInstallation);
  }
}

function deleteFile(filePath: string) {
  try {
    fs.unlinkSync(filePath)
  } catch (error) {
    // if the file sent again before it com back...
    console.error("Failed to delete file:" + filePath, error);
  }
}

