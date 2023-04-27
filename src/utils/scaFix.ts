import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { Cx } from "../cx/cx";
import * as path from "path";

// Applying sca Fix to a specific package
export async function applyScaFix(packages:string,packageFile:string,version:string,logs:Logs){
	const cx =  new Cx();
	if(packageFile.length === 0 || version.length === 0) {
		logs.info("No available upgrade for package " + packages);
	}
	else{
		try {
			logs.info("Upgrading " + packages + " to version " + version);
			const filePackageObjectList =  vscode.workspace.workspaceFolders;
			if(filePackageObjectList.length>0) {
				await cx.scaRemediation(path.join(filePackageObjectList[0].uri.fsPath,packageFile),packages,version);
				logs.info("Package "+ packages + " successfully upgraded to version " + version);
				vscode.window.showInformationMessage("Package "+ packages + " successfully upgraded to version " + version);
			}
			else {
				logs.error("No folder is opened. Please open the folder for the current project.");
				vscode.window.showErrorMessage("No folder is opened. Please open the folder for the current project.");
			}
		} catch (error) {
			logs.error(error);
		}
	}
}