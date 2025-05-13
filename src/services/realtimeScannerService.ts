import * as vscode from "vscode";
import { cx } from "../cx";
import fs from "fs";
import path from "path";
import * as os from "os";
import { Logs } from "../models/logs";
import { constants } from "../utils/common/constants";
import CxOssResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import { CxManifestStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxManifestStatus";
import { createHash } from 'crypto';


export const diagnosticCollection = vscode.languages.createDiagnosticCollection(
  constants.realtimeScannerEngineName
);

const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

const decorationTypes = {
	malicious: vscode.window.createTextEditorDecorationType({
	  overviewRulerColor: 'red',
	  overviewRulerLane: vscode.OverviewRulerLane.Left,
	  textDecoration: 'underline red wavy',
	  gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..', 'media', 'icons', 'malicious.svg')), 
	  after: {
		contentIconPath: path.join(__dirname, '..', '..', 'media', 'icons', 'success.svg'),
		color: 'red',
		margin: '0 0 0 1em'
	  }
	}),
	ok: vscode.window.createTextEditorDecorationType({
		gutterIconPath: path.join(__dirname, '..', '..', 'media', 'icons', 'circle-check.svg'),
	  after: {
		contentText: ' ✅ OK',
		color: 'green',
		margin: '0 0 0 1em'
	  }
	}),
	unknown: vscode.window.createTextEditorDecorationType({
		gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..', 'media', 'icons', 'question-mark.svg')),
		gutterIconSize: 'contain',
	// 	before: {
	// 	contentIconPath: path.join(__dirname, '..', '..', 'media', 'icons', 'success.svg'),
	// 	contentText: ' ❓ Unknown',
	// 	color: 'gray',
	// 	margin: '0 0 0 1em'
	//   }
	})
  };


export async function scanOSS(document: vscode.TextDocument, logs: Logs) {
	if (isIgnoredFile(document)) return;
  
	const originalFilePath = document.uri.fsPath;
	const tempSubFolder = getTempSubFolderPath(document);
  
	try {
	  createTempFolder(tempSubFolder);
  
	  const mainTempPath = saveMainManifestFile(tempSubFolder, originalFilePath, document.getText());
	  const companionTempPath = saveCompanionFile(tempSubFolder, originalFilePath);
  
	  logs.info("Start Realtime scan On File: " + originalFilePath);
	  console.log("Start Realtime scan On File: " + originalFilePath);
	  
	  const scanResults = await cx.scanOSS(mainTempPath);

	updateProblems(scanResults, document.uri);//display in the problems section only malicious    
  
	} catch (error) {
		console.error(error);
		logs.error(constants.errorScanRealtime);
		} finally {
	  deleteTempFolder(tempSubFolder);
	}
  }
  

function isIgnoredFile(document: vscode.TextDocument): boolean {
  // ignore vscode system files
  if(document.uri.scheme !== 'file')
  {return true;}

   // List of allowed file names
   const allowedManifestFileNames = [
    "directory.packages.props",
    "packages.config",
    "pom.xml",
    "package.json",
    "requirements.txt",
    "go.mod"
  ];
  const allowedFileExtensions = [
	"csproj",
  ];

  const fileName = path.basename(document.uri.fsPath).toLowerCase();
const fileExtension = path.extname(document.uri.fsPath).toLowerCase().replace('.', ''); 
if (allowedManifestFileNames.includes(fileName) || allowedFileExtensions.includes(fileExtension)) {
	return false; 
 }

  return true;
  
}

function createTempFolder(folderPath: string) {
	fs.mkdirSync(folderPath, { recursive: true });
  }
  function deleteTempFolder(folderPath: string) {
	try {
	  fs.rmSync(folderPath, { recursive: true, force: true });
	  console.info("Temp folder deleted:", folderPath);
	} catch (err) {
	  console.warn("Failed to delete temp folder:", err);
	}
  }
  
  function getTempSubFolderPath(document: vscode.TextDocument): string {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || '';
	const relativePath = path.relative(workspaceFolder, document.uri.fsPath);
	return path.join(os.tmpdir(), constants.realtimeScannerDirectory, toSafeTempFileName(relativePath));
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
  function toSafeTempFileName(relativePath: string): string {
	const baseName = path.basename(relativePath);
	// const prefix = sanitizeName(baseName.substring(0, 30)); // קידומת מתוך השם המקורי
	const hash = createHash('sha256').update(relativePath).digest('hex').substring(0, 16);
	return `${baseName}-${hash}.tmp`;
  }

  
  function getCompanionFileName(fileName: string): string {
	if (fileName === 'package.json') return 'package-lock.json';
	if (fileName.includes('.csproj')) return 'packages.lock.json';//TODO: check it
	return '';
  }
  
export async function clearRealtimeScannerProblems() {
  diagnosticCollection.clear();
}

export function updateProblems(scanResults: CxOssResult [], uri: vscode.Uri) {
	console.info("updateProblems", uri.toString());
	const diagnostics: vscode.Diagnostic[] = [];

  diagnosticCollection.delete(uri);
const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
if (!editor) return;


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

  switch (result.status) {
	case CxManifestStatus.malicious:
	  severity = vscode.DiagnosticSeverity.Error;
	  message = `Malicious package detected: ${result.packageName}@${result.version}`;
	  maliciousDecorations.push({ range });
	  break;
	case CxManifestStatus.ok:
	  severity = vscode.DiagnosticSeverity.Information;
	  message = `Package is OK: ${result.packageName}@${result.version}`;
	  okDecorations.push({ range });
	  break;
	case CxManifestStatus.unknown:
	  severity = vscode.DiagnosticSeverity.Warning;
	  message = `Unknown package status: ${result.packageName}@${result.version}`;
	  unknownDecorations.push({ range });
	  break;
	default:
	  continue;
  }

  diagnostics.push(new vscode.Diagnostic(range, message, severity));
}
diagnosticsMap.set(uri.fsPath, diagnostics);
diagnosticsMap.forEach((diagnostics, uri) => {
    const vscodeUri = vscode.Uri.file(uri);
    diagnosticCollection.set(vscodeUri, diagnostics);
  });

// diagnosticCollection.set(uri, diagnostics);

editor.setDecorations(decorationTypes.malicious, maliciousDecorations);
editor.setDecorations(decorationTypes.ok, okDecorations);
editor.setDecorations(decorationTypes.unknown, unknownDecorations);
}


