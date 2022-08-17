import * as vscode from "vscode";
export class KicsDiagnostic extends vscode.Diagnostic{
	kicsResult :any;
	constructor(range: vscode.Range, message: string,kicsResult:any, severity?: vscode.DiagnosticSeverity){
        super(range,message,severity);
        this.kicsResult = kicsResult;
    }
}