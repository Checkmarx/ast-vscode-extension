import * as vscode from 'vscode';
//For Prompt's server
import express from 'express';
import { Server } from "http";

const MIN_CODE_LENGTH = 20;
const MAX_CODE_LENGTH = 32 * 1024;

export class PromptSecurity {
	private hostname: string;
	private port?: number;
	private server?: Server;
	private app?: express;
	private context?:vscode.ExtensionContext;
  
	constructor(context:vscode.ExtensionContext,port:number) {
		try{
			this.hostname = "127.0.0.1";
			this.context = context;
			this.port = port;
			this.registerPromptListener();
		} catch(error) {
			vscode.window.showErrorMessage(`An error occurred while activating the PromptListener: ${error.message}`);
		}
	}
	getServer(){
		return this.server;
	}
	deactivate(){
		try{
			if (this.server){
				this.server.close();
			}
		} catch(error) {
			vscode.window.showErrorMessage(`An error occurred while deactivating the plugin: ${error.message}`);
		}
	}
	registerPromptListener(){
		try {
			this.app = express();
			this.app.use(express.json());
			this.app.use(express.urlencoded({ extended: true })); 
			this.server = this.app.listen(this.port,this.hostname);
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
		} catch(error) {
			vscode.window.showErrorMessage(`An error occurred while registering the promptListener: ${error.message}`);
		}
	}
	extensionListener(
	){
		this.app.get('/api/health', (req,res) => {
			res.json({ "vscode":"Yay!" });
		});
		this.app.post('/api/checkCode', (req, res) => {
			try{
				const receivedText: string = req.body.text ?? "";
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
			} catch(error) {
				vscode.window.showErrorMessage(`An error occurred while checking if th code was copied: ${error.message}`);
				res.json({ containsCode: false });
			}
		});
	}
	windowChange(){
		try{
			if (!this.server || !this.server.address()) {
				this.server = this.app.listen(this.port, this.hostname);
			}
		} catch(error) {
			vscode.window.showErrorMessage(`An error occurred in the process of restarting the server due to window change: ${error.message}`);
		}
	}
	getSelectedText(
		event:vscode.TextEditorSelectionChangeEvent
	){
		try{	
			let code  = "";
			if (event.selections.length > 0) {
				const selection = event.selections[0];
				if (!selection.isEmpty) {
					code  = event.textEditor.document.getText(selection)?.trim();
					if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) {
						code = "";
					}
				}
			}
			return code;
		} catch(error) {
			vscode.window.showErrorMessage(`An error occurred while getting selected text: ${error.message}`);
			return "";
		}
	}
	getLastSelectedCodeSections(){
		try{
			let lastSelectedCodeSections: SelectionBuffer[] | undefined = this.context.globalState.get('lastSelectedCodeSections');
			if (!lastSelectedCodeSections) {
				lastSelectedCodeSections = [];
			}
			if (lastSelectedCodeSections.length > 25) {
				lastSelectedCodeSections.shift();
			}
			return lastSelectedCodeSections;
		} catch(error) {
			vscode.window.showErrorMessage(`An error occurred while getting last selected code sections: ${error.message}`);
			return [];
		}
	}
	selectionBuffer(
		event:vscode.TextEditorSelectionChangeEvent
	){
		try{
			const code  = this.getSelectedText(event);
			if (code !==""){
				const filePath = event.textEditor.document.uri.fsPath ?? "";
				const lastSelectedCodeSections = this.getLastSelectedCodeSections();
				lastSelectedCodeSections.push({
					code: code,
					filePath: filePath
				});
				this.context.globalState.update('lastSelectedCodeSections', lastSelectedCodeSections);
			}
		} catch(error) {	
			vscode.window.showErrorMessage(`An error occurred while updating the selection buffer: ${error.message}`);
		}
	}
}
interface SelectionBuffer {
	code: string;
	filePath:string;
}
   