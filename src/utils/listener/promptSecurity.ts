import * as vscode from 'vscode';
//For Prompt's server
import express from 'express';
import { Server } from "http";



export class PromptSecurity {
	private hostname: string;
	private port?: number;
	private server?: Server;
	private app?: express;
	private context?:vscode.ExtensionContext;
  
	constructor() {
	  this.hostname = "127.0.0.1";
	}
	getServer(){
		return this.server;
	}
	deactivate(){
		if (this.server){
			this.server.close();
		}
	}
	registerPromptListener(context:vscode.ExtensionContext,port:number){
		this.port = port;
		this.app = express();
		this.app.use(express.json());
		this.app.use(express.urlencoded({ extended: true })); 
		this.server = this.app.listen(this.port,this.hostname);
		this.context = context;
		//Starting the endpoint the browser extension can call
	    this.extensionListener();
		//On selection send the context and the event to the selection buffer funtion
		vscode.window.onDidChangeTextEditorSelection(event => { 
            this.selectionBuffer(event);
        });
        //If the window is changed - Prompt
        vscode.window.onDidChangeWindowState(async windowState => {
            if (windowState){
            	this.windowChange();
            }
        });
	}
	extensionListener(
	){
		this.app.get('/api/health', (req,res) => {
			res.json({ "vscode":"Yay!" });
		});
		this.app.post('/api/checkCode', (req, res) => {
			const receivedText: string = req.body.text;
			let containsCode: boolean = false;
			let filePath: string | undefined = undefined;
			const lastSelectedCodeSections: SelectionBuffer[] | undefined = this.context.globalState.get('lastSelectedCodeSections');
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
		event:vscode.TextEditorSelectionChangeEvent
	){
		if (event.selections.length > 0) {
            const selection = event.selections[0];
            if (!selection.isEmpty) {
                const editor = event.textEditor;
                const code  = editor.document.getText(selection).trim();
				if (code.length > 20 && code.length < 32* 1024) {
					const filePath = editor.document.uri.fsPath;
					let lastSelectedCodeSections: SelectionBuffer[] | undefined = this.context.globalState.get('lastSelectedCodeSections');
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
					this.context.globalState.update('lastSelectedCodeSections', lastSelectedCodeSections);
            	}
			}
        }
	}
 	
}
interface SelectionBuffer {
	code: string;
	filePath:string;
}
   