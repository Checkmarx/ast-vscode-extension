import * as vscode from "vscode";
import { cx } from "../cx";
import fs from "fs";
import path from "path";
import * as os from "os";
import { Logs } from "../models/logs";
import { constants } from "../utils/common/constants";
import CxOssResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import CxManifestStatus from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxManifestStatus";



export const diagnosticCollection = vscode.languages.createDiagnosticCollection(
  constants.realtimeScannerEngineName
);

const decorationTypes = {
	malicious: vscode.window.createTextEditorDecorationType({
	  overviewRulerColor: 'red',
	  overviewRulerLane: vscode.OverviewRulerLane.Right,
	  textDecoration: 'underline red wavy',
	  after: {
		contentText: ' ❌ Malicious',
		color: 'red',
		margin: '0 0 0 1em'
	  }
	}),
	ok: vscode.window.createTextEditorDecorationType({
	  after: {
		contentText: ' ✅ OK',
		color: 'green',
		margin: '0 0 0 1em'
	  }
	}),
	unknown: vscode.window.createTextEditorDecorationType({
	  after: {
		contentText: ' ❓ Unknown',
		color: 'gray',
		margin: '0 0 0 1em'
	  }
	})
  };

// export async function scanOSS(document: vscode.TextDocument, logs: Logs) {

//   if (ignoreFiles(document))
// 	{return;}
//   try {
// 	// SAVE TEMP FILE
// 	const filePath = saveTempFile(
// 	  path.basename(document.uri.fsPath),
// 	  document.getText()
// 	);
// 	// RUN ASCA SCAN
// 	logs.info("Start Realtime scan On File: " + document.uri.fsPath);
// 	const scanResults = await cx.scanOSS(filePath);
// 	// DELETE TEMP FILE
// 	deleteFile(filePath); 
// 	console.info("file %s deleted", filePath);
// 	// HANDLE ERROR
// 	// if (scanResult.error) {
// 	//   logs.warn(
// 	// 	"Realtime Scanner Warning: " +
// 	// 	  (scanResult.error.description ?? scanResult.error)
// 	//   );
// 	//   return;
// 	// }
// 	// VIEW PROBLEMS
// 	// logs.info(
// 	//   scanResult.scanDetails.length +
// 	// 	" security best practice violations were found in " +
// 	// 	document.uri.fsPath
// 	// );
// 	updateProblems(scanResults, document.uri);
//   } catch (error) {
// 	console.error(error);
// 	logs.error(constants.errorScanRealtime);
//   }
// }

export async function scanOSS(document: vscode.TextDocument, logs: Logs) {
	if (ignoreFiles(document)) return;
  
	const originalFilePath = document.uri.fsPath;
	const tempSubFolder = getTempSubFolderPath(document);
  
	try {
	  createTempFolder(tempSubFolder);
  
	  const mainTempPath = saveMainManifestFile(tempSubFolder, originalFilePath, document.getText());
	  const companionTempPath = saveCompanionFile(tempSubFolder, originalFilePath);
  
	  logs.info("Start Realtime scan On File: " + originalFilePath);
	  const scanResults = await cx.scanOSS(mainTempPath);
	console.info("file %s deleted", originalFilePath);

	updateProblems(scanResults, document.uri);
  
	} catch (error) {
		console.error(error);
		logs.error(constants.errorScanRealtime);
		} finally {
	  deleteTempFolder(tempSubFolder);
	}
  }
  

function ignoreFiles(document: vscode.TextDocument): boolean {
  // ignore vscode system files
  if(document.uri.scheme !== 'file')
  {return true;}

   // List of allowed file names
   const allowedManifestFilesNames = [
    "csproj",
    "directory.packages.props",
    "packages.config",
    "pom.xml",
    "package.json",
    "requirements.txt",
    "go.mod"
  ];

  const fileName = path.basename(document.uri.fsPath).toLowerCase();
  if (!allowedManifestFilesNames.includes(fileName)) {
    return true;
  }

  return false;
  
}

function createTempFolder(folderPath: string) {
	fs.mkdirSync(folderPath, { recursive: true });
  }

  function getTempSubFolderPath(document: vscode.TextDocument): string {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || '';
	const relativePath = path.relative(workspaceFolder, document.uri.fsPath);
	const sanitized = sanitizePath(relativePath);
	return path.join(os.tmpdir(), 'checkmarx-scan', sanitized);
  }
  
  function saveMainManifestFile(tempFolder: string, originalFilePath: string, content: string): string {
	const fileName = path.basename(originalFilePath);
	const tempFilePath = path.join(tempFolder, fileName);
	fs.writeFileSync(tempFilePath, content);
	return tempFilePath;
  }
  
  function saveCompanionFile(tempFolder: string, originalFilePath: string): string | null {
	const companionFileName = getCompanionFileName(path.basename(originalFilePath));
	if (!companionFileName) return null;
  
	const companionOriginalPath = path.join(path.dirname(originalFilePath), companionFileName);
	if (!fs.existsSync(companionOriginalPath)) return null;
  
	const companionTempPath = path.join(tempFolder, companionFileName);
	fs.copyFileSync(companionOriginalPath, companionTempPath);
	return companionTempPath;
  }
  
  function sanitizePath(p: string): string {
	return p.replace(/[/\\:?<>|"]/g, '_');
  }
  
export async function clearRealtimeScannerProblems() {
  diagnosticCollection.clear();
}

export function updateProblems(scanResults: CxOssResult [], uri: vscode.Uri) {
  diagnosticCollection.delete(uri);
const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
if (!editor) return;

const diagnostics: vscode.Diagnostic[] = [];

const maliciousDecorations: vscode.DecorationOptions[] = [];
const okDecorations: vscode.DecorationOptions[] = [];
const unknownDecorations: vscode.DecorationOptions[] = [];

for (const result of scanResults) {
  const range = new vscode.Range(
	new vscode.Position(result.lineStart, result.startIndex),
	new vscode.Position(result.lineEnd, result.endIndex)
  );

  let severity: vscode.DiagnosticSeverity;
  let message: string;

  switch (result.status as CxManifestStatus) {
	case CxManifestStatus.malicious:
	  severity = vscode.DiagnosticSeverity.Error;
	  message = `Malicious package detected: ${result.packageName}@${result.version}`;
	  maliciousDecorations.push({ range });
	  break;
	case 'OK':
	  severity = vscode.DiagnosticSeverity.Information;
	  message = `Package is OK: ${result.packageName}@${result.version}`;
	  okDecorations.push({ range });
	  break;
	case 'Unknown':
	  severity = vscode.DiagnosticSeverity.Warning;
	  message = `Unknown package status: ${result.packageName}@${result.version}`;
	  unknownDecorations.push({ range });
	  break;
	default:
	  continue;
  }

  diagnostics.push(new vscode.Diagnostic(range, message, severity));
}

// עדכון הדיאגנוסטיקות במסמך
diagnosticCollection.set(uri, diagnostics);

// הוספת הקישוטים לעריכה
editor.setDecorations(decorationTypes.malicious, maliciousDecorations);
editor.setDecorations(decorationTypes.ok, okDecorations);
editor.setDecorations(decorationTypes.unknown, unknownDecorations);
}

// function saveTempFile(fileName: string, content: string): string | null {
//   try {
// 	const tempDir = os.tmpdir();
// 	const tempFilePath = path.join(tempDir, constants.realtimeScannerDirectory, fileName);
// 	fs.writeFileSync(tempFilePath, content);
// 	console.info("Temp file was saved in: " + tempFilePath);
// 	return tempFilePath;
//   } catch (error) {
// 	console.error("Failed to save temporary file:", error);
// 	return null;
//   }
// }



// function deleteFile(filePath: string) {
//   try {
// 	fs.unlinkSync(filePath);
//   } catch (error) {
// 	// when the file sent again before it come back...
//   }
// }
