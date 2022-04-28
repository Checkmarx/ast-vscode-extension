import * as path from 'path';
import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { AstResult } from '../models/results';
import { get, updateError } from "../utils/globalState";
import { getBranches, getProject, getProjectList, getResults, getScan, getScans, triageShow } from "./ast";
import { getBfl } from './bfl';
import { SHOW_ERROR } from './commands';
import { ERROR_MESSAGE, PROJECT_ID_KEY, RESULTS_FILE_EXTENSION, RESULTS_FILE_NAME, SCAN_ID_KEY } from "./constants";

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

export async function getBranchPickItems(logs: Logs, projectId: string, context: vscode.ExtensionContext) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			progress.report({ message: "Loading branches" });
			const branchList = await getBranches(projectId);
			try {
				return branchList ? branchList.map((label) => ({
					label: label,
					id: label,
				})) : [];
			} catch (error) {
				updateError(context, ERROR_MESSAGE + error);
				vscode.commands.executeCommand(SHOW_ERROR);
				return [];
			}
		}
	);
}

export async function getProjectsPickItems(logs: Logs, context: vscode.ExtensionContext) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			progress.report({ message: "Loading projects" });
			try {
				const projectList = await getProjectList();
				return projectList ? projectList.map((label) => ({
					label: label.name,
					id: label.id,
				})) : [];
			} catch (error) {
				updateError(context, ERROR_MESSAGE + error);
				vscode.commands.executeCommand(SHOW_ERROR);
				return [];
			}
		}

	);
}

export async function getScansPickItems(logs: Logs, projectId: string, branchName: string, context: vscode.ExtensionContext) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			progress.report({ message: "Loading scans" });
			const scanList = await getScans(
				projectId,
				branchName
			);
			try {
				return scanList ? scanList.map((label) => ({
					label: label === scanList[0] ? getScanLabel(label.createdAt,label.id) + " (latest)" : getScanLabel(label.createdAt,label.id),
					id: label.id,
				})) : [];
			} catch (error) {
				updateError(context, ERROR_MESSAGE + error);
				vscode.commands.executeCommand(SHOW_ERROR);
				return [];
			}
		}
	);
}

export async function getResultsWithProgress(logs: Logs, scanId: string) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			progress.report({ message: "Loading results" });
			await getResults(scanId);
		}
	);
}

export async function getScanWithProgress(logs: Logs, scanId: string) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			progress.report({ message: "Loading scan" });
			return await getScan(scanId);
		}
	);
}

export async function getProjectWithProgress(logs: Logs, projectId: string) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			progress.report({ message: "Loading project" });
			return await getProject(projectId);
		}
	);
}

export async function getBranchesWithProgress(logs: Logs, projectId: string) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			progress.report({ message: "Loading branches" });
			return await getBranches(projectId);
		}
	);
}

export async function getChanges(logs: Logs, context: vscode.ExtensionContext, result: AstResult, detailsPanel: vscode.WebviewPanel) {
	let projectId = get(context, PROJECT_ID_KEY)?.id;
	triageShow(projectId!, result.similarityId, result.type).then((changes) => {
		detailsPanel?.webview.postMessage({ command: "loadChanges", changes });
	}).catch((err) => {
		detailsPanel?.webview.postMessage({ command: "loadChanges", changes: []});
		logs.log("ERROR", err);
	});
}

export async function getResultsBfl(logs: Logs, context: vscode.ExtensionContext, result: AstResult, detailsPanel: vscode.WebviewPanel) {
	let scanId = get(context, SCAN_ID_KEY)?.id;
	const cxPath = vscode.Uri.joinPath(context.extensionUri,  path.join("media", "icon.png"));
	getBfl(scanId!, result.queryId, result.sastNodes,logs).then((index) => {
		detailsPanel?.webview.postMessage({ command: "loadBfl", index: {index:index,logo:cxPath} });
	}).catch(() => {
		detailsPanel?.webview.postMessage({ command: "loadBfl", index:{index:-1,logo:cxPath} });
	});
}

export const PROGRESS_HEADER: vscode.ProgressOptions = {
	location: vscode.ProgressLocation.Notification,
	title: "Checkmarx",
	cancellable: true,
};

export function getFilePath() {
	return __dirname;
}

export function getResultsFilePath() {
	return path.join(getFilePath(), `${RESULTS_FILE_NAME}.${RESULTS_FILE_EXTENSION}`);
}

type CounterKey = string | boolean | number;

interface CounterKeyFunc<T> {
	(item: T): CounterKey;
}

export class Counter<T> extends Map<CounterKey, number> {
	key: CounterKeyFunc<T>;

	constructor(items: Iterable<T>, key: CounterKeyFunc<T>) {
		super();
		this.key = key;
		for (let it of items) {
			this.add(it);
		}
	}

	add(it: T) {
		let k = this.key(it);
		this.set(k, (this.get(k) || 0) + 1);
	}
}

function getScanLabel(createdAt: string, id: string) {
	var date = new Date(createdAt).toLocaleString();
	var label = date.split(",");
	return label[0] + " " + id + " " + label[1];
}

