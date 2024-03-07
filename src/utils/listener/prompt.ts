import * as vscode from 'vscode';
//For Prompt's server
import express from 'express';
import * as http from "http";



export class PromptListener {
	private hostname: string;
	private port: number;
	private server: http.Server;
	private app: express;
  
	constructor() {
	  this.hostname = "127.0.0.1";
	  this.port = 3312;
	  this.app = express();
	  this.app.use(express.json());
	  this.app.use(express.urlencoded({ extended: true })); 
	  this.server = this.app.listen(this.port,this.hostname);
	}
	getServer(){
		return this.server;
	}
	extensionListener(
		context:vscode.ExtensionContext
	){
		this.app.post('/api/checkCode', (req, res) => {
			const receivedText: string = req.body.text;
			let containsCode: boolean = false;
			let filePath: string | undefined = undefined;
			const lastSelectedCodeSections: SelectionBuffer[] | undefined = context.globalState.get('lastSelectedCodeSections');
			if (lastSelectedCodeSections) {
				for (const section of lastSelectedCodeSections) {
					if (receivedText.includes(section.code)) {
						containsCode = true;
						filePath = section.filePath;
						break;
					}
				}
			}
			res.json({ containsCode, filePath });
		});
	}
	windowChange(){
		if (!this.server || !this.server.address()) {
			this.server = this.app.listen(this.port, this.hostname);
		}
	}
	selectionBuffer(
		context:vscode.ExtensionContext,
		event:vscode.TextEditorSelectionChangeEvent
	){
		if (event.selections.length > 0) {
            const selection = event.selections[0];
            if (!selection.isEmpty) {
                const editor = event.textEditor;
                const code  = editor.document.getText(selection).trim();
				if (code.length > 20) {
					const filePath = editor.document.uri.fsPath;
					let lastSelectedCodeSections: SelectionBuffer[] | undefined = context.globalState.get('lastSelectedCodeSections');
					if (!lastSelectedCodeSections) {
						lastSelectedCodeSections = [];
					}
					if (lastSelectedCodeSections.length > 25) {
						lastSelectedCodeSections.shift();
					}
					lastSelectedCodeSections.push({
						code: code,
						filePath: filePath
					});
					context.globalState.update('lastSelectedCodeSections', lastSelectedCodeSections);
            	}
			}
        }
	}
 	
}
interface SelectionBuffer {
	code: string;
	filePath:string;
}
   