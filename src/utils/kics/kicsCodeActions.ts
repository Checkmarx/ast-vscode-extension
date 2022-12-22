import * as vscode from "vscode";
import { KicsDiagnostic } from "./kicsDiagnostic";
export class KicsCodeActionProvider implements vscode.CodeActionProvider {
	private readonly kicsResults :any;
	private readonly file :{ file: string; editor: vscode.TextEditor; };
	private readonly diagnosticCollection :vscode.DiagnosticCollection;
	private readonly fixableResults :[];
	private fixableResultsByLine:[];
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	constructor(kicsResults: any,file:{ file: string; editor: vscode.TextEditor;},diagnosticCollection :vscode.DiagnosticCollection,fixableResults:[],fixableResultsByLine:[]) {
		this.kicsResults = kicsResults;
		this.file = file;
		this.diagnosticCollection = diagnosticCollection;
		this.fixableResults = fixableResults;
		this.fixableResultsByLine = fixableResultsByLine;
	}

	provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
		// List of fixable results for the fix all action
		let fixAllResults = [];
		return context.diagnostics
			.filter((diagnostic:KicsDiagnostic) => {
				// Check if the diagnostic has a fix
				let fixable = KicsCodeActionProvider.filterFixableResults(diagnostic);
				if(fixable){
					// Add the result to the fix all list
					fixAllResults.push(diagnostic.kicsResult);
				}
				return fixable;
			})
			.map(diagnostic => this.createCommandCodeAction(diagnostic))
			.concat(this.fixableResultsByLine.length>0 && fixAllResults.length>1?this.createFixGroupCodeAction(this.fixableResultsByLine,fixAllResults):[])// Add the grouped by line fix -> usar o this.fixableResultsByLine construir diagnostico para o grupo com o mesmo range e o this.fixableResultsByLine numa funcao como a createFixGroupCodeAction
			.concat(fixAllResults.length>0?this.createFixFileCodeAction(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),"Quick Fix"),this.fixableResults):[]); // Add the fix all action if there is more than one fix in the file
	}

	// Create individual quick fix
	private createCommandCodeAction(diagnostic: vscode.Diagnostic): vscode.CodeAction {
		let valueOf :any = diagnostic.code.valueOf();
		let queryName = valueOf.value;
		// used to be able to use kicsDiagnostic typ without changing the context implementation
		let kicsDiagnostic:any = diagnostic;
		const action = new vscode.CodeAction('Apply fix to '+queryName, vscode.CodeActionKind.QuickFix);
		action.command = { command: "checkmarx-one-results.kicsRemediation", title: 'KICS fix', tooltip: 'This will apply KICS fix for the vulnerability',arguments:[[kicsDiagnostic.kicsResult],this.kicsResults,this.file,this.diagnosticCollection,false,false] };
		action.diagnostics = [diagnostic];
		action.isPreferred = true;
		return action;
	}
	
	// Create quick fix for the entire file
	private createFixFileCodeAction(diagnostic: vscode.Diagnostic,fixableResults): vscode.CodeAction[] {
		// used to be able to use kicsDiagnostic typ without changing the context implementation
		const action = new vscode.CodeAction('File : Apply all available fixes', vscode.CodeActionKind.QuickFix);
		action.command = { command: "checkmarx-one-results.kicsRemediation", title: 'KICS fix', tooltip: 'This will apply KICS fix for the vulnerability',arguments:[fixableResults,this.kicsResults,this.file,this.diagnosticCollection,true,false] };
		action.diagnostics = [diagnostic];
		action.isPreferred = true;
		return [action];
	}

	// Create quick fix for the group
	private createFixGroupCodeAction(fixableResultsByLine,fixAllResults): vscode.CodeAction[] {
		// used to be able to use kicsDiagnostic typ without changing the context implementation
	let actions:vscode.CodeAction[] = [];
	fixableResultsByLine.forEach((objectResult,index) => {
		let lines = Object.keys(objectResult);
		let values = Object.values(objectResult);
		if(values.length>0){
			values.forEach((results:[]) => {
				// Check if it should be added to this specific line, by going throw the lines results and compare them
				const contains = fixAllResults.every((element:never) => {
					return results.includes(element);
				  });
				if(contains){
					let vscodeRange :vscode.Range = new vscode.Range(new vscode.Position(parseInt(lines[index]), 0), new vscode.Position(parseInt(lines[index]), 999));
					console.log(vscodeRange.start);
					let diagnostic = new vscode.Diagnostic(vscodeRange,"Quick Fix");
					let action = new vscode.CodeAction('Line : Apply all available fixes', vscode.CodeActionKind.QuickFix);
					action.command = { command: "checkmarx-one-results.kicsRemediation", title: 'KICS fix', tooltip: 'This will apply KICS fix for the vulnerability',arguments:[fixAllResults,this.kicsResults,this.file,this.diagnosticCollection,false,true] };
					action.diagnostics = [diagnostic];
					action.isPreferred = true;
					actions.push(action);
				}
			});
		}
	});
	return actions;
	}

	public static filterFixableResults(diagnostic:KicsDiagnostic):boolean{
		let fixable = false;
		diagnostic.kicsResult.files.forEach(file => {
				if(file.remediation!==''){ // filter only results that have remediation
					fixable = true;
				}
			});
		return fixable;
	}
}