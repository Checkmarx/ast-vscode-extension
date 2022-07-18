import * as vscode from "vscode";
export class KicsCodeActionProvider implements vscode.CodeActionProvider {

	private kicsResults :any;
	private file :{ file: string; editor: vscode.TextEditor; };
	private diagnosticCollection :vscode.DiagnosticCollection;
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	constructor(kicsResults: any,file:{ file: string; editor: vscode.TextEditor; },diagnosticCollection :vscode.DiagnosticCollection) {
		this.kicsResults = kicsResults;
		this.file = file;
		this.diagnosticCollection = diagnosticCollection;
	}

	provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
		// for each diagnostic entry that has the matching `code`, create a code action command
		let similarityIdsWithFix = this.filterResultsWithFix(this.kicsResults);
		return context.diagnostics // filtrar pelos similarityIdsWithFix
			// .filter()
			.map(diagnostic => this.createCommandCodeAction(diagnostic));
	}

	private createCommandCodeAction(diagnostic: vscode.Diagnostic): vscode.CodeAction {
		let v :any = diagnostic.code.valueOf();
		let v1 = v.value;
		// used to be able to use kicsDiagnostic typ without changing the context implementation
		let kicsDiagnostic:any = diagnostic;
		const action = new vscode.CodeAction('Apply fix to '+v1, vscode.CodeActionKind.QuickFix);
		action.command = { command: "ast-results.kicsRemediation", title: 'KICS fix', tooltip: 'This will apply KICS fix for the vulnerability',arguments:[kicsDiagnostic.kicsResult,this.kicsResults,this.file,this.diagnosticCollection] };
		action.diagnostics = [diagnostic];
		action.isPreferred = true;
		return action;
	}

	private filterResultsWithFix(kicsResults):string[]{
		let r = [];
		kicsResults.results.forEach(result=>{
			result.files.forEach(file=>{
				if(file.expected_value){ // mudar aqui para o campo remediation
					r.push(file.similarity_id);
				}
			});
		});
		return r;
	}
}