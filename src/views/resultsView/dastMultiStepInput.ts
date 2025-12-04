/*---------------------------------------------------------------------------------------------
 *  DAST Multi-step Input - Environment → Scan picker for DAST scans
 *--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { commands } from "../../utils/common/commands";
import { constants } from "../../utils/common/constants";
import {
  CxQuickPickItem,
} from "../../utils/pickers/multiStepUtils";
import { DastApiService, DastEnvironment } from "../../services/dastApiService";

/**
 * Extended picker item that includes the full environment data
 */
interface EnvironmentPickItem extends CxQuickPickItem {
  environment?: DastEnvironment;
}

/**
 * Fetch DAST environments from the API with optional search
 * Returns extended picker items that include the full environment data
 */
async function fetchEnvironments(logs: Logs, context: vscode.ExtensionContext, search?: string): Promise<EnvironmentPickItem[]> {
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
        description: `${env.url}${riskInfo}${statusInfo}`,
        environment: env  // Include full environment data for lastScanID access
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
): Promise<EnvironmentPickItem | undefined> {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve) => {
    const quickPick = vscode.window.createQuickPick<EnvironmentPickItem>();
    quickPick.title = constants.dastScanPickerTitle;
    quickPick.placeholder = "Type to search environments...";
    quickPick.busy = true;
    quickPick.show();

    // Debounce timer for search
    let searchTimer: NodeJS.Timeout | undefined;
    const debounceMs = 300;
    let resolved = false; // Prevent double resolution

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
      if (resolved) {return;}
      resolved = true;
      
      const selected = quickPick.selectedItems[0];
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
      quickPick.hide();
      quickPick.dispose();
      resolve(selected);
    });

    // Handle dismiss (Escape or click outside)
    quickPick.onDidHide(() => {
      if (resolved) {return;}
      resolved = true;
      
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
      quickPick.dispose();
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

/**
 * Pick only a DAST scan for the currently selected environment
 */
export async function dastScanPicker(
  logs: Logs,
  context: vscode.ExtensionContext
) {
  // Get the currently selected environment
  const currentEnv = context.workspaceState.get<{ id: string; name: string }>(constants.environmentIdKey);

  if (!currentEnv || !currentEnv.id) {
    vscode.window.showWarningMessage("Please select an environment first");
    return;
  }

  logs.info(`Picking DAST scan for environment: ${currentEnv.id}`);

  // Show scan picker
  const scanItems = await getDastScansPickItems(logs, currentEnv.id, context);

  const selectedScan = await vscode.window.showQuickPick(scanItems, {
    title: constants.dastScanPickerTitle,
    placeHolder: constants.scanPlaceholder,
  });

  if (!selectedScan || !selectedScan.id) {
    logs.info("Scan selection cancelled or invalid");
    return;
  }

  logs.info(`Selected scan: ${selectedScan.label} (${selectedScan.id})`);

  // Store scan in state
  await context.workspaceState.update(constants.scanIdKey, {
    id: selectedScan.id,
    name: `${constants.scanLabel} ${selectedScan.label}`,
    displayScanId: `${constants.scanLabel} ${selectedScan.formattedId}`,
    scanDatetime: selectedScan.datetime
  });

  // Refresh tree to show selected scan
  await vscode.commands.executeCommand(commands.refreshTree);
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

  // Save environment immediately so it shows in the tree
  await context.workspaceState.update(constants.environmentIdKey, {
    id: selectedEnvironment.id,
    name: `${constants.environmentLabel} ${selectedEnvironment.label}`,
    displayScanId: undefined,
    scanDatetime: undefined
  });
  
  // Clear previous scan selection when environment changes
  await context.workspaceState.update(constants.scanIdKey, undefined);
  
  // Refresh tree to show selected environment
  await vscode.commands.executeCommand(commands.refreshTree);

  // Check if environment has a lastScanID - auto-select it
  const lastScanId = selectedEnvironment.environment?.lastScanID;
  if (lastScanId) {
    logs.info(`Environment has lastScanID: ${lastScanId}, auto-selecting...`);
    
    // Fetch scan details to get proper display info
    const dastService = DastApiService.getInstance(context);
    const scan = await dastService.getScan(lastScanId, selectedEnvironment.id);
    
    if (scan) {
      const formattedDate = new Date(scan.created).toLocaleDateString() + " " + new Date(scan.created).toLocaleTimeString();
      
      // Store scan in state
      await context.workspaceState.update(constants.scanIdKey, {
        id: scan.scanId,
        name: `${constants.scanLabel} DAST Scan - ${formattedDate}`,
        displayScanId: `${constants.scanLabel} ${scan.scanId.substring(0, 8)}`,
        scanDatetime: scan.created
      });

      vscode.window.showInformationMessage(`Auto-selected latest scan from ${selectedEnvironment.label}`);
      await vscode.commands.executeCommand(commands.refreshTree);
      return;
    }
  }

  // No lastScanID or couldn't fetch it - show scan picker
  logs.info("No lastScanID found, showing scan picker...");
  const scanItems = await getDastScansPickItems(logs, selectedEnvironment.id, context);

  const selectedScan = await vscode.window.showQuickPick(scanItems, {
    title: constants.dastScanPickerTitle,
    placeHolder: constants.scanPlaceholder,
  });

  if (!selectedScan || !selectedScan.id) {
    logs.info("Scan selection cancelled or invalid");
    // Environment is still saved, just no scan selected
    return;
  }

  logs.info(`Selected scan: ${selectedScan.label} (${selectedScan.id})`);

  // Store scan in state - await the save
  await context.workspaceState.update(constants.scanIdKey, {
    id: selectedScan.id,
    name: `${constants.scanLabel} ${selectedScan.label}`,
    displayScanId: `${constants.scanLabel} ${selectedScan.formattedId}`,
    scanDatetime: selectedScan.datetime
  });

  // TODO: Load DAST results - for now show a message
  vscode.window.showInformationMessage(`DAST POC: Would load results for scan ${selectedScan.id} from environment ${selectedEnvironment.label}`);
  
  // Refresh tree to show selected scan
  await vscode.commands.executeCommand(commands.refreshTree);
}

