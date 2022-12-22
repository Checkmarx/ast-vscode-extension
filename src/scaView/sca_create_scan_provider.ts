import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { scanCancel, scaScanCreate, updateStatusBarItem } from "../utils/ast/ast";
import { SCAN_CANCEL, SCAN_CREATE, SCAN_CREATE_ID_KEY, SCA_SCAN_WAITING } from "../utils/common/constants";
import { get, update } from "../utils/common/globalState";
import { SCAResultsProvider } from "./sca_results_provider";

async function createScanForProject(context: vscode.ExtensionContext, logs: Logs) {
    let workspaceFolder = vscode.workspace.workspaceFolders[0];
	let scanCreateResponse;
    logs.info("Initiating scan for workspace Folder: " + workspaceFolder.uri.fsPath);
	try {
		scanCreateResponse = await scaScanCreate(workspaceFolder.uri.fsPath);	
	} catch (error) {
		logs.error(error);
	}
	return scanCreateResponse;
}

export async function cancelScan(context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem, logs: Logs) {
    logs.info("Triggering the cancel scan flow");
    updateStatusBarItem(SCAN_CANCEL, true, statusBarItem);

    const scan = get(context, SCAN_CREATE_ID_KEY);
    if(scan && scan.id){
        const response = await scanCancel(scan.id);
        logs.info("scan cancel instruction sent for ID: " + scan.id + " :" + response);
        update(context, SCAN_CREATE_ID_KEY, undefined);
    }
    updateStatusBarItem(SCAN_CANCEL, false, statusBarItem);
}


export async function createSCAScan(context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem, logs: Logs,scaResultsProvider:SCAResultsProvider) {
    updateStatusBarItem(SCA_SCAN_WAITING, true, statusBarItem);
	logs.info("Checking if scan can be started...");
	// Check if there is a folder opened
	const files  = await vscode.workspace.findFiles("*", undefined, 10);
	// if it does not then show error log in output
    if (files.length === 0) {
		logs.error("No files found in workspace. Please open a workspace or folder to be able to start an SCA scan.");
        vscode.window.showInformationMessage("No files found in workspace. Please open a workspace or folder to be able to start an SCA scan.");
		updateStatusBarItem("$(debug-disconnect) Checkmarx sca", true, statusBarItem);
    }
	// if there is then start the scan and pool for it
	else{
		createScanForProject(context,logs).then( async (scaResults) =>{
			scaResultsProvider.scaResults=scaResults;
			scaResultsProvider.refreshData();
			logs.info("Scan completed successfully, results loaded into the SCA tree");
		}).catch(err=>{
			updateStatusBarItem("$(debug-disconnect) Checkmarx sca", true, statusBarItem);
			logs.error("Scan did not complete :"+err);
		});
		updateStatusBarItem("$(check) Checkmarx sca", true, statusBarItem);
	}

}
