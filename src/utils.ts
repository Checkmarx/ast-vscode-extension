import { CxAuth } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxAuth";
import { CxScanConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScanConfig";
import * as vscode from "vscode";
import { BRANCH_ID_KEY, PROJECT_ID_KEY, SCAN_ID_KEY } from "./constants";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScan";

export function getProperty(o: any, propertyName: string): string {
    return o[propertyName];
}

export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export function updateProjectId(context: vscode.ExtensionContext, projectId: string) {
	context.globalState.update(PROJECT_ID_KEY, projectId);
}
export function getProjectId(context: vscode.ExtensionContext): string {
	return context.globalState.get(PROJECT_ID_KEY)!; //need to add wrapper
}

export function updateBranchId(context: vscode.ExtensionContext, projectId: string) {
	context.globalState.update(BRANCH_ID_KEY, projectId);
}
export function getBranchId(context: vscode.ExtensionContext): string{
	return context.globalState.get(BRANCH_ID_KEY)!; //need to add wrapper
}

export function updateScanId(context: vscode.ExtensionContext, projectId: string) {
	context.globalState.update(SCAN_ID_KEY, projectId);
}
export function getScanId(context: vscode.ExtensionContext): string{
	return context.globalState.get(SCAN_ID_KEY)!; //need to add wrapper
}

export async function getResults(scanId: string) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxAuth(config);
	await cx.getResults(scanId, "json", "ast-results", __dirname);
}

export async function getProjectList() {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxAuth(config);
	cx.apiKey = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
	// Add auth validation and update tyo new wrapper so there is no limit
	let projects = await cx.projectList();
	return projects.scanObjectList;
}

export async function getBranches(projectId: string | undefined) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}

	return ["master", "main", "projectId"];
}

export async function getScans(projectId: string | undefined, branch: string | undefined) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}

	return ["d1fae2c8-b433-4d83-b8d5-1627e27edadf", "d1fae2c8-b433-4d83-b8d5-1627e27edadf", "b521fd66-4bbf-43d7-b495-1f907a17009a"];
}

export function getAstConfiguration() {
	const baseURI = vscode.workspace.getConfiguration("checkmarxAST").get("base-uri") as string;
	const tenant = vscode.workspace.getConfiguration("checkmarxAST").get("tenant") as string;
	const token = vscode.workspace.getConfiguration("checkmarxAST").get("apiKey") as string;
	
	if (!baseURI || !tenant || !token) {
		return undefined;
	}
	
	const config = new CxScanConfig();
	config.apiKey = token;
	config.baseUri = baseURI;
	config.tenant = tenant;
	return config;
}