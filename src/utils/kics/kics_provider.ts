import * as vscode from "vscode";
import * as kill from 'tree-kill';
import * as path from "path";
import {join} from "path";
import {Logs} from "../../models/logs";
import {
    KICS_COUNT,
    KICS_QUERIES,
    KICS_RESULTS,
    KICS_RESULTS_FILE,
    KICS_TOTAL_COUNTER,
    PROCESS_OBJECT,
    PROCESS_OBJECT_KEY
} from "../common/constants";
import {get, update} from "../common/globalState";
import {
    applyKicsCodeLensProvider,
    applyKicsDiagnostic,
    createKicsScan,
    getCurrentFile,
    remediationSummaryLogs,
    resultsSummaryLogs
} from "./realtime";
import CxKicsRealTime from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/kicsRealtime/CxKicsRealTime";
import {CxCommandOutput} from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxCommandOutput";
import {KicsCodeActionProvider} from "./kicsCodeActions";
import {kicsRemediation} from "../ast/ast";
import {writeFileSync} from "fs";
import {KicsDiagnostic} from "./kicsDiagnostic";
import {KICS_REALTIME} from "../common/commands";

export class KicsProvider {
	public process:any;
	public codeLensDisposable:vscode.Disposable;
	public codeActionDisposable:vscode.Disposable;
	constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly logs: Logs,
        private readonly kicsStatusBarItem: vscode.StatusBarItem,
        private readonly diagnosticCollection: vscode.DiagnosticCollection,
        private fixableResults : any,
        private readonly fixableResultsByLine : any
	) {
	  const onSave = vscode.workspace.getConfiguration("CheckmarxKICS").get("Activate KICS Auto Scanning") as boolean;
	  this.kicsStatusBarItem.text = onSave===true?"$(check) Checkmarx KICS":"$(debug-disconnect) Checkmarx KICS";
	  this.kicsStatusBarItem.tooltip = "Checkmarx KICS auto scan";
	  this.kicsStatusBarItem.command= "checkmarx-one.viewKicsSaveSettings";
	  this.kicsStatusBarItem.show();
	  this.fixableResults = [];
	  this.fixableResultsByLine = [];
	}

	async runKics() {
		this.kicsStatusBarItem.text = "$(sync~spin) Checkmarx KICS: Running KICS Auto Scan";
		this.kicsStatusBarItem.tooltip = "Checkmarx KICS is running";
		this.kicsStatusBarItem.show();
		// Get current file, either from global state or from the current open file
		const file = await getCurrentFile(this.context,this.logs);
		if (!file) {return;}
		
		// Get the last process from global state, if present we try to kill it to avoid process spawn spam
		const savedProcess = get(this.context, PROCESS_OBJECT);
		if (savedProcess && savedProcess.id) {
			kill(savedProcess.id.pid);
			update(this.context, PROCESS_OBJECT, {id: undefined, name: PROCESS_OBJECT_KEY});
		}
		
		// Clear the KICS diagnostics
		applyKicsDiagnostic(new CxKicsRealTime(), file.editor.document.uri, this.diagnosticCollection);
		if (this.codeLensDisposable) {this.codeLensDisposable.dispose();}
		if(this.codeActionDisposable){this.codeActionDisposable.dispose();}
		
		// Create the KICS scan
		const [createObject,process] = await createKicsScan(file.file);
		
		// update the current cli spawned process returned by the wrapper
		this.process = process;
		update(this.context, PROCESS_OBJECT, {id: this.process, name: PROCESS_OBJECT_KEY});

		// async wait for the KICS scan to end to create the diagnostics and print the summary
		createObject
		.then((cxOutput:CxCommandOutput) => {
			if(cxOutput.exitCode!== 0) {
				throw new Error(cxOutput.status);
			}
			// Get the results
			if(cxOutput.payload){
				const kicsResults = cxOutput.payload[0];
				// Logs the results summary to the output
				resultsSummaryLogs(kicsResults, this.logs);
				// Get the results into the problems
				applyKicsDiagnostic(kicsResults, file.editor.document.uri, this.diagnosticCollection);
				// Get the results into codelens
				if (this.codeLensDisposable) {this.codeLensDisposable.dispose();}
				if(this.codeActionDisposable){this.codeActionDisposable.dispose();}
				this.codeLensDisposable = applyKicsCodeLensProvider({pattern: file.file}, kicsResults);
				this.kicsStatusBarItem.text = "$(check) Checkmarx KICS";
				this.updateKicsFixableResults(this.diagnosticCollection);
				this.codeActionDisposable = vscode.languages.registerCodeActionsProvider(file.editor.document.uri,new KicsCodeActionProvider(kicsResults,file,this.diagnosticCollection,this.fixableResults,this.fixableResultsByLine));
			}
		})
		.catch(error => {
			this.kicsStatusBarItem.tooltip = "Checkmarx KICS auto scan";
			if(error.message && error.message.length>0){
				this.kicsStatusBarItem.text = "$(error) Checkmarx KICS";
				this.kicsStatusBarItem.tooltip = "Checkmarx KICS auto scan";
				this.logs.error(error);
				update(this.context, PROCESS_OBJECT, {id: undefined, name: PROCESS_OBJECT_KEY});
			}
		});
	  }

	async kicsRemediation (fixedResults,kicsResults,file,diagnosticCollection:vscode.DiagnosticCollection,fixAll,fixLine,logs){
		// Call KICS remediation
		this.kicsStatusBarItem.text = "$(sync~spin) Checkmarx KICS: Running KICS Fix";
		const kicsFile = path.dirname(file.file);
		const resultsFile = this.createKicsResultsFile(kicsResults);
		let similarityIdFilter = "";
		if(fixAll===false && fixLine===false){
			fixedResults[0].files.forEach(element => similarityIdFilter+=element.similarity_id+",");
			similarityIdFilter = similarityIdFilter.slice(0, -1);
		}
		if(fixLine){
			fixedResults.forEach(result => {
				result.files.forEach(element => similarityIdFilter+=element.similarity_id+",");	
			});
			similarityIdFilter=similarityIdFilter.slice(0, -1);
		}
		const [createObject,_] = await kicsRemediation(resultsFile,kicsFile,"",similarityIdFilter);
		createObject
			.then(async (cxOutput:CxCommandOutput) => {
				if(cxOutput.exitCode===0){
					// Remove the specific kicsResult from the list of kicsResults
					// Update the list of fixable results for the quick fix all
                    kicsResults.results = kicsResults.results.filter(totalResultsElement => {
                        return !fixedResults.includes(totalResultsElement);
                    });
					// Remove codelens, previous diagnostics and actions
					applyKicsDiagnostic(new CxKicsRealTime(), file.editor.document.uri, diagnosticCollection,);
					this.codeLensDisposable.dispose();
					// Information messages
					let message = !fixAll?fixedResults[0].query_name:"the entire file";
					vscode.window.showInformationMessage("Fix applied to "+message);
					remediationSummaryLogs(cxOutput.payload, this.logs);
					logs.info("Fixes applied to "+message);
					this.kicsStatusBarItem.text = "$(check) Checkmarx KICS";
					this.updateKicsFixableResults(diagnosticCollection);
					vscode.commands.executeCommand(KICS_REALTIME);
				}
				else{
					logs.error("Error applying fix: "+ JSON.stringify(cxOutput.payload));
				}
			}).catch(err => {
				logs.error("Error applying fix: "+ err);
			});
	}

	createKicsResultsFile(kicsResults):string{
		let fullPath =  join(__dirname, KICS_RESULTS_FILE);
		try {
			// this was needed to match our structure with the original KICS results field names
			kicsResults[KICS_QUERIES] = kicsResults[KICS_RESULTS];
			kicsResults[KICS_TOTAL_COUNTER] = kicsResults[KICS_COUNT];
			delete kicsResults[KICS_RESULTS];
			delete kicsResults[KICS_COUNT];
			// results to string, to be written to the file
			const data = JSON.stringify(kicsResults);
			// revert changes in the results object
			kicsResults[KICS_RESULTS] = kicsResults[KICS_QUERIES];
			kicsResults[KICS_COUNT] = kicsResults[KICS_TOTAL_COUNTER];
			delete kicsResults[KICS_QUERIES];
			delete kicsResults[KICS_TOTAL_COUNTER];
			writeFileSync(fullPath, data, {
				flag: 'w',
		  	});
		} catch (error) {
			return "";
		}
		return fullPath;		
	}

	updateKicsFixableResults(diagnosticCollection:vscode.DiagnosticCollection){
		diagnosticCollection.forEach((_,diagnostics)=>{
			diagnostics
			.forEach((diagnostic:KicsDiagnostic) => {
				// Check if the diagnostic has a fix
				let fixable = KicsCodeActionProvider.filterFixableResults(diagnostic);
				if(fixable){
					// Add the result to the fix all list
					this.fixableResults.push(diagnostic.kicsResult);
					const key = diagnostic.range.start.line;
					const index = this.findObjectIndexInList(this.fixableResultsByLine,key);
					if(index >= 0) {
						let testIndex = this.fixableResultsByLine[index];
						let testKey = testIndex[key];
						this.fixableResultsByLine[index][key].push(diagnostic.kicsResult);
						console.log(testKey);
					}
					else{
						this.fixableResultsByLine.push({[key]:[diagnostic.kicsResult]});
					}
				}
				return fixable;
			});
		});
	}
	
	findObjectIndexInList(list, key) { 
		let foundIndex = -1;
		list.forEach((element,index) => {
			if(element[key]){
				foundIndex = index;
			}
		});
		return foundIndex;
	}
}