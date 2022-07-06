import * as vscode from "vscode";
import * as kill from 'tree-kill';
import { Logs } from "./models/logs";
import { PROCESS_OBJECT, PROCESS_OBJECT_KEY } from "./utils/constants";
import { get, update } from "./utils/globalState";
import { applyKicsCodeLensProvider, applyKicsDiagnostic, createKicsScan, getCurrentFile, summaryLogs} from "./utils/realtime";
import CxKicsRealTime from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/kicsRealtime/CxKicsRealTime";
import { CxCommandOutput } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxCommandOutput";

export class KicsProvider {
	public process:any;
	public codeLensDisposable:vscode.Disposable;
	constructor(
	  private readonly context: vscode.ExtensionContext,
	  private readonly logs: Logs,
	  private readonly kicsStatusBarItem: vscode.StatusBarItem,
	  private readonly diagnosticCollection: vscode.DiagnosticCollection
	) {
	  const onSave = vscode.workspace.getConfiguration("CheckmarxKICS").get("Activate KICS Auto Scanning") as boolean;
	  this.kicsStatusBarItem.text = onSave===true?"$(check) Checkmarx kics":"$(debug-disconnect) Checkmarx kics";
	  this.kicsStatusBarItem.tooltip = "Checkmarx kics auto scan";
	  this.kicsStatusBarItem.command= "ast-results.viewKicsSaveSettings";
	  this.kicsStatusBarItem.show();
	}


	async runKics() {
		this.kicsStatusBarItem.text = "$(sync~spin) Checkmarx kics: Running Auto Scan";
		this.kicsStatusBarItem.tooltip = "Checkmarx kics is running";
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
		
		// Clear the kics diagnostics
		applyKicsDiagnostic(new CxKicsRealTime(), file.editor.document.uri, this.diagnosticCollection);
		if (this.codeLensDisposable) {this.codeLensDisposable.dispose();}
		
		// Create the kics scan
		const [createObject,process] = await createKicsScan(file.file);
		
		// update the current cli spawned process returned by the wrapper
		this.process = process;
		update(this.context, PROCESS_OBJECT, {id: this.process, name: PROCESS_OBJECT_KEY});

		// asyncly wait for the kics scan to end to create the diagnostics and print the summary
		createObject
		.then((cxOutput:CxCommandOutput) => {
			if(cxOutput.exitCode!== 0) {
				throw new Error(cxOutput.status);
			}
			// Get the results
			if(cxOutput.payload){
				const kicsResults = cxOutput.payload[0];
				// Logs the results summary to the output
				summaryLogs(kicsResults, this.logs);
				// Get the results into the problems
				applyKicsDiagnostic(kicsResults, file.editor.document.uri, this.diagnosticCollection);
				// Get the results into codelens 
				this.codeLensDisposable = applyKicsCodeLensProvider({pattern: file.file}, kicsResults);
				this.kicsStatusBarItem.text = "$(check) Checkmarx kics";
			}
			if(!cxOutput.payload){
				this.kicsStatusBarItem.text = "$(check) Checkmarx kics";
			}
		})
		.catch( error =>{
			this.kicsStatusBarItem.tooltip = "Checkmarx kics auto scan";
			if(error.message && error.message.length>0){
				this.kicsStatusBarItem.text = "$(error) Checkmarx kics";
				this.kicsStatusBarItem.tooltip = "Checkmarx kics auto scan";
				this.logs.error(error);
			}
		});
	  }
}