import * as vscode from "vscode";

import { KICS_REALTIME_FILE } from "./constants";
import { Logs } from "../models/logs";
import { get } from "./globalState";
import { getResultsRealtime } from "./ast";
import CxKicsRealTime from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/kicsRealtime/CxKicsRealTime";


export function summaryLogs(kicsResults:CxKicsRealTime,logs:Logs){
	logs.info("Results summary:"+ JSON.stringify(kicsResults?.summary, null, 2).replaceAll("{","").replaceAll("}",""));
}

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

export function applyKicsDiagnostic(kicsResults : CxKicsRealTime, uri: vscode.Uri, diagnosticCollection: vscode.DiagnosticCollection) {
	diagnosticCollection.clear();

	const kicsDiagnotic: vscode.Diagnostic[] = [];

	for (const kicsResult of kicsResults.results) {
		const file = kicsResult.files[0];

		const startPosition = new vscode.Position(file.line-1, 0);
		const endPosition = new vscode.Position(file.line-1, 999);

		kicsDiagnotic.push({
            message: `(${kicsResult.severity}) ${kicsResult.query_name}\n${kicsResult.description}\n\nValue: ${kicsResult.query_name}\nRecomended fix: ${file.expected_value}\n`,
            range: new vscode.Range(startPosition, endPosition),
            severity: vscode.DiagnosticSeverity.Error,
            source: 'KICS ',
			code: {value: `${kicsResult.query_name}`, target: vscode.Uri.parse(kicsResult.query_url)}
        });
	}
	
	diagnosticCollection.set(uri, kicsDiagnotic);
}

export function applyKicsCodeLensProvider(file: vscode.DocumentSelector, kicsResults : CxKicsRealTime) : vscode.Disposable {
	const codelens =  vscode.languages.registerCodeLensProvider(file, {
		provideCodeLenses(document, token) {
			return getKicsCodeLensProvider(kicsResults);
		}
	});

	return codelens;
}

export function getKicsCodeLensProvider(kicsResults : CxKicsRealTime) : vscode.CodeLens[] | Thenable<vscode.CodeLens[]>{
	type Summary = { HIGH: number; MEDIUM: number; LOW: number , INFO: number};
	const resultsmap: Map<number, Summary> = new Map<number, Summary>();
	for (const kicsResult of kicsResults.results) {
		const file = kicsResult.files[0];
		const line = file.line - 1;
		
		if (!resultsmap.has(line)) {
			resultsmap.set(line, {'HIGH':0,'MEDIUM':0,'LOW':0,'INFO':0});
		}

		let summary = resultsmap.get(line);
		summary[kicsResult.severity] += 1;
	}

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




export function updateKicsDiagnostic(kicsResults :  CxKicsRealTime, diagnosticCollection: vscode.DiagnosticCollection, editor: vscode.TextEditor,context:vscode.ExtensionContext){
	let previousLine=-1;
	let previousSeverity="";
	kicsResults.results?.reverse().map((kics: { category :string;description :string;platform :string; files: [], severity: string,query_url:string,query_name:string})=>{
		previousSeverity = kics.severity;
		kics.files.map((file:{actual_value:string;expected_value:string;issue_type:string;line:number;similarity_id:string})=>{
			const column =  0;
			const line = file.line-1;
			//used 999 to force to mark it to the end of the line
			let length = column + 99;
			const startPosition = new vscode.Position(line, column);
			const endPosition = new vscode.Position(line, length);
			const severity = kics.severity === 'HIGH' ?
				'high_untoggle':
				kics.severity === 'MEDIUM' ? 'medium_untoggle':
				kics.severity === 'LOW' ? 'low_untoggle':
				'info_untoggle';
			const content = new vscode.MarkdownString(`<img style="float: left" src="vscode-file://vscode-app${vscode.Uri.joinPath(context.extensionUri).fsPath}/media/icons/`+severity+'.svg'+`"/><b style="margin-left: 50px">[${kics.query_name}](${kics.query_url})</b>`);
			content.appendMarkdown(`
			<div>
				<p>
					<b>Description : </b>${kics.description}
				</p>
				<hr>
				<p>
					<b>Value : </b>${file.actual_value}
				</p>
				<p>
					<b>Recomended fix : </b>${file.expected_value}
				</p>
				<hr>
			</div>
			
			`);
			content.supportHtml = true;
			content.isTrusted = true;
			let largeNumberDecorationType = vscode.window.createTextEditorDecorationType({});;
			if (previousLine!==line){
				largeNumberDecorationType = vscode.window.createTextEditorDecorationType({
					backgroundColor: previousSeverity === 'HIGH' ?
													   'rgb(244, 133, 130, 0.2)':
													   previousSeverity === 'MEDIUM' ? 'rgb(250, 197, 127, 0.2)':
													   previousSeverity === 'LOW' ? 'rgb(2, 147, 2, 0.2)':
													   'rgb(117, 180, 203, 0.2)',
				});
				previousLine = line;
				previousSeverity = kics.severity;
			}
			editor.setDecorations(largeNumberDecorationType, [{  range: new vscode.Range(startPosition, endPosition),hoverMessage:content}]);
		});
	});
}

export async function getCurrentFile(context:vscode.ExtensionContext, logs : Logs):Promise<{ file: string | undefined; editor: vscode.TextEditor; }> {
	// Cleanup markdown from files
	//await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	//await vscode.commands.executeCommand("workbench.action.reopenClosedEditor");
	let file = get(context,KICS_REALTIME_FILE)?.id;
	let opened = vscode.window.activeTextEditor;
	if(!file){
	  if(opened){
		if(opened.document.fileName.length>0){
		  file = opened.document.fileName;
		}
		else{
		  logs.error("No file opened or file not in focus. Please open and click one file to run kics real-time scan");
		}
	  }
	  else{
		logs.error("No file opened or file not in focus. Please open and click one file to run kics real-time scan");
	  }
	}
	return {file:file,editor:opened!};
	}
