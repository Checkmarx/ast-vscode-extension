import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { AstResult } from "../models/results";
import { constants } from "./common/constants";
import { GitExtension, Repository } from "./types/git";
import CxScan from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import JSONStream from "jsonstream-ts";
import { Transform } from "stream";
import { getGlobalContext } from "../activate/activateCore";
import { commands } from "./common/commandBuilder";
import { IgnoreFileManager } from "../realtimeScanners/common/ignoreFileManager";
import { OssScannerService } from "../realtimeScanners/scanners/oss/ossScannerService";
import { ContainersScannerService } from "../realtimeScanners/scanners/containers/containersScannerService";
import { Logs } from "../models/logs";
import { HoverData, SecretsHoverData, AscaHoverData, ContainersHoverData, IacHoverData } from "../realtimeScanners/common/types";
import { ThemeUtils } from "./themeUtils";
import { getMessages } from "../config/extensionMessages";
import { getExtensionType, EXTENSION_TYPE } from "../config/extensionConfig";
import { MediaPathResolver } from "./mediaPathResolver";


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
  return gitApi.repositories[0]?.state.HEAD?.name;
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
  return gitAPI.repositories[0];
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
    (state) => (state.name.trim() === selectedStateName.trim())
  );
  return matchedCustom.id;
}

export function getIDEName(): string {
  const appName = (vscode && vscode.env && typeof vscode.env.appName === 'string')
    ? vscode.env.appName
    : '';
  return appName.toLowerCase();
}

export function isIDE(ideName: string): boolean {
  return getIDEName().includes(ideName.toLowerCase());
}

export function buildCommandButtons(args: string, hasIgnoreAll: boolean, isSecret: boolean): string {
  const productName = getMessages().productName;
  return `<a href="command:${commands.openAIChat}?${args}">Fix with ${productName}</a> &emsp;
          <a href="command:${commands.viewDetails}?${args}">View details</a> &emsp;
          <a href="command:${commands.ignorePackage}?${args}"> ${isSecret ? "Ignore this secret in file" : "Ignore this vulnerability"}</a> &emsp;
          <a href="command:${commands.ignoreAll}?${args}">${hasIgnoreAll ? "Ignore all of this type" : " "}</a>&emsp;
    `;

}

export function isSecretsHoverData(item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData): item is SecretsHoverData {
  return 'title' in item && 'description' in item && 'severity' in item && !('expectedValue' in item);
}

export function isAscaHoverData(item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData): item is AscaHoverData {
  return 'ruleName' in item && 'remediationAdvise' in item;
}

export function isContainersHoverData(item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData): item is ContainersHoverData {
  return 'imageName' in item && 'imageTag' in item;
}

export function isIacHoverData(item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData): item is IacHoverData {
  return 'similarityId' in item && 'title' in item;
}



/**
 * Configuration for CxAI badge rendering
 */
const CX_AI_BADGE_CONFIG = {
  style: 'vertical-align: -12px;',
  checkmarxIcons: {
    light: 'CxOne_Assist_light.png',
    dark: 'CxOne_Assist.png'
  },
  devAssistIcons: {
    light: 'CxDev_Assist_light.png',
    dark: 'CxDev_Assist.png'
  }
} as const;

/**
 * Renders the CxAI badge with appropriate theming and extension-specific icons
 * Uses local file paths from the core media folder
 */
export function renderCxAiBadge(): string {
  const extensionType = getExtensionType();
  const icons = extensionType === EXTENSION_TYPE.CHECKMARX
    ? CX_AI_BADGE_CONFIG.checkmarxIcons
    : CX_AI_BADGE_CONFIG.devAssistIcons;

  const iconFile = ThemeUtils.selectIconByTheme(icons.light, icons.dark);
  const iconPath = MediaPathResolver.getMediaFilePath('icons', iconFile);
  const iconUri = vscode.Uri.file(iconPath).toString();

  return `<img src="${iconUri}" style="${CX_AI_BADGE_CONFIG.style}"/>`;
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
  const packageKey = `${item.packageManager}:${item.packageName}:${item.version}`;

  const packageToDataMap = buildPackageToDataMap(scanner);
  const matchingData = packageToDataMap.get(packageKey);

  if (matchingData) {
    const ignoreDate = new Date().toISOString();

    matchingData.forEach(hoverData => {
      affected.add(hoverData.filePath);
      manager.addIgnoredEntry({
        packageManager: hoverData.packageManager,
        packageName: hoverData.packageName,
        packageVersion: hoverData.version,
        filePath: hoverData.filePath,
        line: hoverData.line,
        severity: hoverData.status,
        description: hoverData.vulnerabilities ?
          hoverData.vulnerabilities.map(v => `${v.cve}: ${v.description}`).join(', ') :
          undefined,
        dateAdded: ignoreDate
      });
    });
  }

  return affected;
}

function buildPackageToDataMap(scanner: OssScannerService): Map<string, HoverData[]> {
  return Array.from(scanner['diagnosticsMap'].values())
    .flatMap(diagnostics => diagnostics)
    .map(diagnostic => (diagnostic as vscode.Diagnostic & { data?: { item?: HoverData } }).data?.item)
    .filter((d): d is HoverData => !!(d?.packageName && d?.version && d?.packageManager))
    .reduce((map, hoverData) => {
      const packageKey = `${hoverData.packageManager}:${hoverData.packageName}:${hoverData.version}`;

      if (!map.has(packageKey)) {
        map.set(packageKey, []);
      }
      map.get(packageKey)!.push(hoverData);

      return map;
    }, new Map<string, HoverData[]>());
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


export async function scanAllContainerFilesInWorkspace(
  scanner: ContainersScannerService,
  logs: Logs
): Promise<void> {
  for (const pattern of constants.containersSupportedPatterns) {
    const uris = await vscode.workspace.findFiles(pattern);
    for (const uri of uris) {
      try {
        const document = await vscode.workspace.openTextDocument(uri);
        if (scanner.shouldScanFile(document)) {
          await scanner.scan(document, logs);
        }
      } catch (err) {
        logs.warn(`Failed to scan container file: ${uri.fsPath}`);
      }
    }
  }
}

/**
 */
function buildContainerToDataMap(scanner: ContainersScannerService): Map<string, Array<{ hoverData: ContainersHoverData, filePath: string }>> {
  const containerMap = new Map<string, Array<{ hoverData: ContainersHoverData, filePath: string }>>();

  scanner.getHoverData().forEach((hoverData, key) => {
    const filePath = key.split(':')[0];
    const imageKey = `${hoverData.imageName}:${hoverData.imageTag}`;

    if (!containerMap.has(imageKey)) {
      containerMap.set(imageKey, []);
    }

    containerMap.get(imageKey)!.push({ hoverData, filePath });
  });

  return containerMap;
}

export async function findAndIgnoreMatchingContainersInWorkspace(
  item: ContainersHoverData,
  scanner: ContainersScannerService,
  manager: IgnoreFileManager,
  logs: Logs
): Promise<Set<string>> {
  const affected = new Set<string>();

  await scanAllContainerFilesInWorkspace(scanner, logs);

  const imageKey = `${item.imageName}:${item.imageTag}`;
  const containerToDataMap = buildContainerToDataMap(scanner);
  const matchingData = containerToDataMap.get(imageKey);

  if (matchingData) {
    const ignoreDate = new Date().toISOString();

    matchingData.forEach(({ hoverData, filePath }) => {
      affected.add(filePath);
      manager.addIgnoredEntryContainers({
        imageName: hoverData.imageName,
        imageTag: hoverData.imageTag,
        filePath: filePath,
        line: (hoverData.location?.line || 0) + 1,
        severity: hoverData.status,
        description: hoverData.vulnerabilities && hoverData.vulnerabilities.length > 0 ?
          hoverData.vulnerabilities.map(v => `${v.cve}: ${v.severity}`).join(', ') :
          undefined,
        dateAdded: ignoreDate
      });
    });
  }

  return affected;
}


export async function rescanContainerFiles(files: Set<string>, scanner: ContainersScannerService, logs: Logs): Promise<void> {
  for (const filePath of files) {
    try {
      const document =
        vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath)
        ?? await vscode.workspace.openTextDocument(filePath);

      if (scanner.shouldScanFile(document)) {
        await scanner.scan(document, logs);
      }
    } catch (error) {
      continue;
    }
  }
}


export async function rescanAllContainerIgnoredFiles(
  ignoreManager: IgnoreFileManager,
  scanner: ContainersScannerService,
  logs: Logs
): Promise<void> {
  const ignoredData = ignoreManager.getIgnoredPackagesData();
  const containerEntries = Object.values(ignoredData).filter(
    entry => entry.type === constants.containersRealtimeScannerEngineName
  );

  const affectedFiles = new Set<string>();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) { return; }

  containerEntries.forEach(entry => {
    entry.files?.forEach(file => {
      if (file.active) {
        const fullPath = path.resolve(workspaceFolder.uri.fsPath, file.path);
        affectedFiles.add(fullPath);
      }
    });
  });

  await rescanContainerFiles(affectedFiles, scanner, logs);
}