import * as vscode from "vscode";
import CxScaRealtime from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTime";
import CxScan from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarx/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxCodeBashing from "@checkmarx/ast-cli-javascript-wrapper/dist/main/codebashing/CxCodeBashing";
import { SastNode } from "../models/sastNode";
import { Logs } from "../models/logs";
import { ChildProcessWithoutNullStreams } from "child_process";
import { CxCommandOutput } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxCommandOutput";
import CxLearnMoreDescriptions from "@checkmarx/ast-cli-javascript-wrapper/dist/main/learnmore/CxLearnMoreDescriptions";
import CxAsca from "@checkmarx/ast-cli-javascript-wrapper/dist/main/asca/CxAsca";
import { CxConfig } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import CxOssResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import CxIacResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/iacRealtime/CxIac";


export interface CxPlatform {
  /**
   * Creates a sca local scan and returns a list of sca
   * results retrieved from running the sca realtime command
   * @param sourcePath Path to the project to be scanned.
   * @return List of sca results.
   */
  scaScanCreate(sourcePath: string): Promise<CxScaRealtime | undefined>;

  /**
   * Creates a scan in cx one platform
   * @param projectName Name of the project to associate the scan to.
   * @param branchName Name of the branch to associate the scan to.
   * @param sourcePath Path to the project to be scanned.
   */
  scanCreate(projectName: string, branchName: string, sourcePath: string);

  /**
   * Cancels a scan started from the vscode extension in the cx one platform.
   * @param scanId The scan ID to be canceled.
   */
  scanCancel(scanId: string);

  /**
   * Get results for a specific scan from the cx one platform.
   * @param scanId The scan ID to retrieve the results.
   */
  getResults(scanId: string | undefined);

  /**
   * Get the scan information for a specific scan from the cx one platform.
   * @param scanId The scan ID to retrieve information.
   * @return A promise that when resolved returns a {@link CxScan}.
   */
  getScan(scanId: string | undefined): Promise<CxScan | undefined>;

  /**
   * Get the project information from the cx one platform.
   * @param projectId The project ID to retrieve information.
   * @return A promise that when resolved returns a {@link CxProject}.
   */
  getProject(projectId: string | undefined): Promise<CxProject | undefined>;

  /**
   * List projects available in the cx one platform.
   * @param params Additional parameters to search for projects.
   * @return A promise that when resolved returns a list of {@link CxProject}.
   */
  getProjectListWithParams(params: string): Promise<CxProject[] | undefined>;

  /**
   * Get the branch list for a specific project from the cx one platform.
   * @param projectId The project ID to retrieve information.
   * @return A promise that when resolved returns a list of {@link string} containing the branch names.
   */
  getBranchesWithParams(
    projectId: string | undefined,
    params: string | undefined
  ): Promise<string[] | undefined>;

  /**
   * Get the scan list for a specific project from the cx one platform.
   * @param projectId The project ID to retrieve the scan information.
   * @param branch The branch to retrieve the scan information.
   * @return A promise that when resolved returns a list of {@link CxScan}.
   */
  getScans(
    projectId: string | undefined,
    branch: string | undefined
  ): Promise<CxScan[] | undefined>;

  /**
   * Get additional parameters from the extension settings to be sent to the cli.
   */
  getBaseAstConfiguration();

  /**
   * Get the API key from the extension settings to be sent to the cli for authentication.
   */
  getAstConfiguration(): Promise<CxConfig | undefined>;

  /**
   * Check if the scan from IDE functionality is enabled.
   * @param logs The extension logger to print information to the user in the extension's output tab.
   * @return A promise that when resolved returns a {@link Boolean} with the scan enablement state.
   */
  isScanEnabled(logs: Logs): Promise<boolean>;

  /**
   * Check if the SCA scan from IDE is active.
   * @param logs The extension logger to print information to the user in the extension's output tab.
   * @return A promise that when resolved returns a {@link Boolean} with the SCA scan enablement state.
   */
  isSCAScanEnabled(logs: Logs): Promise<boolean>;

  /**
   * List the information about triage (used on the changes tab).
   * @param projectId The project ID to retrieve information.
   * @param similarityId The result's similarity ID to retrieve information.
   * @param scanType The result's scan type (sca,sast,kics) to retrieve information.
   * @return A promise that when resolved returns a list with all the triage actions that were performed over a specific result.
   */
  triageShow(projectId: string, similarityId: string, scanType: string);

  /**
   * Update the information about a results by applying triage (used on the changes tab).
   * @param projectId The project ID to update information.
   * @param similarityId The result's similarity ID to update information.
   * @param scanType The result's scan type (sca,sast,kics) to update information.
   * @param state The result's state to register in the triage.
   * @param comment The result's comment to register in the triage.
   * @param severity The result's severity to register in the triage.
   * @return A promise that when resolved returns the status of the triage update in the platform.
   */
  triageUpdate(
    projectId: string,
    similarityId: string,
    scanType: string,
    state: string,
    comment: string,
    severity: string,
    stateId: number
  ): Promise<number>;

  /**
   * Get the codebashing link lession for a specific result.
   * @param cweId The result's cweId ID to retrieve the link.
   * @param language The result's language to retrieve the link.
   * @param queryName The result's queryName to retrieve the link.
   * @return A promise that when resolved returns a {@link CxCodeBashing} that contains the codebashing link information.
   */

  triageGetStates(all: boolean): Promise<CxCommandOutput>;

  getCodeBashing(
    cweId: string,
    language: string,
    queryName: string
  ): Promise<CxCodeBashing | undefined>;

  /**
   * Get the best fix location information for a specific result.
   * @param scanId The result's scan ID to retrieve the bfl information.
   * @param queryId The result's query ID to retrieve the bfl information.
   * @param resultNodes The list of SAST result nodes to retrieve the bfl information.
   * @return A promise that when resolved returns the best fix location in the result's nodes path.
   */
  getResultsBfl(scanId: string, queryId: string, resultNodes: SastNode[]);

  /**
   * Get a list of results from running a local KICS scan from the cli.
   * @param fileSources Path to the file to be scanned.
   * @param additionalParams Additional parameters supported by KICS (optional parameter).
   * @return A promise that when resolved returns the list of KICS results.
   */
  getResultsRealtime(
    fileSources: string,
    additionalParams: string
  ): Promise<[Promise<CxCommandOutput>, ChildProcessWithoutNullStreams]>;

  /**
   * Applies remediation for a SCA result.
   * @param packageFile Package file name to be fixed.
   * @param packages The package name(s) to be fixed.
   * @param packageVersion The package version to be fixed.
   */
  scaRemediation(packageFile: string, packages: string, packageVersion: string);

  /**
   * Applies remediation for a KICS realtime result.
   * @param resultsFile Path to the KICS realtime results file.
   * @param kicsFile Path to the KICS realtime file where the fix needs to be applied.
   * @param engine The container engine name (example : docker,podman, etc...).
   * @param similarityIds The results similarity ID(s) to be fixed (optional, since if none is provided all the available fixes will be applied).
   * @return A promise that when resolved returns the docker process reference as well as the cli output for the remediation command.
   */
  kicsRemediation(
    resultsFile: string,
    kicsFile: string,
    engine: string,
    similarityIds?: string
  ): Promise<[Promise<CxCommandOutput>, ChildProcessWithoutNullStreams]>;

  /**
   * Gets the learn more information from cx one platform for a specific result.
   * @param queryID The result's query ID to retrieve the learn more information.
   * @return A promise that when resolved returns the learn more information.
   */
  learnMore(queryID: string): Promise<CxLearnMoreDescriptions[] | undefined>;

  /**
   * Updates the vscode status bar item.
   * @param text The text to display in the status bar.
   * @param show A {@link Boolean} value that controls if the status bar visibility.
   * @param statusBarItem The {@link vscode.StatusBarItem} associated with the results.
   */
  updateStatusBarItem(
    text: string,
    show: boolean,
    statusBarItem: vscode.StatusBarItem
  );

  /**
   * install the ASCA engine
   */
  installAsca(): Promise<CxAsca>;

  /**
   * Scan the edited file in the ASCA engine and show the results in the problem section
   * @param sourcePath the edited file sent to the ASCA engine
   */
  scanAsca(sourcePath: string, ignorePath: string): Promise<CxAsca>;

  ossScanResults(sourcePath: string, ignoredFilePath?: string): Promise<CxOssResult[] | undefined>;

  /**
   * Scan the edited file in the Containers engine and show the results in the problem section
   * @param sourcePath the edited file sent to the Containers engine
   */
  scanContainers(sourcePath: string, ignoredFilePath): Promise<any>;

  iacScanResults(sourcePath: string, dockerProvider: string, ignoredFilePath?: string): Promise<CxIacResult[] | undefined>;

  authValidate(logs: Logs): Promise<boolean>;

  getRiskManagementResults(projectId: string, scanId: string): Promise<object | undefined>;

  sendAIFixOutcomeTelemetry(
    eventType: string,
    scannerType: string,
    severity: string,
    mcpSuggestedVersion?: string,
    actualVersion?: string,
    retryCount?: number,
    additionalData?: string
  ): Promise<void>;
}