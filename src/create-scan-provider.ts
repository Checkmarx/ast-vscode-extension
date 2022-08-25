import { Logs } from "./models/logs";
import * as vscode from "vscode";
import * as fs from "fs";
import {getResultsFilePath} from "./utils/utils";
import {BRANCH_ID_KEY, PROJECT_ID_KEY, SCAN_CREATE_ID_KEY} from "./utils/constants";
import { Item, update } from "./utils/globalState";
import { AstResult } from "./models/results";
import {getScan, scanCreate} from "./utils/ast";
import {GitExtension} from "./types/git";

const SCAN_STARTED = "$(sync~spin) Checkmarx scan started";
const SCAN_WAITING = "$(sync~spin) Checkmarx - waiting for scan to complete";
const SCAN_CREATED = "$(check) Checkmarx Scan";
const SCAN_POLL_TIMEOUT = 5000;


function getBranchFromWorkspace() {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
    const gitApi = gitExtension.getAPI(1);
    const state = gitApi.repositories[0]?.state;
    return state.HEAD?.name;
}

async function updateScanRunningStatus(context: vscode.ExtensionContext, status: string) {
  await vscode.commands.executeCommand("ast-results.isScanRunning", status.toLowerCase() === "true"? true: false);
}

function updateStatusBarItem(text: string, show: boolean, statusBarItem: vscode.StatusBarItem){
  statusBarItem.text = text;
  show? statusBarItem.show() : statusBarItem.hide();
}



export async function pollForScanResult(context: vscode.ExtensionContext,scanId: string,logs: Logs, statusBarItem: vscode.StatusBarItem) {
    // Poll for scan result
    // let scanId: Item = context.workspaceState.get(SCAN_CREATE_ID_KEY);
    // let scanIdValue = scanId?.id;
    // if (scanIdValue) {
        let scanResult = await getScan(scanId);
        if (scanResult.status.toLowerCase() === "completed" || scanResult.status.toLowerCase() === "partial") {
            logs.info("Scan completed for scan ID: " + scanId + " with status: " + scanResult.status);
            await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, false);
            update(context, SCAN_CREATE_ID_KEY, {id:undefined,name:""});
            updateStatusBarItem(SCAN_CREATED, false, statusBarItem);
            return true;
        } else {
          logs.info("Scan not completed yet for scan ID: " + scanId);
            updateStatusBarItem(SCAN_WAITING, true, statusBarItem);
            await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, true);
            // return new Promise(resolve => setTimeout(() => resolve(pollForScanResult(context, logs, statusBarItem)), SCAN_POLL_TIMEOUT)); 
        }
    // }
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
  // await pollForScanResult(context,scanCreateResponse.id, logs, statusBarItem);
}


export async function createScan(context: vscode.ExtensionContext, logs: Logs, createScanStatusBarItem: vscode.StatusBarItem) {
  // step 1 -> check if the files in results are there in the current workspaceFolders
  updateStatusBarItem(SCAN_STARTED,true,createScanStatusBarItem);
  await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, true);
  let filesExistInResults =  await findFilesInWorkspaceAndResults();
  if(filesExistInResults) {
      // step 2 -> check the branch in workspace and plugin view match
      let branchInWorkspace = getBranchFromWorkspace();
      let branchInCxView:any = context.workspaceState.get(BRANCH_ID_KEY);
      if(branchInWorkspace === branchInCxView.id) {
          createScanForProject(context,logs,branchInCxView.id,createScanStatusBarItem);       
      } else {
          logs.info("Branch in workspace and plugin view do not match");
          await vscode.window.showInformationMessage("Failed creating scan: Branch in workspace doesnt match the branch in scan");
          updateStatusBarItem(SCAN_CREATED,false,createScanStatusBarItem);
          await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, false);

      }
  } else{
      await vscode.window.showInformationMessage("Failed creating scan: Files in workspace dont match the files in scan");
      updateStatusBarItem(SCAN_CREATED,false,createScanStatusBarItem);
      await vscode.commands.executeCommand('setContext', `ast-results.isScanRunning`, false);

  }
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
