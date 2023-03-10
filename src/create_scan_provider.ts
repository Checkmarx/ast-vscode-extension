import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import * as vscode from "vscode";
import { Logs } from "./models/logs";
import { AstResult } from "./models/results";
import { getScan, scanCancel, scanCreate, updateStatusBarItem } from "./utils/ast/ast";
import {
    BRANCH_ID_KEY,
    BRANCH_NAME,
    NO,
    PROJECT_ID_KEY,
    SCAN_CANCEL,
    SCAN_CREATE,
    SCAN_CREATE_ID_KEY,
    SCAN_CREATE_PREPARING,
    SCAN_CREATE_PREP_KEY,
    SCAN_CREATE_VERIFY_BRANCH,
    SCAN_CREATE_VERIFY_FILES,
    SCAN_POLL_TIMEOUT,
    SCAN_STATUS_COMPLETE,
    SCAN_STATUS_PARTIAL,
    SCAN_STATUS_QUEUED,
    SCAN_STATUS_RUNNING,
    SCAN_WAITING,
    YES,
    EXTENSION_NAME
} from "./utils/common/constants";
import { get, Item, update } from "./utils/common/globalState";
import { getResultsJson, loadScanId } from "./utils/utils";

export async function pollForScanResult(context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem, logs: Logs) {
    return new Promise<void>((resolve) => {
        setInterval(async () => {
            const scanPreparing = get(context, SCAN_CREATE_PREP_KEY);
            if (scanPreparing?.id) { return; }

            const scanCreateId = get(context, SCAN_CREATE_ID_KEY);
            if (scanCreateId?.id) {
                updateStatusBarItem(SCAN_WAITING, true, statusBarItem);
                const scan = await getScan(scanCreateId.id);
                if (scan && scan.status.toLocaleLowerCase() !== SCAN_STATUS_RUNNING && scan.status.toLocaleLowerCase() !== SCAN_STATUS_QUEUED) {
                    scanFinished(context, scan, logs);
                    updateStatusBarItem(SCAN_WAITING, false, statusBarItem);
                    clearInterval(this);
                    resolve();
                }
            } else {
                updateStatusBarItem(SCAN_WAITING, false, statusBarItem);
            }
        }, SCAN_POLL_TIMEOUT);
    });
}

async function createScanForProject(context: vscode.ExtensionContext, logs: Logs) {
    const scanBranch: Item = context.workspaceState.get(BRANCH_ID_KEY);
    const projectForScan: Item = context.workspaceState.get(PROJECT_ID_KEY);
    let projectName = projectForScan.name.split(":")[1].trim();
    let workspaceFolder = vscode.workspace.workspaceFolders[0];
    logs.info("Initiating scan for workspace Folder: " + workspaceFolder.uri.fsPath);
    const scanCreateResponse = await scanCreate(projectName, scanBranch.id, workspaceFolder.uri.fsPath);
    logs.info("Scan created with ID: " + scanCreateResponse.id);
    update(context, SCAN_CREATE_ID_KEY, { id: scanCreateResponse.id, name: scanCreateResponse.id });
}

export async function cancelScan(context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem, logs: Logs) {
    logs.info("Triggering the cancel scan flow");
    updateStatusBarItem(SCAN_CANCEL, true, statusBarItem);

    const scan = get(context, SCAN_CREATE_ID_KEY);
    if (scan && scan.id) {
        const response = await scanCancel(scan.id);
        logs.info("scan cancel instruction sent for ID: " + scan.id + " :" + response);
        update(context, SCAN_CREATE_ID_KEY, undefined);
    }
    updateStatusBarItem(SCAN_CANCEL, false, statusBarItem);
}

async function doesFilesMatch(logs: Logs) {
    const files = await vscode.workspace.findFiles("*", undefined, 10);
    if (files.length === 0) {
        await vscode.window.showInformationMessage("No files found in workspace.");
        return;
    }

    const filesFromExistingScan = await getResultsJson();
    const resultFileNames = extractFileNamesFromResults(filesFromExistingScan.results);
    if (doFilesExistInWorkspace(resultFileNames)) {
        logs.info("Files match workspace");
        return true;
    } else {
        logs.info("Files in workspace dont match files in results");
        return await getUserInput("Project in workspace doesn't match the selected Checkmarx project. Do you want to scan anyway?");
    }
}

async function doesBranchMatch(context: vscode.ExtensionContext, logs: Logs) {
    const workspaceBranch = get(context, BRANCH_NAME);
    const scanBranch = get(context, BRANCH_ID_KEY);
    if (workspaceBranch && scanBranch && workspaceBranch.id === scanBranch.id) {
        logs.info("Branch match the view branch. Initiating scan...");
        return true;
    } else {
        return await getUserInput("Git branch doesn't match the selected Checkmarx branch. Do you want to scan anyway?");
    }
}

export async function createScan(context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem, logs: Logs) {
    logs.info("Scan initiation started. Checking if scan is eligible to be initiated...");
    update(context, SCAN_CREATE_PREP_KEY, { id: true, name: "" });
    updateStatusBarItem(SCAN_CREATE, true, statusBarItem);

    updateStatusBarItem(SCAN_CREATE_VERIFY_BRANCH, true, statusBarItem);
    if (!await doesBranchMatch(context, logs)) {
        updateStatusBarItem(SCAN_WAITING, false, statusBarItem);
        update(context, SCAN_CREATE_PREP_KEY, { id: false, name: "" });
        return;
    }

    updateStatusBarItem(SCAN_CREATE_VERIFY_FILES, true, statusBarItem);
    if (!await doesFilesMatch(logs)) {
        updateStatusBarItem(SCAN_WAITING, false, statusBarItem);
        update(context, SCAN_CREATE_PREP_KEY, { id: false, name: "" });
        return;
    }

    updateStatusBarItem(SCAN_CREATE_PREPARING, true, statusBarItem);
    await createScanForProject(context, logs);

    updateStatusBarItem(SCAN_WAITING, true, statusBarItem);
    update(context, SCAN_CREATE_PREP_KEY, { id: false, name: "" });

    await vscode.commands.executeCommand(`ast-results.pollForScan`);
}

async function getUserInput(msg: string): Promise<boolean> {
    // create a promise and wait for it to resolve
    const value = new Promise<boolean>(async (resolve, reject) => {
        await vscode.window.showInformationMessage(msg, YES, NO).then(async (val) => {
            if (val && val === YES) {
                resolve(true);
            } else {
                resolve(false);
            }
            reject();
        });
    });
    return value;
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

async function scanFinished(context: vscode.ExtensionContext, scan: CxScan, logs: Logs) {
    update(context, SCAN_CREATE_ID_KEY, undefined);

    if (scan.status.toLowerCase() === SCAN_STATUS_COMPLETE || scan.status.toLowerCase() === SCAN_STATUS_PARTIAL) {
        const userConfirmMessage = "Scan finished with status: " + scan.status + ". Do you want to load results? Scan Id: " + scan.id;
        const loadResult: boolean = await getUserInput(userConfirmMessage);
        if (loadResult) {
            loadScanId(context, scan.id, logs);
        }
    } else {
        await vscode.window.showInformationMessage("Scan finished with status: " + scan.status);
    }
}

export async function setScanButtonDefaultIfScanIsNotRunning(context: vscode.ExtensionContext) {
    const scan = get(context, SCAN_CREATE_ID_KEY);
    if (!scan?.id) {
        vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isScanEnabled`, true);
        vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.createScanButton`, true);
        update(context, SCAN_CREATE_PREP_KEY, { id: false, name: "" });
    }
}