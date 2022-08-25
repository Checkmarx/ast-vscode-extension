import * as vscode from "vscode";
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxCodeBashing from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/codebashing/CxCodeBashing";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import {
	BRANCH_ID_KEY,
	EXTENSION_NAME,
	RESULTS_FILE_EXTENSION,
	RESULTS_FILE_NAME,
	SCAN_CREATE_ID_KEY, SCAN_POLL_TIMEOUT
} from "./constants";
import { getFilePath } from "./utils";
import { SastNode } from "../models/sastNode";
import AstError from "../exceptions/AstError";
import { CxParamType } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxParamType";
import {Logs} from "../models/logs";
import {pollForScanResult} from "../create-scan-provider";
import {Item} from "./globalState";

export async function scanCreate(projectName: string, branchName: string, sourcePath: string) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	if(!projectName){
		return;
	}
	if(!branchName){
		return;
	}
	const cx = new CxWrapper(config);
	let params = new Map<CxParamType,string>();
	params.set(CxParamType.S,sourcePath);
	params.set(CxParamType.BRANCH,branchName);
	params.set(CxParamType.PROJECT_NAME,projectName);
	params.set(CxParamType.ADDITIONAL_PARAMETERS,"--async --sast-incremental");
	const scan = await cx.scanCreate(params);
	return scan.payload[0];
}


export async function getResults(scanId: string| undefined) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	if (!scanId) {return;}
	const cx = new CxWrapper(config);
	await cx.getResults(scanId, RESULTS_FILE_EXTENSION, RESULTS_FILE_NAME, getFilePath());
}

export async function getScan(scanId: string| undefined): Promise<CxScan | undefined> {
	const config = getAstConfiguration();
	if (!config) {
		return undefined;
	}
	if (!scanId) {return;}
	const cx = new CxWrapper(config);
	const scan = await cx.scanShow(scanId);
	return scan.exitCode === 1 ? undefined: scan.payload[0];
}

export async function getProject(projectId: string| undefined): Promise<CxProject | undefined> {
	const config = getAstConfiguration();
	if (!config) {
		return undefined;
	}
	if (!projectId) {return;}
	const cx = new CxWrapper(config);
	const project = await cx.projectShow(projectId);
	return project.payload[0];
}

export async function getProjectList(): Promise<CxProject[] | undefined> {
	let r = [];
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	const projects = await cx.projectList("limit=10000");
	
	if(projects.payload){
		r = projects.payload;
	}
	else{
		throw new Error(projects.status);		
	}
	return r;
}

export async function getBranches(projectId: string | undefined) : Promise<string[] | undefined> {
	let r = [];
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	const branches = await cx.projectBranches(projectId!, "");
	if(branches.payload){
		r = branches.payload;
	}
	else{
		throw new Error(branches.status);	
	}
	return r;
}

export async function getScans(projectId: string | undefined, branch: string | undefined): Promise<CxScan[] | undefined> {
	let r = [];
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const filter = `project-id=${projectId},branch=${branch},limit=10000,statuses=Completed`;
	const cx = new CxWrapper(config);
	const scans = await cx.scanList(filter);
	if(scans.payload){
		r = scans.payload;
	}
	else{
		throw new Error(scans.status);
	}
	return r;
}

export function getAstConfiguration() {
	const baseURI = vscode.workspace.getConfiguration("checkmarxAST").get("baseUri") as string;
	const baseAuthURI = vscode.workspace.getConfiguration("checkmarxAST").get("baseAuthUri") as string;
	const tenant = vscode.workspace.getConfiguration("checkmarxAST").get("tenant") as string;
	const token = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
	
	if (!baseURI || !tenant || !token) {
		return undefined;
	}
	
	const config = new CxConfig();
	config.apiKey = token;
	config.baseUri = baseURI;
	config.baseAuthUri = baseAuthURI;
	config.tenant = tenant;
	return config;
}

// export async function getScanRunningStatus(context: vscode.ExtensionContext, logs: Logs, createScanStatusBarItem: vscode.StatusBarItem) {
// 	const scanId: Item = context.workspaceState.get(SCAN_CREATE_ID_KEY);
// 	if (scanId) {
// 		vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isScanRunning`, true);
// 		await pollForScanResult(context,logs, createScanStatusBarItem);
// 	} else {
// 		vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isScanRunning`, false);
// 	}
// }

export async function getScanRunningStatus(context: vscode.ExtensionContext, logs: Logs, createScanStatusBarItem: vscode.StatusBarItem) {
	
	return new Promise<void>((resolve) => {
		let i = setInterval(async () => {
		const scanId: Item = context.workspaceState.get(SCAN_CREATE_ID_KEY);
			if (scanId.id ) {
				await pollForScanResult(context,scanId.id,logs, createScanStatusBarItem);
				resolve();
			} else{
				clearInterval(i);
			}
		},SCAN_POLL_TIMEOUT);
	});
}

export async function triageShow(projectId: string,similarityId: string,scanType: string) : Promise<any[] | undefined>{
	let r=[];
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	const scans = await cx.triageShow(projectId,similarityId,scanType);
	if(scans.payload && scans.exitCode===0){
		r = scans.payload;
	}
	else{
		throw new Error(scans.status);
	}
	return r;
}

export async function triageUpdate(projectId: string,similarityId: string,scanType: string,state: string,comment: string,severity: string):Promise<number> {
	let r:number = -1;
	const config = getAstConfiguration();
	if (!config) {
		return r;
	}
	const cx = new CxWrapper(config);
	const triage = await cx.triageUpdate(projectId,similarityId,scanType,state,comment,severity);
	if(triage.exitCode===0){
		r = triage.exitCode;
	}
	else{
		throw new Error(triage.status); //New to return exit code
	}
	return r;
}

export async function getCodeBashing(cweId: string, language:string, queryName:string): Promise<CxCodeBashing | undefined> {
	const config = getAstConfiguration();
	if (!config) {
		throw new Error("Configuration error");
	}
	if (!cweId || !language || !queryName) {
		throw new Error("Missing mandatory parameters, cweId, language or queryName ");
	}
	const cx = new CxWrapper(config);
	const codebashing = await cx.codeBashingList(cweId.toString(),language,queryName.replaceAll("_"," "));
	if(codebashing.exitCode === 0){
		return codebashing.payload[0];
	}
	else{
		throw new AstError(codebashing.exitCode, codebashing.status);
	}
}

export async function getResultsBfl(scanId:string, queryId:string,resultNodes:SastNode[]){
	const config = getAstConfiguration();
	if (!config) {
		throw new Error("Configuration error");
	}
	if (!scanId || !queryId || !resultNodes) {
		throw new Error("Missing mandatory parameters, scanId, queryId or resultNodes ");
	}
	const cx = new CxWrapper(config);
	const bfl = await cx.getResultsBfl(scanId.toString(),queryId.toString(),resultNodes);
	if(bfl.exitCode === 0){
		return bfl.payload[0];
	}
	else {
		throw new Error(bfl.status); //Need to return exit code
	}
}

export async function getResultsRealtime(fileSources:string, additionalParams:string) :Promise <any>{
	
	if (!fileSources) {
		throw new Error("Missing mandatory parameters, fileSources");
	}
	const cx = new CxWrapper(new CxConfig());
	let [kics,process]=[undefined,undefined];
	try{
		[kics,process] = await cx.kicsRealtimeScan(fileSources,"",additionalParams);
	}catch(e){
		throw new Error("Error running kics scan");
	}
	return [kics,process];

}