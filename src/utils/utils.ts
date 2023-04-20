import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { AstResult } from "../models/results";
import { get, update, updateError } from "./common/globalState";
import {
  getBranches,
  getProject,
  getProjectList,
  getResults,
  getScan,
  getScans,
  triageShow,
} from "../ast/ast";
import { getBfl } from "../sast/bfl";
import { REFRESH_TREE, SHOW_ERROR } from "./common/commands";
import {
  BRANCH_ID_KEY,
  BRANCH_LABEL,
  ERROR_MESSAGE,
  PROJECT_ID_KEY,
  PROJECT_LABEL,
  RESULTS_FILE_EXTENSION,
  RESULTS_FILE_NAME,
  SCAN_ID_KEY,
  SCAN_LABEL,
} from "./common/constants";
import { GitExtension } from "./types/git";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";

export function getProperty(
  o: AstResult | CxScan,
  propertyName: string
): string {
  const properties = propertyName.split(".");
  let finalObject = o;
  let returnedProperty = "";
  for (const property of properties) {
    if (!finalObject || !(property in finalObject)) {
      return undefined;
    }
    returnedProperty = finalObject[property];
    finalObject = finalObject[property];
  }
  return returnedProperty;
}

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export async function getBranchPickItems(
  logs: Logs,
  projectId: string,
  context: vscode.ExtensionContext
) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info("Canceled loading"));
      progress.report({ message: "Loading branches" });
      const branchList = await getBranches(projectId);
      try {
        return branchList
          ? branchList.map((label) => ({
              label: label,
              id: label,
            }))
          : [];
      } catch (error) {
        updateError(context, ERROR_MESSAGE + error);
        vscode.commands.executeCommand(SHOW_ERROR);
        return [];
      }
    }
  );
}

export async function getProjectsPickItems(
  logs: Logs,
  context: vscode.ExtensionContext
) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info("Canceled loading"));
      progress.report({ message: "Loading projects" });
      try {
        const projectList = await getProjectList();
        return projectList
          ? projectList.map((label) => ({
              label: label.name,
              id: label.id,
            }))
          : [];
      } catch (error) {
        updateError(context, ERROR_MESSAGE + error);
        vscode.commands.executeCommand(SHOW_ERROR);
        return [];
      }
    }
  );
}

export async function getScansPickItems(
  logs: Logs,
  projectId: string,
  branchName: string,
  context: vscode.ExtensionContext
) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info("Canceled loading"));
      progress.report({ message: "Loading scans" });
      const scanList = await getScans(projectId, branchName);
      try {
        return scanList
          ? scanList.map((label) => ({
              label:
                label === scanList[0]
                  ? getScanLabel(label.createdAt, label.id) + " (latest)"
                  : getScanLabel(label.createdAt, label.id),
              id: label.id,
            }))
          : [];
      } catch (error) {
        updateError(context, ERROR_MESSAGE + error);
        vscode.commands.executeCommand(SHOW_ERROR);
        return [];
      }
    }
  );
}

export async function getResultsWithProgress(logs: Logs, scanId: string) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info("Canceled loading"));
      progress.report({ message: "Loading results" });
      await getResults(scanId);
    }
  );
}

export async function getScanWithProgress(logs: Logs, scanId: string) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info("Canceled loading"));
      progress.report({ message: "Loading scan" });
      return await getScan(scanId);
    }
  );
}

export async function getProjectWithProgress(logs: Logs, projectId: string) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info("Canceled loading"));
      progress.report({ message: "Loading project" });
      return await getProject(projectId);
    }
  );
}

export async function getBranchesWithProgress(logs: Logs, projectId: string) {
  return vscode.window.withProgress(
    PROGRESS_HEADER,
    async (progress, token) => {
      token.onCancellationRequested(() => logs.info("Canceled loading"));
      progress.report({ message: "Loading branches" });
      return await getBranches(projectId);
    }
  );
}

export async function getChanges(
  logs: Logs,
  context: vscode.ExtensionContext,
  result: AstResult,
  detailsPanel: vscode.WebviewPanel
) {
  const projectId = get(context, PROJECT_ID_KEY)?.id;
  if (projectId) {
    triageShow(projectId, result.similarityId, result.type)
      .then((changes) => {
        detailsPanel?.webview.postMessage({ command: "loadChanges", changes });
      })
      .catch((err) => {
        detailsPanel?.webview.postMessage({
          command: "loadChanges",
          changes: [],
        });
        logs.error(err);
      });
  } else {
    logs.error("Project ID is undefined.");
  }
}

export async function getResultsBfl(
  logs: Logs,
  context: vscode.ExtensionContext,
  result: AstResult,
  detailsPanel: vscode.WebviewPanel
) {
  const scanId = get(context, SCAN_ID_KEY)?.id;
  const cxPath = vscode.Uri.joinPath(
    context.extensionUri,
    path.join("media", "icon.png")
  );
  if (scanId) {
    getBfl(scanId, result.queryId, result.sastNodes, logs)
      .then((index) => {
        detailsPanel?.webview.postMessage({
          command: "loadBfl",
          index: { index: index, logo: cxPath },
        });
      })
      .catch(() => {
        detailsPanel?.webview.postMessage({
          command: "loadBfl",
          index: { index: -1, logo: cxPath },
        });
      });
  } else {
    logs.error("Scan ID is undefined.");
  }
}

export function isKicsFile(e: vscode.TextDocument): boolean {
  let r = true;
  if (
    !(
      e.fileName.endsWith(".tf") ||
      e.fileName.endsWith(".yml") ||
      e.fileName.endsWith(".yaml") ||
      e.fileName.endsWith(".json") ||
      e.fileName.match("Dockerfile") ||
      e.fileName.endsWith(".auto.tfvars") ||
      e.fileName.endsWith(".terraform.tfvars") ||
      e.fileName.endsWith(".proto") ||
      e.fileName.endsWith(".dockerfile")
    )
  ) {
    r = false;
  }
  return r;
}

export function isSystemFile(e: vscode.TextDocument): boolean {
  return (
    e.uri.scheme.toString() !== "git" &&
    !e.fileName.includes("package.json") &&
    !e.fileName.includes("settings.json")
  );
}

export const PROGRESS_HEADER: vscode.ProgressOptions = {
  location: vscode.ProgressLocation.Notification,
  title: "Checkmarx",
  cancellable: true,
};

export function getFilePath() {
  return __dirname;
}

export function getResultsFilePath() {
  return path.join(
    getFilePath(),
    `${RESULTS_FILE_NAME}.${RESULTS_FILE_EXTENSION}`
  );
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
    for (const it of items) {
      this.add(it);
    }
  }

  add(it: T) {
    const k = this.key(it);
    this.set(k, (this.get(k) || 0) + 1);
  }
}

export function getScanLabel(createdAt: string, id: string) {
  // convert date to yyyy/mm/dd HH:mm:ss
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month =
    date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
  const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
  const hours = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
  const minutes =
    date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
  const seconds =
    date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();
  const dateString =
    year +
    "/" +
    month +
    "/" +
    day +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds;
  return dateString + " " + id;
}

export async function enableButton(button: string) {
  await vscode.commands.executeCommand("setContext", button, true);
}

export async function disableButton(button: string) {
  await vscode.commands.executeCommand("setContext", button, false);
}

export async function getGitAPIRepository() {
  const gitExtension =
    vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
  return gitExtension.getAPI(1);
}

export async function getResultsJson() {
  const resultJsonPath = getResultsFilePath();
  if (fs.existsSync(resultJsonPath)) {
    return JSON.parse(
      fs
        .readFileSync(resultJsonPath, "utf-8")
        .replace(/:([0-9]{15,}),/g, ':"$1",')
    );
  }
  return { results: [] };
}

export async function loadScanId(
  context: vscode.ExtensionContext,
  scanId: string,
  logs: Logs
) {
  const scan = await getScanWithProgress(logs, scanId);
  if (!scan?.id || !scan?.projectID) {
    vscode.window.showErrorMessage("ScanId not found");
    return;
  }

  const project = await getProjectWithProgress(logs, scan.projectID);
  if (!project?.id) {
    vscode.window.showErrorMessage("Project not found");
    return;
  }

  update(context, PROJECT_ID_KEY, {
    id: project.id,
    name: `${PROJECT_LABEL} ${project.name}`,
  });
  update(context, BRANCH_ID_KEY, {
    id: scan.branch,
    name: `${BRANCH_LABEL} ${getProperty(scan, "branch")}`,
  });
  update(context, SCAN_ID_KEY, {
    id: scan.id,
    name: `${SCAN_LABEL} ${getScanLabel(scan.createdAt, scan.id)}`,
  });

  await getResultsWithProgress(logs, scan.id);
  await vscode.commands.executeCommand(REFRESH_TREE);
}
