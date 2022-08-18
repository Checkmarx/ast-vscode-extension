import { Logs } from "./models/logs";
import * as vscode from "vscode";
import * as fs from "fs";
import {getResultsFilePath} from "./utils/utils";
import {BRANCH_ID_KEY, PROJECT_ID_KEY, SCAN_CREATE_ID_KEY, SCAN_RUNNING} from "./utils/constants";
import { update } from "./utils/globalState";
import { AstResult } from "./models/results";
import {scanCreate} from "./utils/ast";
import {GitExtension} from "./types/git";

const SCAN_STARTED = "$(sync~spin) Checkmarx scan started";
const SCAN_CREATED = "$(check) Checkmarx Scan";


function getBranchFromWorkspace() {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
    const gitApi = gitExtension.getAPI(1);
    const state = gitApi.repositories[0]?.state;
    return state.HEAD?.name;
}

async function updateScanRunningStatus(context: vscode.ExtensionContext, status: string) {
  update(context, SCAN_RUNNING, { id: SCAN_RUNNING, name: status });
  await vscode.commands.executeCommand("ast-results.isScanRunning", status.toLowerCase() === "true"? true: false);
}

function updateStatusBarItem(text: string, show: boolean, statusBarItem: vscode.StatusBarItem){
  statusBarItem.text = text;
  show? statusBarItem.show() : statusBarItem.hide();
}

async function createScanForProject(context: vscode.ExtensionContext, logs: Logs, branch: string, statusBarItem: vscode.StatusBarItem) {
  let projectForScan:any = context.workspaceState.get(PROJECT_ID_KEY);
  let projectName = projectForScan.name.split(":")[1].trim();
  let workspaceFolder = vscode.workspace.workspaceFolders[0];
  logs.info("Initiating scan for workspace Folder: " +	workspaceFolder.uri.fsPath);
  const scanCreateResponse = await scanCreate(projectName, branch,workspaceFolder.uri.fsPath);
  logs.info("Scan created successfully. ID: " + scanCreateResponse.id);
  updateScanRunningStatus(context,"false");
  updateStatusBarItem(SCAN_CREATED,false,statusBarItem);
  update(context, SCAN_CREATE_ID_KEY, { id: scanCreateResponse.id, name: scanCreateResponse.id });
}


export async function createScan(context: vscode.ExtensionContext, logs: Logs, createScanStatusBarItem: vscode.StatusBarItem) {
  // step 1 -> check if the files in results are there in the current workspaceFolders
  await updateScanRunningStatus(context,"true");
  updateStatusBarItem(SCAN_STARTED,true,createScanStatusBarItem);
  await vscode.commands.executeCommand("ast-results.isScanRunning", true);
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
          updateScanRunningStatus(context,"false");
      }
  } else{
      await vscode.window.showInformationMessage("Failed creating scan: Files in workspace dont match the files in scan");
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
