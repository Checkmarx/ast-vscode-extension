import CxKicsRealTime from '@checkmarxdev/ast-cli-javascript-wrapper/dist/main/kicsRealtime/CxKicsRealTime';
import * as vscode from 'vscode';
/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {

    private codeLenses: vscode.CodeLens[] = [];
    
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
	private results:CxKicsRealTime;

    constructor(results:CxKicsRealTime) {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
		this.results=results;
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
            this.codeLenses = [];
			let previousSeverity="";
			let previousLine=0;
			let count = {HIGH:0,MEDIUM:0,LOW:0,INFO:0};
			this.results.results?.map((kics: { category :string;description :string;platform :string; files: [], severity: string,query_url:string,query_name:string})=>{
				previousSeverity = kics.severity;
				count[kics.severity]+=1;
				kics.files.map((file:{actual_value:string;expected_value:string;issue_type:string;line:number;similarity_id:string})=>{
					const column =  0;
					const line = file.line-1;
					//used 999 to force to mark it to the end of the line
					let length = column + 99;
					const startPosition = new vscode.Position(line, column);
					const endPosition = new vscode.Position(line, length);
					const range = new vscode.Range(startPosition,endPosition);
					if(previousLine!==line){
							this.codeLenses.push(new vscode.CodeLens(range, {
								title:this.generateMessage(count) ,
								tooltip: "",
								command: "",
								arguments: []
							}));
							count = {HIGH:0,MEDIUM:0,LOW:0,INFO:0};
					}
					previousLine=line+1;
				});
			});
            return this.codeLenses;
   
    }

    private generateMessage(count):string{
		let r = "";
		if(count["HIGH"]>0){
			r+=" HIGH: " + count["HIGH"] + " | ";
		}
		if(count["MEDIUM"]>0){
			r+=" MEDIUM: " + count["MEDIUM"] + " | ";
		}
		if(count["LOW"]>0){
			r+=" LOW: " + count["LOW"] + " | ";
		}
		if(count["INFO"]>0){
			r+=" INFO: " + count["INFO"] + " | ";
		}
		return r.slice(0, -2);
	}
}
