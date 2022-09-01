import { Logs } from "./models/logs";
import * as vscode from "vscode";
import * as fs from "fs";
import {getResultsFilePath, getResultsWithProgress, getScanLabel} from "./utils/utils";
import {BRANCH_ID_KEY, PROJECT_ID_KEY, SCAN_CREATE_ID_KEY, SCAN_ID_KEY, SCAN_LABEL} from "./utils/constants";
import { Item, update } from "./utils/globalState";
import { AstResult } from "./models/results";
import {getScan, scanCancel, scanCreate} from "./utils/ast";
import {GitExtension} from "./types/git";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import { REFRESH_TREE } from "./utils/commands";


function getBranchFromWorkspace() {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
    const gitApi = gitExtension.getAPI(1);
    const state = gitApi.repositories[0]?.state;
    return state.HEAD?.name;
}


export async function pollForScanResult(context: vscode.ExtensionContext,scanId: string,logs: Logs) {
        let scanResult = await getScan(scanId);
        if (scanResult.status.toLowerCase() === "running") {
            logs.info("Scan not finished yet for scan ID: " + scanId);
        } else {
            logs.info("Scan finished for scan ID: " + scanId + " with status: " + scanResult.status);
            update(context, SCAN_CREATE_ID_KEY, {id:undefined,name:""});
            await vscode.commands.executeCommand(`ast-results.isScanRunning`);
            await loadLatestResults(context,scanResult,logs);
        }
}

async function createScanForProject(context: vscode.ExtensionContext, logs: Logs) {
      const scanBranch: Item = context.workspaceState.get(BRANCH_ID_KEY);
      const projectForScan: Item = context.workspaceState.get(PROJECT_ID_KEY);
      let projectName = projectForScan.name.split(":")[1].trim();
      let workspaceFolder = vscode.workspace.workspaceFolders[0];
      logs.info("Initiating scan for workspace Folder: " +	workspaceFolder.uri.fsPath);
      const scanCreateResponse = await scanCreate(projectName, scanBranch.id,workspaceFolder.uri.fsPath);
      logs.info("Scan created with ID: " + scanCreateResponse.id);
      update(context, SCAN_CREATE_ID_KEY, { id: scanCreateResponse.id, name: scanCreateResponse.id });
      await vscode.commands.executeCommand(`ast-results.pollForScan`);
}

export async function cancelScan(context: vscode.ExtensionContext, logs: Logs) {
  logs.info("Triggering the cancel scan flow");
  let scan:Item = context.workspaceState.get(SCAN_CREATE_ID_KEY);
  if(scan && scan.id){
    const response = await scanCancel(scan.id);
    logs.info("scan cancel instruction sent for ID: " + scan.id + " :" + response)
  }
}

 async function doesFilesMatch(logs: Logs){
    let filesExistInResults =  await findFilesInWorkspaceAndResults();
    if(filesExistInResults){
        logs.info("Files match workspace")
        return true;
    } else{
        logs.info("Files in workspace dont match files in results");
        return getUserInput("Files in workspace dont match files in results. Do you want to continue?");
    }
}

async function doesBranchMatch(context: vscode.ExtensionContext, logs: Logs){
    const workspaceBranch = getBranchFromWorkspace();
    const scanBranch: Item = context.workspaceState.get(BRANCH_ID_KEY);
    if(workspaceBranch === scanBranch.id){
        logs.info("Branch match the view branch. Initiating scan...")
        return true;
    } else{
        return getUserInput("Branch in workspace doesnt match branch in results. Do you want to continue?");
    }
}

async function isScanCreateEligible(context: vscode.ExtensionContext,logs: Logs){
   return await doesBranchMatch(context,logs) && await doesFilesMatch(logs);
}


export async function createScan(context: vscode.ExtensionContext, logs: Logs) {
    logs.info("Scan initiation started. Checking if scan is eligible to be initiated...");
    vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, true);
    if(await isScanCreateEligible(context,logs)){
        await createScanForProject(context,logs);
    }
}

 function getUserInput(msg: string): Promise<boolean>{
    return new Promise((resolve) => {
        vscode.window.showInformationMessage(msg, "Yes", "No").then(async (value) => {
            if(value && value === "Yes") {
                resolve(true);
            } else {
                vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, false)
                resolve(false);
            }
        });
    });
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

async function loadLatestResults(context: vscode.ExtensionContext,scan: CxScan,logs: Logs) {
  const userConfirmMessage = "Do you want to load the latest results for scan id: " + scan.id + " with status: " + scan.status + " ?";;
  const loadResult: boolean = await getUserInput(userConfirmMessage) ;
  if( loadResult && (scan.status.toLowerCase() === "completed" || scan.status.toLowerCase() === "partial")){
    update(context, SCAN_ID_KEY, { id: scan.id, name: `${SCAN_LABEL} ${getScanLabel(scan.createdAt,scan.id)}` });
    await getResultsWithProgress(logs, scan.id);
    await vscode.commands.executeCommand(REFRESH_TREE);
  }
}


