/*---------------------------------------------------------------------------------------------
 *  DAST Multi-step Input - Environment → Scan picker for DAST scans
 *--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { commands } from "../../utils/common/commands";
import { constants } from "../../utils/common/constants";
import { updateState } from "../../utils/common/globalState";
import {
  CxQuickPickItem,
  MultiStepInput,
} from "../../utils/pickers/multiStepUtils";

// Mock data for POC - replace with actual API calls later
async function getEnvironmentsPickItems(logs: Logs, context: vscode.ExtensionContext): Promise<CxQuickPickItem[]> {
  logs.info("Fetching DAST environments...");
  
  // TODO: Replace with actual API call to fetch environments
  // const environments = await cx.getEnvironments();
  
  // Mock data for POC
  const mockEnvironments: CxQuickPickItem[] = [
    { label: "Production", id: "env-prod-001", description: "https://app.example.com" },
    { label: "Staging", id: "env-staging-001", description: "https://staging.example.com" },
    { label: "Development", id: "env-dev-001", description: "https://dev.example.com" },
    { label: "QA", id: "env-qa-001", description: "https://qa.example.com" },
  ];

  return mockEnvironments;
}

async function getDastScansPickItems(logs: Logs, environmentId: string, context: vscode.ExtensionContext): Promise<CxQuickPickItem[]> {
  logs.info(`Fetching DAST scans for environment: ${environmentId}`);
  
  // TODO: Replace with actual API call to fetch DAST scans for environment
  // const scans = await cx.getDastScans(environmentId);
  
  // Mock data for POC
  const mockScans: CxQuickPickItem[] = [
    { 
      label: "DAST Scan - Dec 4, 2024 10:30 AM", 
      id: "dast-scan-001", 
      description: "Completed - 12 vulnerabilities found",
      datetime: "2024-12-04T10:30:00Z",
      formattedId: "dast-scan-001"
    },
    { 
      label: "DAST Scan - Dec 3, 2024 2:15 PM", 
      id: "dast-scan-002", 
      description: "Completed - 8 vulnerabilities found",
      datetime: "2024-12-03T14:15:00Z",
      formattedId: "dast-scan-002"
    },
    { 
      label: "DAST Scan - Dec 2, 2024 9:00 AM", 
      id: "dast-scan-003", 
      description: "Completed - 15 vulnerabilities found",
      datetime: "2024-12-02T09:00:00Z",
      formattedId: "dast-scan-003"
    },
  ];

  return mockScans;
}

export async function dastMultiStepInput(
  logs: Logs,
  context: vscode.ExtensionContext
) {
  interface State {
    title: string;
    step: number;
    totalSteps: number;
    environment: CxQuickPickItem;
    scanId: CxQuickPickItem;
  }

  async function collectInputs() {
    const state = {} as Partial<State>;
    await MultiStepInput.run((input) => pickEnvironment(input, state));
    return state as State;
  }

  async function pickEnvironment(input: MultiStepInput, state: Partial<State>) {
    state.environment = await input.showQuickPick({
      title: constants.dastScanPickerTitle,
      step: 1,
      totalSteps: 2,
      placeholder: constants.environmentPlaceholder,
      items: await getEnvironmentsPickItems(logs, context),
      shouldResume: shouldResume,
    });
    return (input: MultiStepInput) => pickDastScan(input, state);
  }

  async function pickDastScan(input: MultiStepInput, state: Partial<State>) {
    let environmentId = "";
    if (state.environment && state.environment.id) {
      environmentId = state.environment.id;
    }

    state.scanId = await input.showQuickPick({
      title: constants.dastScanPickerTitle,
      step: 2,
      totalSteps: 2,
      placeholder: constants.scanPlaceholder,
      items: await getDastScansPickItems(logs, environmentId, context),
      shouldResume: shouldResume,
    });
  }

  function shouldResume() {
    return new Promise<boolean>(() => { });
  }

  const state = await collectInputs();
  
  // Store environment in state
  updateState(context, constants.environmentIdKey, {
    id: state.environment.id,
    name: `${constants.environmentLabel}${state.environment.label}`,
    displayScanId: undefined,
    scanDatetime: undefined
  });
  
  // Store scan in state (reusing existing scan state key)
  updateState(context, constants.scanIdKey, {
    id: state.scanId.id,
    name: `${constants.scanLabel}${state.scanId.label}`,
    displayScanId: `${constants.scanLabel}${state.scanId.formattedId}`,
    scanDatetime: state.scanId.datetime
  });

  if (state.scanId?.id) {
    // TODO: Load DAST results - for now show a message
    vscode.window.showInformationMessage(`DAST POC: Would load results for scan ${state.scanId.id} from environment ${state.environment.label}`);
    
    // TODO: Replace with actual DAST results loading
    // await getDastResultsWithProgress(logs, state.scanId.id);
    vscode.commands.executeCommand(commands.refreshTree);
  }
}

