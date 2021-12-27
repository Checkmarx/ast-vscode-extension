import * as vscode from 'vscode';
export class Logs {
	output:vscode.OutputChannel;
	constructor(
		output:vscode.OutputChannel
	) {
		this.output = output;
	}

	public log(level:string, message:string){
		this.output.appendLine("[Cx"+level+" - "+new Date().toLocaleTimeString()+"] "+ message);
	}
	public info(message:string){
		this.output.appendLine("[CxINFO - "+new Date().toLocaleTimeString()+"] "+ message);
	}

	public show(){
		this.output.show();
	}
}