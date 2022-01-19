import * as vscode from "vscode";
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxPredicate from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/predicates/CxPredicate";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import { ERROR_MESSAGE, RESULTS_FILE_EXTENSION, RESULTS_FILE_NAME } from "./constants";
import { getFilePath } from "./utils";

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
	const baseURI = vscode.workspace.getConfiguration("checkmarxAST").get("base-uri") as string;
	const tenant = vscode.workspace.getConfiguration("checkmarxAST").get("tenant") as string;
	const token = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
	
	if (!baseURI || !tenant || !token) {
		return undefined;
	}
	
	const config = new CxConfig();
	config.apiKey = token;
	config.baseUri = baseURI;
	config.tenant = tenant;
	return config;
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
	const scans = await cx.triageUpdate(projectId,similarityId,scanType,state,comment,severity);
	if(scans.exitCode===0){
		r = scans.exitCode;
	}
	else{
		throw new Error(scans.status);
	}
	return r;
}