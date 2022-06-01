import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { GitExtension, RepositoryState } from "../types/git";
import { REFRESH_TREE } from "./commands";
import { BRANCH_ID_KEY, BRANCH_LABEL, BRANCH_TEMP_ID_KEY, KICS_REALTIME_FILE, PROJECT_ID_KEY, SCAN_ID_KEY, SCAN_LABEL } from "./constants";
import { get, update } from "./globalState";
import { getBranches } from "./ast";

export async function getBranchListener(context: vscode.ExtensionContext, logs: Logs) {
	const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;

	if(gitExtension.enabled){
		const gitApi = gitExtension.getAPI(1);
		const state = gitApi.repositories[0]?.state;
		if (state) {
			return addRepositoryListener(context, logs, state);
		} else {
			return gitApi.onDidOpenRepository(async() => {
				logs.info('GIT API - Open repository');
				const repoState = gitApi.repositories[0].state;
				return addRepositoryListener(context, logs, repoState);
			});
		}
	} else {
		logs.error("Could not find active git extension in workspace");
		return Promise.reject();
	}
}

async function addRepositoryListener(context: vscode.ExtensionContext, logs: Logs, repoState: RepositoryState) {
	return repoState.onDidChange(() => {
		const tempBranchName = get(context, BRANCH_TEMP_ID_KEY);
		const branchName = repoState.HEAD?.name;
		if (!branchName || (tempBranchName && tempBranchName.id === branchName)) {
			return;
		}
		
		update(context, BRANCH_TEMP_ID_KEY, {id: branchName, name: branchName}); //TODO: This is an hack to fix duplicated onchange calls when branch is changed.
		
		const projectItem = get(context, PROJECT_ID_KEY);
		const currentBranch = get(context, BRANCH_ID_KEY);
		//logs.info(`Repo change: New branch ${branchName} | Existing branch ${currentBranch?.id} | Project ${projectItem?.id}`);
		
		if (projectItem?.id && branchName && branchName !== currentBranch?.id) {
			getBranches(projectItem.id).then((branches) => {
				update(context, BRANCH_TEMP_ID_KEY, undefined);
				if (branches?.includes(branchName)) {
					update(context, BRANCH_ID_KEY, { id: branchName, name: `${BRANCH_LABEL} ${branchName}` });
					update(context, SCAN_ID_KEY, { id: undefined, name: SCAN_LABEL });
					vscode.commands.executeCommand(REFRESH_TREE);
				}
			});
		} else {
			update(context, BRANCH_TEMP_ID_KEY, undefined);
		}
	});
}

export function addRealTimeSaveListener(context: vscode.ExtensionContext,logs: Logs, kicsStatusBarItem:vscode.StatusBarItem) {
	
	vscode.workspace.onDidSaveTextDocument(async (e) => {
		// Check if on save setting is enabled
		if(!e.fileName.includes("settings.json")){
			const onSave = vscode.workspace.getConfiguration("CheckmarxKICS").get("Activate KICS Auto Scanning") as boolean;
			if(onSave){
				// Check if saved file is within the project
				logs.info("File saved updating kics results");
				// Send the current file to the global state, to be used in the command
				update(context, KICS_REALTIME_FILE, { id: e.uri.fsPath, name: e.uri.fsPath });
				await vscode.commands.executeCommand(
					"ast-results.kicsRealtime"
				);
			}
		}
	});
}