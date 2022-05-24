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
	await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	await vscode.commands.executeCommand("workbench.action.reopenClosedEditor");
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
