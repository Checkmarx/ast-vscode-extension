
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import CxProject from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/project/CxProject";

import * as vscode from "vscode";
import { BRANCH_ID_KEY, PROJECT_ID_KEY, SCAN_ID_KEY } from "./constants";

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

export function updateProjectId(context: vscode.ExtensionContext, projectId: Item) {
	context.globalState.update(PROJECT_ID_KEY, projectId);
}
export function getProjectId(context: vscode.ExtensionContext): Item {
	return context.globalState.get(PROJECT_ID_KEY)!; //need to change
}

export function updateBranchId(context: vscode.ExtensionContext, projectId: Item) {
	context.globalState.update(BRANCH_ID_KEY, projectId);
}
export function getBranchId(context: vscode.ExtensionContext): Item{
	return context.globalState.get(BRANCH_ID_KEY)!; //need to change
}

export function updateScanId(context: vscode.ExtensionContext, projectId: Item) {
	context.globalState.update(SCAN_ID_KEY, projectId);
}
export function getScanId(context: vscode.ExtensionContext): Item{
	return context.globalState.get(SCAN_ID_KEY)!; //need to change
}

export async function getResults(scanId: string) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	await cx.getResults(scanId, "json", "ast-results", __dirname);
}

export async function getProjectList() {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	// Add auth validation and update tyo new wrapper so there is no limit
	//const projects = await cx.projectList("limit=10000");
	//return projects.payload;
	var project = new CxProject();
	project.ID="56aed693-aa6b-494f-91d0-77350447b242";
	project.Name="webgoat";
	return [project];
}

export async function getBranches(projectId: string | undefined) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	const branches = await cx.projectBranches(projectId!, "");
	return branches.payload;
}

export async function getScans(projectId: string | undefined, branch: string | undefined) {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const filter = "projectID="+projectId+",branch="+branch;
	const cx = new CxWrapper(config);
	const branches = await cx.scanList(filter);
	return branches.payload;
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

export class Item {

    name!: string;

    id!: string;

}