import { KicsRealtime } from "./kicsRealtime";
import { AstResult } from "./results";
import * as vscode from "vscode";
import path = require("path");
import {
	constants,
  } from "../utils/common/constants";
export class GptResult {
	filename = "";
	line = 0;
	severity = "";
	vulnerabilityName = "";
	resultID = "";
	constructor(astResult: AstResult, kicsResult: KicsRealtime) {

		if (kicsResult !== undefined) {
			this.filename = kicsResult.files[0].file_name.toString();
			this.line = kicsResult.files[0].line;
			this.severity = kicsResult.severity;
			this.vulnerabilityName = kicsResult.query_name;
		}
		if (astResult !== undefined) {
			const workspacePath = vscode.workspace.workspaceFolders;
			if (astResult.type === "sast") {
				this.filename = workspacePath ? workspacePath[0].uri.fsPath : astResult.fileName;
				this.resultID = astResult.id;
			}
			if (astResult.type === constants.scsSecretDetection) {
				if (workspacePath && astResult.data.filename) {
					this.filename = path.join(workspacePath[0].uri.fsPath, astResult.data.filename);
				} 
			}
			else {
				try{
					this.filename = workspacePath ? path.join(workspacePath[0].uri.fsPath, astResult.kicsNode?.data.filename ?? "") : astResult.kicsNode?.data.filename;
				}
				catch(e){
					console.log("Could not produce filename. error: ", e);
				}
			}
			this.line = astResult.kicsNode?.data.line;
			this.severity = astResult.severity;
			this.vulnerabilityName = astResult.label.replaceAll("_", " ");
		}
	}
}