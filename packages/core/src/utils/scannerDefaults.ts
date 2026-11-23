import * as vscode from "vscode";

/** globalState key: set once the default scanner state has been applied for this install. */
export const SCANNERS_INITIALIZED_KEY = "cxScannersInitialized";

/** True when the setting has a value in some scope, which means it is the user's choice. */
export function isSettingExplicitlySet(config: vscode.WorkspaceConfiguration, key: string): boolean {
  const info = config.inspect(key);
  if (!info) {
    return false;
  }
  return (
    info.globalValue !== undefined ||
    info.workspaceValue !== undefined ||
    info.workspaceFolderValue !== undefined
  );
}

/**
 * Onboarding default, applied at most once per install: when AI/MCP is enabled, turns ON every scanner
 * the user has never set. A scanner the user turned ON or OFF is never changed, and nothing is ever
 * turned OFF here. Once applied, later calls do nothing, so the user's choices survive logout and restart.
 */
export async function applyDefaultScannerSettingsOnce(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  scannerConfigKeys: string[],
  aiEnabled: boolean
): Promise<void> {
  if (!aiEnabled || context.globalState.get<boolean>(SCANNERS_INITIALIZED_KEY, false)) {
    return;
  }
  for (const key of scannerConfigKeys) {
    if (!isSettingExplicitlySet(config, key)) {
      await config.update(key, true, vscode.ConfigurationTarget.Global);
    }
  }
  await context.globalState.update(SCANNERS_INITIALIZED_KEY, true);
}
