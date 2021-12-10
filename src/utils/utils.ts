import * as path from 'path';
import * as vscode from "vscode";
import { Logs } from "../models/logs";

import { getBranches, getProject, getProjectList, getResults, getScan, getScans } from "./ast";
import { RESULTS_FILE_EXTENSION, RESULTS_FILE_NAME} from "./constants";

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

export async function getBranchPickItems(logs: Logs, projectId: string) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			progress.report({ message: "Loading branches" });
			const branches = await getBranches(projectId);
			return branches ? branches.map((label) => ({
				label: label,
				id: label,
			})) : [];
		}
	  );
}

export async function getProjectsPickItems(logs: Logs) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
		  	progress.report({ message: "Loading projects" });
		  	const projectList = await getProjectList();
	  		return projectList ? projectList.map((label) => ({
				label: label.Name,
				id: label.ID,
			})) : [];
		}
	  );
}

export async function getScansPickItems(logs: Logs, projectId: string, branchName: string) {
	return vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
		  	progress.report({ message: "Loading scans" });
			const scans = await getScans(
				projectId,
				branchName
			);
	  		return scans ? scans.map((label) => ({
				label: convertDate(label.CreatedAt),
				id: label.ID,
			})) : [];
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

