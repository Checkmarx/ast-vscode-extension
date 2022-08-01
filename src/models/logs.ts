import * as vscode from 'vscode';
export class Logs {
	output:vscode.OutputChannel;
	constructor(
		output:vscode.OutputChannel
	) {
		this.output = output;
	}

	public log(level:string, message:string){
		this.output.appendLine(level+" - "+new Date().toLocaleTimeString()+"] "+ message);
	}
	public info(message:string){
		this.output.appendLine("[INFO - "+new Date().toLocaleTimeString()+"] "+ message);
	}
	public error(message:string){
		this.output.appendLine("[ERROR - "+new Date().toLocaleTimeString()+"] "+ message);
	}

	public show(){
		this.output.show();
	}
}