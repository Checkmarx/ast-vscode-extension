import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { GitExtension, RepositoryState } from "../types/git";
import { REFRESH_TREE } from "./commands";
import { BRANCH_ID_KEY, BRANCH_LABEL, BRANCH_TEMP_ID_KEY, PROJECT_ID_KEY, SCAN_ID_KEY, SCAN_LABEL } from "./constants";
import { get, update } from "./globalState";
import { getBranches } from "./ast";

export async function getBranchListener(context: vscode.ExtensionContext, logs: Logs) {
	const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
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
		logs.info(`Repo change: New branch ${branchName} | Existing branch ${currentBranch?.id} | Project ${projectItem?.id}`);
		
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