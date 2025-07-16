import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { AstResult } from "../models/results";
import { constants } from "./common/constants";
import { GitExtension, Repository } from "./types/git";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import JSONStream from "jsonstream-ts";
import { Transform } from "stream";
import { getGlobalContext } from "../extension";
import { commands } from "./common/commands";
import { HoverData, SecretsHoverData } from "../realtimeScanners/common/types";
import { IgnoreFileManager } from "../realtimeScanners/common/ignoreFileManager";
import { OssScannerService } from "../realtimeScanners/scanners/oss/ossScannerService";
import { Logs } from "../models/logs";
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
  title: constants.extensionFullName,
  cancellable: true,
};

export function getFilePath() {
  return __dirname;
}

export function getResultsFilePath() {
  return path.join(
    getFilePath(),
    `${constants.resultsFileName}.${constants.resultsFileExtension}`
  );
}

export function getScanLabel(createdAt: string, id: string) {
  return getFormattedDateTime(createdAt) + " " + id;
}

export function getFormattedDateTime(createdAt: string) {
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
  return dateString;
}

export function getFormattedId(label: CxScan, scanList: CxScan[]) {
  if (scanList === null || scanList === undefined || scanList.length === 0) {
    return "";
  }

  return label === scanList[0] ? label.id + " (latest)" : label.id;
}

export function formatLabel(label: CxScan, scanList: CxScan[]) {
  return label === scanList[0]
    ? getScanLabel(label.createdAt, label.id) + " (latest)"
    : getScanLabel(label.createdAt, label.id);
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

export async function getGitBranchName() {
  const gitApi = await getGitAPIRepository();
  return gitApi.repositories[0]?.state.HEAD?.name; //TODO: replace with getFromState(context, constants.branchName) when the onBranchChange is working properly
}

function extractRepoFullName(remoteURL: string): string | undefined {
  const match = remoteURL.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : undefined;
}

export async function getActiveRepository(): Promise<Repository | undefined> {
  const gitAPI = await getGitAPIRepository();
  if (!gitAPI) {
    return undefined;
  }
  return gitAPI.repositories[0]; // Default to the first repository
}

export async function getRepositoryFullName(): Promise<string | undefined> {
  const activeRepo = await getActiveRepository();
  if (!activeRepo) {
    return undefined;
  }

  const remote =
    activeRepo.state.remotes.find((r) => r.name === "origin") ||
    activeRepo.state.remotes[0];
  const remoteURL = remote?.fetchUrl;

  if (!remoteURL) {
    return undefined;
  }

  return extractRepoFullName(remoteURL);
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

export function readResultsFromFile(
  resultJsonPath: string,
  scan: string
): Promise<CxResult[]> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(resultJsonPath) || !scan) {
      resolve([]);
      return;
    }

    const results: CxResult[] = [];
    const stream = fs.createReadStream(resultJsonPath, { encoding: "utf-8" });

    const transformStream = new Transform({
      transform(chunk, encoding, callback) {
        const transformed = chunk
          .toString()
          .replace(/:([0-9]{15,}),/g, ':"$1",');
        callback(null, transformed);
      },
    });

    const jsonStream = JSONStream.parse("results.*", undefined);

    stream
      .pipe(transformStream)
      .pipe(jsonStream)
      .on("data", (data) => {
        results.push(data);
      })
      .on("end", () => {
        resolve(orderResults(results));
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

export function orderResults(list: CxResult[]): CxResult[] {
  const order = [
    constants.criticalSeverity,
    constants.highSeverity,
    constants.mediumSeverity,
    constants.lowSeverity,
    constants.infoSeverity,
  ];
  return list.sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
  );
}

export function updateStatusBarItem(
  text: string,
  show: boolean,
  statusBarItem: vscode.StatusBarItem
) {
  statusBarItem.text = text;
  show ? statusBarItem.show() : statusBarItem.hide();
}

export function getStateIdForTriage(selectedStateName: string): number {
  const context = getGlobalContext();
  const customStates = context.globalState.get(constants.customStates) as {
    id: number;
    name: string;
    type: string;
  }[];

  const matchedCustom = customStates.find(
    (state) => state.name.toLowerCase() === selectedStateName.toLowerCase()
  );
  return matchedCustom.id;
}

export function isCursorIDE(): boolean {
  const appName = vscode.env.appName || '';
  if (appName.toLowerCase().includes('cursor')) {
    return true;
  }
  return false;
}

export function buildCommandButtons(args: string, isSecret: boolean): string {
  const isCursor = isCursorIDE();

  return (
    `<a href="command:${commands.openAIChat}?${args}" title="">Fix with CxAI & ${isCursor ? "Cursor" : "Copilot"}</a>  ` +
    `<a href="command:${commands.viewDetails}?${args}" title="">${isSecret ? "CxAI Explain " : "View CxAI Package Details"}</a>  ` +
    `<a href="command:${commands.ignorePackage}?${args}" title="">Ignore CxAI Package</a>  ` +
    `<a href="command:${commands.IgnoreAll}?${args}" title="">${isSecret ? " " : "Ignore All CxAI Packages"}</a>`
  );
}

export function isSecretsHoverData(item: HoverData | SecretsHoverData): item is SecretsHoverData {
  return 'title' in item && 'description' in item && 'severity' in item;
}


export function renderCxAiBadge(): string {
  return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/CxAi.png" style="vertical-align: -12px;"/> `;
}


export function getWorkspaceFolder(filePath: string): vscode.WorkspaceFolder {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  if (!folder) { throw new Error("No workspace folder found."); }
  return folder;
}

export function getInitializedIgnoreManager(folder: vscode.WorkspaceFolder): IgnoreFileManager {
  const manager = IgnoreFileManager.getInstance();
  manager.initialize(folder);
  return manager;
}


export function findAndIgnoreMatchingPackages(
  item: HoverData,
  scanner: OssScannerService,
  manager: IgnoreFileManager
): Set<string> {
  const affected = new Set<string>();
  const packageKey = `${item.packageName}:${item.version}:${item.packageManager}`;

  const packageToFilesMap = buildPackageToFilesMap(scanner);
  const matchingFiles = packageToFilesMap.get(packageKey);

  if (matchingFiles) {
    matchingFiles.forEach(filePath => {
      affected.add(filePath);
      manager.addIgnoredEntry({
        packageManager: item.packageManager,
        packageName: item.packageName,
        packageVersion: item.version,
        filePath,
      });
    });
  }

  return affected;
}

function buildPackageToFilesMap(scanner: OssScannerService): Map<string, Set<string>> {
  const packageToFilesMap = new Map<string, Set<string>>();

  for (const [filePath, diagnostics] of scanner['diagnosticsMap'].entries()) {
    for (const diagnostic of diagnostics) {
      const d = (diagnostic as vscode.Diagnostic & { data?: { item?: HoverData } }).data?.item;
      if (d?.packageName && d?.version && d?.packageManager) {
        const packageKey = `${d.packageName}:${d.version}:${d.packageManager}`;

        if (!packageToFilesMap.has(packageKey)) {
          packageToFilesMap.set(packageKey, new Set());
        }
        packageToFilesMap.get(packageKey)!.add(filePath);
      }
    }
  }

  return packageToFilesMap;
}

export async function rescanFiles(files: Set<string>, scanner: OssScannerService, logs: Logs): Promise<void> {
  for (const filePath of files) {
    const document =
      vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath)
      ?? await vscode.workspace.openTextDocument(filePath);

    if (scanner.shouldScanFile(document)) {
      await scanner.scan(document, logs);
    }
  }
}