import * as vscode from "vscode";
import { AstResult } from "../models/results";
import { getResultsFilePath } from "./utils";
import {triageUpdate} from "./ast";
import { get } from "./globalState";
import * as fs from "fs";
import { PROJECT_ID_KEY, TYPES } from "./constants";

export async function updateResults(result: AstResult,context:vscode.ExtensionContext, comment:string):Promise<boolean> {
	let r = true;
	let resultHash="";
	const resultJsonPath = getResultsFilePath();
	if (fs.existsSync(resultJsonPath) && result) {
		// Read local results from JSON file
		const jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, "utf-8"));
		if(TYPES[result.type]==='sast'){
			resultHash = result.data.resultHash;
		}
		if(TYPES[result.type]==='kics'){
			resultHash = result.kicsNode!.id;
		}
		if(TYPES[result.type]==='sca'){
			resultHash = result.scaNode!.id;
		}
		// Search for the changed result in the result list
		jsonResults.results.forEach((element: AstResult|any, index: number) => {
			// Update the resul in the array
			if(element.data.resultHash === resultHash || element.id === resultHash) {
				jsonResults.results[index] = result;
			}
		});
		// Update the result in the local version
		try {
			fs.writeFileSync(resultJsonPath, JSON.stringify(jsonResults));
		} catch (error) {
			r = false;
		}
		// Update the result in ast
		let projectId = get(context,PROJECT_ID_KEY)?.id;
		let update = await triageUpdate(projectId?projectId:"",result.similarityId,TYPES[result.type],result.state,comment,result.severity);
		if(update!==0){r=false;}
	}
	return r;
}