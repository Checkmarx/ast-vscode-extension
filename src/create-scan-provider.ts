import { Logs } from "./models/logs";
import * as vscode from "vscode";
import * as fs from "fs";
import {getResultsFilePath} from "./utils/utils";
import {BRANCH_ID_KEY, PROJECT_ID_KEY, SCAN_CREATE_ID_KEY} from "./utils/constants";
import { Item, update } from "./utils/globalState";
import { AstResult } from "./models/results";
import {getScan, scanCreate} from "./utils/ast";
import {GitExtension} from "./types/git";

const SCAN_WAITING = "$(sync~spin) Checkmarx - waiting for scan to complete";
const SCAN_CREATED = "$(check) Checkmarx Scan";



function getBranchFromWorkspace() {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
    const gitApi = gitExtension.getAPI(1);
    const state = gitApi.repositories[0]?.state;
    return state.HEAD?.name;
}

function updateStatusBarItem(text: string, show: boolean, statusBarItem: vscode.StatusBarItem){
  statusBarItem.text = text;
  show? statusBarItem.show() : statusBarItem.hide();
}



export async function pollForScanResult(context: vscode.ExtensionContext,scanId: string,logs: Logs, statusBarItem: vscode.StatusBarItem) {
        let scanResult = await getScan(scanId);
        if (scanResult.status.toLowerCase() === "running") {
            logs.info("Scan not finished yet for scan ID: " + scanId);
            updateStatusBarItem(SCAN_WAITING, true, statusBarItem);
            await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, true);
        } else {
            logs.info("Scan finished for scan ID: " + scanId + " with status: " + scanResult.status);
            await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, false);
            update(context, SCAN_CREATE_ID_KEY, {id:undefined,name:""});
            updateStatusBarItem(SCAN_CREATED, false, statusBarItem);
        }
}

async function createScanForProject(context: vscode.ExtensionContext, logs: Logs, branch: string, statusBarItem: vscode.StatusBarItem) {
  await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, true);
  let projectForScan:any = context.workspaceState.get(PROJECT_ID_KEY);
  let projectName = projectForScan.name.split(":")[1].trim();
  let workspaceFolder = vscode.workspace.workspaceFolders[0];
  logs.info("Initiating scan for workspace Folder: " +	workspaceFolder.uri.fsPath);
  const scanCreateResponse = await scanCreate(projectName, branch,workspaceFolder.uri.fsPath);
  logs.info("Scan created successfully. ID: " + scanCreateResponse.id);
  update(context, SCAN_CREATE_ID_KEY, { id: scanCreateResponse.id, name: scanCreateResponse.id });
  await vscode.commands.executeCommand(`ast-results.isScanRunning`);
}

export async function cancelScan(context: vscode.ExtensionContext, logs: Logs, createScanStatusBarItem: vscode.StatusBarItem) {
  logs.info("Triggering the cancel scan flow");
}




export async function createScan(context: vscode.ExtensionContext, logs: Logs, createScanStatusBarItem: vscode.StatusBarItem) {
  // step 1 -> check if the files in results are there in the current workspaceFolders
  await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, true);
  let filesExistInResults =  await findFilesInWorkspaceAndResults();
  let shouldCreateScan: boolean = false
    let branchInWorkspace = getBranchFromWorkspace();
    let branchInCxView:Item = context.workspaceState.get(BRANCH_ID_KEY);
  if(filesExistInResults) {
      // step 2 -> check the branch in workspace and plugin view match
      if(branchInWorkspace === branchInCxView.id) {
        shouldCreateScan = true;
      } else {
          logs.info("Branch in workspace and plugin view do not match");
            let msg = "Branch in workspace and plugin view do not match. Do you want to continue?";
            let continueScan = await getUserInput(msg);
            if(continueScan) {
              shouldCreateScan = true;
            }
      }
  } else{
      let continueScan = await getUserInput("No matching files found in workspace and results. Do you want to continue with the scan?");
        if(continueScan) {
          shouldCreateScan = true;
        }
  }
    if(shouldCreateScan) {
        await createScanForProject(context, logs, branchInCxView.id, createScanStatusBarItem);
    }
}

 function getUserInput(msg: string){
    return new Promise((resolve) => {
        vscode.window.showInformationMessage(msg, "Yes", "No").then(async (value) => {
            if(value === "Yes") {
                resolve(true);
            } else {
                await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, false);
                resolve(false);
            }
        });
    }   );
}

async function findFilesInWorkspaceAndResults(){
 const resultJsonPath = getResultsFilePath();
 if (fs.existsSync(resultJsonPath)){
  const jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, "utf-8").replace(/:([0-9]{15,}),/g, ':"$1",'));
  const resultFileNames =  extractFileNamesFromResults(jsonResults.results);
		return doFilesExistInWorkspace(resultFileNames);
 } else{
  await vscode.window.showInformationMessage("Failed creating scan: Not able to retrieve results");
 }
}

async function doFilesExistInWorkspace(resultFileNames: any[]) {
  for (const fileName of resultFileNames) {
    const fileExists = await vscode.workspace.findFiles("**/*" + fileName);
    if (fileExists.length > 0) {
      return true;
    }
  }
  return false;
}

function extractFileNamesFromResults(results: any) {
const filenames = [];
   results.forEach((result) => {
     const astResult = new AstResult(result);
     filenames.push(astResult.fileName);
   });
   return filenames;
}
