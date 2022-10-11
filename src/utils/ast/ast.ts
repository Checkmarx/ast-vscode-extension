import * as vscode from "vscode";
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxCodeBashing from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/codebashing/CxCodeBashing";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import {
	EXTENSION_NAME,
	RESULTS_FILE_EXTENSION,
	RESULTS_FILE_NAME, SCAN_CREATE_ADDITIONAL_PARAMETERS,
	SCAN_CREATE_ID_KEY, SCAN_POLL_TIMEOUT,
	SCAN_WAITING
} from "../common/constants";
import {disableButton, enableButton, getFilePath} from "../utils";
import { SastNode } from "../../models/sastNode";
import AstError from "../../exceptions/AstError";
import {CxParamType} from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxParamType";
import {Item} from "../common/globalState";
import {Logs} from "../../models/logs";
import {pollForScanResult} from "../../create_scan_provider";


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
	params.set(CxParamType.ADDITIONAL_PARAMETERS,SCAN_CREATE_ADDITIONAL_PARAMETERS);
	const scan = await cx.scanCreate(params);
	return scan.payload[0];
}

export async function scanCancel(scanId: string) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	if(!scanId){
		return;
	}
	const cx = new CxWrapper(config);
	const scan = await cx.scanCancel(scanId);
	return scan.exitCode === 0 ;
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
	return scan.payload[0];
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
	const token = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
	
	if (!token) {
		return undefined;
	}
	
	const config = new CxConfig();
	config.apiKey = token;
	return config;
}

export async function isScanEnabled(logs:Logs) :Promise<boolean>{
	let enabled = false;
	const apiKey = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
	if (!apiKey) {
		return enabled;
	}
	const config = new CxConfig();
	config.apiKey = apiKey;
	const cx = new CxWrapper(config);
	try {
		enabled = await cx.ideScansEnabled();
		let mesage=enabled?"Scans enabled from IDE":"Scans from IDE are not enabled for you tenant";
		logs.info(mesage);
	} catch (error) {
		logs.error(error);
		return enabled;
	}
	return enabled;
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

export async function scaRemediation(packageFile: string, packages:string, packageVersion:string) {
	const config = getAstConfiguration();
	if (!config) {
		throw new Error("Configuration error");
	}
	const cx = new CxWrapper(config);
	const scaFix = await cx.scaRemediation(packageFile,packages,packageVersion);
	if(scaFix.exitCode === 0){
		return scaFix.exitCode;
	}
	else {
		throw new Error(scaFix.status.replaceAll("\n","")); //Need to return exit code
	}
}

export async function kicsRemediation(resultsFile:string, kicsFile:string,engine:string,similarityIds?:string ) :Promise <any>{
	
	if (!resultsFile) {
		throw new Error("Missing mandatory parameters, resultsFile");
	}
	if (!kicsFile) {
		throw new Error("Missing mandatory parameters, kicsFile");
	}
	const cx = new CxWrapper(new CxConfig());
	let [kics,process]=[undefined,undefined];
	try{
		[kics,process] = await cx.kicsRemediation(resultsFile,kicsFile,engine,similarityIds);
	}catch(e){
		throw new Error("Error running kics remediation");
	}
	return [kics,process];

}

export async function learnMore(queryID: string) : Promise<any[] | undefined>{
	let r=[];
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	const scans = await cx.learnMore(queryID);
	if(scans.payload && scans.exitCode===0){
		r = scans.payload;
	}
	else{
		throw new Error(scans.status);
	}
	return r;
}

export async function isScanRunning(context: vscode.ExtensionContext, createScanStatusBarItem: vscode.StatusBarItem) {
	const scanId : Item = context.workspaceState.get(SCAN_CREATE_ID_KEY);
	if(scanId && scanId.id){
		await disableButton(`${EXTENSION_NAME}.createScanButton`);
		await enableButton(`${EXTENSION_NAME}.cancelScanButton`);
		updateStatusBarItem(SCAN_WAITING, true, createScanStatusBarItem);
		return true;
	} else {
		await disableButton(`${EXTENSION_NAME}.cancelScanButton`);
		await enableButton(`${EXTENSION_NAME}.createScanButton`);
		updateStatusBarItem(SCAN_WAITING, false, createScanStatusBarItem);
		return false;
	}
}

export async function isCreateScanEligible(logs:Logs){
// call wrapper to get the information about the flag.
// returning false to mock the button
// Must save the value in workspace state and check when settings are saved as well
logs.info("Checking if scan is eligible")
return true;
}

export async function pollForScan(context: vscode.ExtensionContext,logs: Logs, createScanStatusBarItem: vscode.StatusBarItem){
	return new Promise<void>((resolve) => {
		let i = setInterval(async () => {
			let scanRunning = await isScanRunning(context, createScanStatusBarItem);
			if (scanRunning) {
				const scanId : Item = context.workspaceState.get(SCAN_CREATE_ID_KEY);
				await pollForScanResult(context,scanId.id,logs);
				resolve();
			} else{
				clearInterval(i);
			}
		},SCAN_POLL_TIMEOUT);
	});
}


export  function updateStatusBarItem(text: string, show: boolean, statusBarItem: vscode.StatusBarItem){
	statusBarItem.text = text;
	show? statusBarItem.show() : statusBarItem.hide();
}