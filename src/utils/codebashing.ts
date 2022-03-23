import * as vscode from "vscode";
import {getCodeBashing} from "./ast";
import { Logs } from "../models/logs";
import { ERROR_REGEX } from "./constants";

export async function getCodebashingLink(cweId: string, language:string, queryName:string,logs:Logs) {
 try {
	logs.log("INFO","Fetching codebashing link");
	const codeBashingArray = await getCodeBashing(cweId,language,queryName);
	vscode.env.openExternal(vscode.Uri.parse(codeBashingArray!.path));
 } catch (err) {
	const error = String(err).replace(ERROR_REGEX,"").replaceAll("\n","");
	vscode.window.showWarningMessage(error,"Alternative Codebashing link").then(selection => {
		        vscode.env.openExternal(vscode.Uri.parse(
		            'https://google.pt'));;
				}
	);	
	logs.log("WARNING",error);
 } 
}

// vscode.window.showInformationMessage('Click for more Info', GoToHelp)
//     .then(selection => {
//       if (selection === GoToHelp) {
//         vscode.env.openExternal(vscode.Uri.parse(
//             'https://www.merriam-webster.com/dictionary/hep'));