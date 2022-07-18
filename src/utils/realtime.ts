import * as vscode from "vscode";
import { KICS_REALTIME_FILE } from "./constants";
import { Logs } from "../models/logs";
import { get } from "./globalState";
import { getResultsRealtime } from "./ast";
import CxKicsRealTime from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/kicsRealtime/CxKicsRealTime";
import { KicsSummary } from "../models/kicsNode";
import { KicsDiagnostic } from "./kicsDiagnostic";

// Logs the output of kics autoscan summary
export function summaryLogs(kicsResults:CxKicsRealTime,logs:Logs){
	logs.info("Results summary:"+ JSON.stringify(kicsResults?.summary, null, 2).replaceAll("{","").replaceAll("}",""));
}

// Create the auto kics scan
export async function createKicsScan(file: string | undefined){
	let results :any;
	try {
		const additionalParams = vscode.workspace.getConfiguration("CheckmarxKICS").get("Additional Parameters") as string;
		results = await getResultsRealtime(file!,additionalParams);
	  } catch (err : any){
		throw new Error(err.message);	
	  }
	return results;
}

// Main Diagnostic function, creates and applies the problems for kics realtime results
export function applyKicsDiagnostic(kicsResults : CxKicsRealTime, uri: vscode.Uri, diagnosticCollection: vscode.DiagnosticCollection) {
	diagnosticCollection.clear();

	const kicsDiagnostic: KicsDiagnostic[] = [];
	for (const kicsResult of kicsResults.results) {
		const file = kicsResult.files[0];
		const startPosition = new vscode.Position(file.line-1, 0);
		const endPosition = new vscode.Position(file.line-1, 999);
	   	kicsDiagnostic.push({
			message: `${kicsResult.query_name} (${kicsResult.severity.charAt(0) + kicsResult.severity.slice(1).toLowerCase()})
"${kicsResult.description}"
Value: 
 ${kicsResult.query_name}
Recomended fix: 
 ${file.expected_value}
	   `			,
			kicsResult: kicsResult,
			range:new vscode.Range(startPosition, endPosition),
			severity:getSeverityCode(kicsResult.severity),
			source: 'KICS ',
			code: {value: `${kicsResult.query_name}`, target: vscode.Uri.parse(kicsResult.query_url)}
	   });
	}
	
	diagnosticCollection.set(uri, kicsDiagnostic);
}

// Get the correct Diagnostic to apply in problems
function getSeverityCode(severity) {
    switch (severity) {
      case "HIGH":
        return vscode.DiagnosticSeverity.Error;
      case "MEDIUM":
        return vscode.DiagnosticSeverity.Warning;
      case "INFO":
        return vscode.DiagnosticSeverity.Information;
      case "LOW":
        return vscode.DiagnosticSeverity.Information;
    }
    return vscode.DiagnosticSeverity.Information;
  }

// Register codeLens
export function applyKicsCodeLensProvider(file: vscode.DocumentSelector, kicsResults : CxKicsRealTime) : vscode.Disposable {
	const codelens =  vscode.languages.registerCodeLensProvider(file, {
		provideCodeLenses(document, token) {
			return getKicsCodeLensProvider(kicsResults);
		}
	});

	return codelens;
}

// Add content to the codeLen provider
export function getKicsCodeLensProvider(kicsResults : CxKicsRealTime) : vscode.CodeLens[] | Thenable<vscode.CodeLens[]>{
	const resultsmap: Map<number, KicsSummary> = new Map<number, KicsSummary>();
	for (const kicsResult of kicsResults.results) {
		const file = kicsResult.files[0];
		const line = file.line - 1;
		
		if (!resultsmap.has(line)) {
			resultsmap.set(line, new KicsSummary(0,0,0,0));
		}

		let summary = resultsmap.get(line);
		summary[kicsResult.severity] += 1;
	}

	const codeLensResults: vscode.CodeLens[] = generateCodeLens(resultsmap);
	return codeLensResults;
}

// Get the current opened file in order to run the realtime scan
export async function getCurrentFile(context:vscode.ExtensionContext, logs : Logs):Promise<{ file: string | undefined; editor: vscode.TextEditor; }> {
	let file = get(context,KICS_REALTIME_FILE)?.id;
	let opened = vscode.window.activeTextEditor;
	if(!file){
	  if(opened && opened.document.fileName.length>0){
		file = opened.document.fileName;
	  }
	  else{
		logs.error("No file opened or file not in focus. Please open and click one file to run kics real-time scan");
	  }
	}
	return {file:file,editor:opened!};
}

// Go throw the kics results and generate the message for each codelens entry in the file
export function generateCodeLens(resultsmap:Map<number, KicsSummary>):vscode.CodeLens[] {
	const codeLensResults: vscode.CodeLens[] = [];
	for (const result of resultsmap.entries()) {
		const line = result[0];
		const count = result[1];
		let message = "KICS:";
		if(count["HIGH"]>0){
			message+=" HIGH: " + count["HIGH"] + " | ";
		}
		if(count["MEDIUM"]>0){
			message+=" MEDIUM: " + count["MEDIUM"] + " | ";
		}
		if(count["LOW"]>0){
			message+=" LOW: " + count["LOW"] + " | ";
		}
		if(count["INFO"]>0){
			message+=" INFO: " + count["INFO"] + " | ";
		}

		codeLensResults.push(new vscode.CodeLens(new vscode.Range(new vscode.Position(line, 0),new vscode.Position(line, 999)), {
			title: message.slice(0, -2),
			tooltip: "",
			command: "",
			arguments: []
		}));
	}
	return codeLensResults;
}