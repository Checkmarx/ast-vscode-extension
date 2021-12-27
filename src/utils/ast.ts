import * as vscode from "vscode";
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import { RESULTS_FILE_EXTENSION, RESULTS_FILE_NAME } from "./constants";
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
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	const projects = await cx.projectList("limit=10000");
	return projects.payload;
}

export async function getBranches(projectId: string | undefined) : Promise<string[] | undefined> {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const cx = new CxWrapper(config);
	const branches = await cx.projectBranches(projectId!, "");
	return branches.payload;
}

export async function getScans(projectId: string | undefined, branch: string | undefined): Promise<CxScan[] | undefined> {
	const config = getAstConfiguration();
	if (!config) {
		return [];
	}
	const filter = `project-id=${projectId},branch=${branch},limit=10000,statuses=Completed`;
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