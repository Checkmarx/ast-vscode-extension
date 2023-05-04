import * as vscode from "vscode";
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import CxScaRealtime from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTime";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxCodeBashing from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/codebashing/CxCodeBashing";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import CxLearnMoreDescriptions from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/learnmore/CxLearnMoreDescriptions";
import {
  constants
} from "../utils/common/constants";
import { getFilePath } from "../utils/utils";
import { SastNode } from "../models/sastNode";
import AstError from "../exceptions/AstError";
import { Logs } from "../models/logs";
import { CxCommandOutput } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxCommandOutput";
import { ChildProcessWithoutNullStreams } from "child_process";
import { CxParamType } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxParamType";

export async function scaScanCreate(
  sourcePath: string
): Promise<CxScaRealtime[] | undefined> {
  const cx = new CxWrapper(getBaseAstConfiguration());
  let jsonResults = [];
  const scan = await cx.runScaRealtimeScan(sourcePath);
  if (scan.payload && scan.payload.length > 0 && scan.exitCode === 0) {
    if (scan.payload[0].results) {
      jsonResults = scan.payload[0].results;
    }
  } else {
    throw new Error(scan.status);
  }

  return jsonResults;
}

export async function scanCreate(
  projectName: string,
  branchName: string,
  sourcePath: string
) {
  const config = getAstConfiguration();

  if (!projectName) {
    return;
  }
  if (!branchName) {
    return;
  }
  const cx = new CxWrapper(config);
  const params = new Map<CxParamType, string>();
  params.set(CxParamType.S, sourcePath);
  params.set(CxParamType.BRANCH, branchName);
  params.set(CxParamType.PROJECT_NAME, projectName);
  params.set(CxParamType.AGENT, "VS Code");
  params.set(
    CxParamType.ADDITIONAL_PARAMETERS,
    constants.scanCreateAdditionalParameters
  );
  const scan = await cx.scanCreate(params);
  return scan.payload[0];
}

export async function scanCancel(scanId: string) {
  const config = getAstConfiguration();

  if (!scanId) {
    return;
  }
  const cx = new CxWrapper(config);
  const scan = await cx.scanCancel(scanId);
  if (scan.exitCode !== 0) {
    throw new Error("Error canceling scan");
  }
  return true;
}

export async function getResults(scanId: string | undefined) {
  const config = getAstConfiguration();
  if (!scanId) {
    throw new Error("Scan ID is not defined while trying to get results");
  }
  const cx = new CxWrapper(config);
  await cx.getResults(
    scanId,
    constants.resultsFileExtension,
    constants.resultsFileName,
    getFilePath()
  );
}

export async function getScan(
  scanId: string | undefined
): Promise<CxScan | undefined> {
  const config = getAstConfiguration();
  if (!scanId) {
    throw new Error("Scan ID is not defined while trying to get scan");
  }
  const cx = new CxWrapper(config);
  const scan = await cx.scanShow(scanId);
  return scan.payload[0];
}

export async function getProject(
  projectId: string | undefined
): Promise<CxProject | undefined> {
  const config = getAstConfiguration();
  if (!config) {
    throw new Error("Configuration is not defined while trying to get project");
  }
  if (!projectId) {
    throw new Error("Project ID is not defined while trying to get project");
  }
  const cx = new CxWrapper(config);
  const project = await cx.projectShow(projectId);
  return project.payload[0];
}

export async function getProjectList(): Promise<CxProject[] | undefined> {
  let r = [];
  const config = getAstConfiguration();
  if (!config) {
    throw new Error(
      "Configuration is not defined while trying to get project list"
    );
  }
  const cx = new CxWrapper(config);
  const projects = await cx.projectList("limit=10000");
  if (projects.payload) {
    r = projects.payload;
  } else {
    throw new Error(projects.status);
  }
  return r;
}

export async function getBranches(
  projectId: string | undefined
): Promise<string[] | undefined> {
  let r = [];
  const config = getAstConfiguration();

  const cx = new CxWrapper(config);
  let branches = undefined;
  if (!projectId) {
    throw new Error("Project ID is not defined while trying to get branches");
  }
  branches = await cx.projectBranches(projectId, "");
  if (branches && branches.payload) {
    r = branches.payload;
  } else {
    throw new Error(branches.status);
  }

  return r;
}

export async function getScans(
  projectId: string | undefined,
  branch: string | undefined
): Promise<CxScan[] | undefined> {
  let r = [];
  const config = getAstConfiguration();

  const filter = `project-id=${projectId},branch=${branch},limit=10000,statuses=Completed`;
  const cx = new CxWrapper(config);
  const scans = await cx.scanList(filter);
  if (scans.payload) {
    r = scans.payload;
  } else {
    throw new Error(scans.status);
  }
  return r;
}

export function getBaseAstConfiguration() {
  const config = new CxConfig();
  config.additionalParameters = vscode.workspace
    .getConfiguration("checkmarxOne")
    .get("additionalParams") as string;
  return config;
}

export function getAstConfiguration() {
  const token = vscode.workspace
    .getConfiguration("checkmarxOne")
    .get("apiKey") as string;
  if (!token) {
    return undefined;
  }

  const config = getBaseAstConfiguration();
  config.apiKey = token;
  return config;
}

export async function isScanEnabled(logs: Logs): Promise<boolean> {
  let enabled = false;
  const config = getAstConfiguration();
  if (!config) {
    return enabled;
  }
  const cx = new CxWrapper(config);
  try {
    enabled = await cx.ideScansEnabled();
  } catch (error) {
    logs.error(error);
    return enabled;
  }
  return enabled;
}

export async function isSCAScanEnabled(): Promise<boolean> {
  const enabled = true;
  return enabled;
}

export async function triageShow(
  projectId: string,
  similarityId: string,
  scanType: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[] | undefined> {
  let r = [];
  const config = getAstConfiguration();

  const cx = new CxWrapper(config);
  const scans = await cx.triageShow(projectId, similarityId, scanType);
  if (scans.payload && scans.exitCode === 0) {
    r = scans.payload;
  } else {
    throw new Error(scans.status);
  }
  return r;
}

export async function triageUpdate(
  projectId: string,
  similarityId: string,
  scanType: string,
  state: string,
  comment: string,
  severity: string
) {
  const config = getAstConfiguration();
  const cx = new CxWrapper(config);
  await cx.triageUpdate(
    projectId,
    similarityId,
    scanType,
    state,
    comment,
    severity.toLowerCase()
  );
}

export async function getCodeBashing(
  cweId: string,
  language: string,
  queryName: string
): Promise<CxCodeBashing | undefined> {
  const config = getAstConfiguration();
  if (!config) {
    throw new Error("Configuration error");
  }
  if (!cweId || !language || !queryName) {
    throw new Error(
      "Missing mandatory parameters, cweId, language or queryName "
    );
  }
  const cx = new CxWrapper(config);
  const codebashing = await cx.codeBashingList(
    cweId.toString(),
    language,
    queryName
  );
  if (codebashing.exitCode === 0) {
    return codebashing.payload[0];
  } else {
    throw new AstError(codebashing.exitCode, codebashing.status);
  }
}

export async function getResultsBfl(
  scanId: string,
  queryId: string,
  resultNodes: SastNode[]
) {
  const config = getAstConfiguration();
  if (!config) {
    throw new Error("Configuration error");
  }
  if (!scanId || !queryId || !resultNodes) {
    throw new Error(
      "Missing mandatory parameters, scanId, queryId or resultNodes "
    );
  }
  const cx = new CxWrapper(config);
  const bfl = await cx.getResultsBfl(
    scanId.toString(),
    queryId.toString(),
    resultNodes
  );
  if (bfl.exitCode === 0) {
    return bfl.payload[0];
  } else {
    throw new Error(bfl.status);
  }
}

export async function getResultsRealtime(
  fileSources: string,
  additionalParams: string
): Promise<[Promise<CxCommandOutput>, ChildProcessWithoutNullStreams]> {
  if (!fileSources) {
    throw new Error("Missing mandatory parameters, fileSources");
  }
  const cx = new CxWrapper(new CxConfig());
  let [kics, process] = [undefined, undefined];
  try {
    [kics, process] = await cx.kicsRealtimeScan(
      fileSources,
      "",
      additionalParams
    );
  } catch (e) {
    throw new Error("Error running kics scan");
  }
  return [kics, process];
}

export async function scaRemediation(
  packageFile: string,
  packages: string,
  packageVersion: string
) {
  const config = getAstConfiguration();
  if (!config) {
    throw new Error("Configuration error");
  }
  const cx = new CxWrapper(config);
  const scaFix = await cx.scaRemediation(packageFile, packages, packageVersion);
  if (scaFix.exitCode === 0) {
    return scaFix.exitCode;
  } else {
    throw new Error(scaFix.status.replaceAll("\n", ""));
  }
}

export async function kicsRemediation(
  resultsFile: string,
  kicsFile: string,
  engine: string,
  similarityIds?: string
): Promise<[Promise<CxCommandOutput>, ChildProcessWithoutNullStreams]> {
  if (!resultsFile) {
    throw new Error("Missing mandatory parameters, resultsFile");
  }
  if (!kicsFile) {
    throw new Error("Missing mandatory parameters, kicsFile");
  }
  const cx = new CxWrapper(new CxConfig());
  let [kics, process] = [undefined, undefined];
  try {
    [kics, process] = await cx.kicsRemediation(
      resultsFile,
      kicsFile,
      engine,
      similarityIds
    );
  } catch (e) {
    throw new Error("Error running kics remediation");
  }
  return [kics, process];
}

export async function learnMore(
  queryID: string
): Promise<CxLearnMoreDescriptions[] | undefined> {
  let r = [];
  const config = getAstConfiguration();

  const cx = new CxWrapper(config);
  const scans = await cx.learnMore(queryID);
  if (scans.payload && scans.exitCode === 0) {
    r = scans.payload;
  } else {
    throw new Error(scans.status);
  }
  return r;
}
