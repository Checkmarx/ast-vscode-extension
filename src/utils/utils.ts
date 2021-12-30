import * as path from 'path';
import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { updateError} from "../utils/globalState";
import { getBranches, getProject, getProjectList, getResults, getScan, getScans } from "./ast";
import { SHOW_ERROR } from './commands';
import { ERROR_MESSAGE, RESULTS_FILE_EXTENSION, RESULTS_FILE_NAME} from "./constants";

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
			// Validate if there is any output from project list
			if(branchList!.length>0){
				// Validate if there are valid entries
				if(branchList![0] === ERROR_MESSAGE){
					updateError(context,ERROR_MESSAGE + branchList![1]);
					vscode.commands.executeCommand(SHOW_ERROR);
					return [];
				}
				else{
					return branchList ? branchList.map((label) => ({
						label: label,
						id: label,
					})) : [];
				}
			}
			return [];
		}
	  );
}

export async function getProjectsPickItems(logs: Logs,context:vscode.ExtensionContext) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
		  	progress.report({ message: "Loading projects" });
		  	const projectList = await getProjectList();
			// Validate if there is any output from project list
			if(projectList!.length>0){
				// Validate if there are valid entries
				if(projectList![0].name){
					return projectList ? projectList.map((label) => ({
						label: label.name,
						id: label.id,
					})) : [];
				}
				// Validate if there are errors
				else{
					updateError(context,ERROR_MESSAGE + projectList![0] as unknown as string);
					vscode.commands.executeCommand(SHOW_ERROR);
					return [];
				}
			}
			return [];
		}
		
	  );
}

export async function getScansPickItems(logs: Logs, projectId: string, branchName: string, context:vscode.ExtensionContext) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
		  	progress.report({ message: "Loading scans" });
			const scanList = await getScans(
				projectId,
				branchName
			);
			// Validate if there is any output from project list
			if(scanList!.length>0){
				// Validate if there are valid entries
				if(scanList![0].id){
					return scanList ? scanList.map((label) => ({
						label: convertDate(label.createdAt),
						id: label.id,
					})) : [];
				}
				else{
					updateError(context,ERROR_MESSAGE + scanList![0]);
					vscode.commands.executeCommand(SHOW_ERROR);
					return [];
				}
			}
			return [];
		}
	  );
}

export async function getResultsWithProgress(logs: Logs, scanId: string) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
		 	token.onCancellationRequested(() => logs.info("Canceled loading"));
		  	progress.report({ message: "Loading results" });
			await getResults(scanId );
		}
	  );
}

export async function getScanWithProgress(logs: Logs, scanId: string) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
		 	token.onCancellationRequested(() => logs.info("Canceled loading"));
		  	progress.report({ message: "Loading scan" });
			return await getScan(scanId );
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

export const PROGRESS_HEADER: vscode.ProgressOptions = {
	location: vscode.ProgressLocation.Notification,
	title: "Checkmarx",
	cancellable: true,
};

export function convertDate(date: string | undefined) {
	if (!date) {return "";}
	return new Date(date).toLocaleString();
}

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

