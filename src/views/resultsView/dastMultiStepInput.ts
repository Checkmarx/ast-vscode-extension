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
import { DastApiService } from "../../services/dastApiService";

/**
 * Fetch DAST environments from the API with optional search
 */
async function fetchEnvironments(logs: Logs, context: vscode.ExtensionContext, search?: string): Promise<CxQuickPickItem[]> {
  try {
    const dastService = DastApiService.getInstance(context);
    const environments = await dastService.getEnvironments(1, 50, search);

    if (environments.length === 0) {
      return [{
        label: search ? `No environments matching "${search}"` : "No environments found",
        id: "",
        description: search ? "Try a different search term" : "Create an environment in Checkmarx One first"
      }];
    }

    return environments.map(env => {
      // Build description with domain, URL, and risk info
      const riskInfo = env.riskRating && env.riskRating !== "No risk"
        ? ` | ${env.riskRating}`
        : "";
      const statusInfo = env.lastStatus ? ` | Last: ${env.lastStatus}` : "";

      return {
        label: env.domain || env.url || "Unknown",
        id: env.environmentId,
        description: `${env.url}${riskInfo}${statusInfo}`
      };
    });
  } catch (error) {
    logs.error(`Failed to fetch DAST environments: ${error}`);
    return [{
      label: "Error loading environments",
      id: "",
      description: error.message || "Check your connection"
    }];
  }
}

/**
 * Show a searchable QuickPick for environments
 * Re-queries the API when the user types
 */
async function showSearchableEnvironmentPicker(
  logs: Logs,
  context: vscode.ExtensionContext
): Promise<CxQuickPickItem | undefined> {
  return new Promise(async (resolve) => {
    const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
    quickPick.title = constants.dastScanPickerTitle;
    quickPick.placeholder = "Type to search environments...";
    quickPick.busy = true;
    quickPick.show();

    // Debounce timer for search
    let searchTimer: NodeJS.Timeout | undefined;
    const debounceMs = 300;

    // Load initial environments
    logs.info("Loading initial DAST environments...");
    const initialItems = await fetchEnvironments(logs, context);
    quickPick.items = initialItems;
    quickPick.busy = false;

    // Handle search input with debouncing
    quickPick.onDidChangeValue(async (value) => {
      // Clear previous timer
      if (searchTimer) {
        clearTimeout(searchTimer);
      }

      // Debounce the search
      searchTimer = setTimeout(async () => {
        quickPick.busy = true;
        logs.info(`Searching DAST environments: "${value}"`);
        const items = await fetchEnvironments(logs, context, value || undefined);
        quickPick.items = items;
        quickPick.busy = false;
      }, debounceMs);
    });

    // Handle selection
    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0];
      quickPick.dispose();
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
      resolve(selected);
    });

    // Handle dismiss
    quickPick.onDidHide(() => {
      quickPick.dispose();
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
      resolve(undefined);
    });
  });
}

/**
 * Fetch DAST scans for a specific environment from the API
 */
async function getDastScansPickItems(logs: Logs, environmentId: string, context: vscode.ExtensionContext): Promise<CxQuickPickItem[]> {
  logs.info(`Fetching DAST scans for environment: ${environmentId}`);
  
  if (!environmentId) {
    return [{
      label: "No environment selected",
      id: "",
      description: "Please select an environment first"
    }];
  }

  try {
    const dastService = DastApiService.getInstance(context);
    const scans = await dastService.getScans(environmentId, 1, 50);

    if (scans.length === 0) {
      logs.info("No DAST scans found for this environment");
      return [{
        label: "No scans found",
        id: "",
        description: "Run a DAST scan in Checkmarx One first"
      }];
    }

    return scans.map(scan => {
      // Format date from created field
      const date = new Date(scan.created);
      const formattedDate = date.toLocaleDateString() + " " + date.toLocaleTimeString();

      // Build description with status and risk info
      const riskInfo = dastService.formatRiskLevel(scan.riskLevel);
      const durationInfo = scan.scanDuration > 0
        ? ` | ${Math.floor(scan.scanDuration / 60)}m`
        : "";

      return {
        label: `DAST Scan - ${formattedDate}`,
        id: scan.scanId,
        description: `${scan.lastStatus}${durationInfo} | ${riskInfo}`,
        datetime: scan.created,
        formattedId: scan.scanId.substring(0, 8) // Short ID for display
      };
    });
  } catch (error) {
    logs.error(`Failed to fetch DAST scans: ${error}`);
    vscode.window.showErrorMessage(`Failed to fetch DAST scans: ${error.message}`);

    return [{
      label: "Error loading scans",
      id: "",
      description: "Click to retry or check your connection"
    }];
  }
}

export async function dastMultiStepInput(
  logs: Logs,
  context: vscode.ExtensionContext
) {
  // Step 1: Pick environment with search support
  logs.info("Starting DAST environment selection...");
  const selectedEnvironment = await showSearchableEnvironmentPicker(logs, context);

  if (!selectedEnvironment || !selectedEnvironment.id) {
    logs.info("Environment selection cancelled or invalid");
    return;
  }

  logs.info(`Selected environment: ${selectedEnvironment.label} (${selectedEnvironment.id})`);

  // Step 2: Pick scan for the selected environment
  const scanItems = await getDastScansPickItems(logs, selectedEnvironment.id, context);

  const selectedScan = await vscode.window.showQuickPick(scanItems, {
    title: constants.dastScanPickerTitle,
    placeHolder: constants.scanPlaceholder,
  });

  if (!selectedScan || !selectedScan.id) {
    logs.info("Scan selection cancelled or invalid");
    return;
  }

  logs.info(`Selected scan: ${selectedScan.label} (${selectedScan.id})`);

  // Build state object for compatibility
  const state = {
    environment: selectedEnvironment,
    scanId: selectedScan,
  };
  
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

