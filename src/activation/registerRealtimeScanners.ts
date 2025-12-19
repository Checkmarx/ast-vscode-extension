import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { ConfigurationManager } from "../realtimeScanners/configuration/configurationManager";
import { ScannerRegistry } from "../realtimeScanners/scanners/scannerRegistry";
import { constants } from "../utils/common/constants";
import { IgnoreFileManager } from "../realtimeScanners/common/ignoreFileManager";
import { OssScannerCommand } from "../realtimeScanners/scanners/oss/ossScannerCommand";
import { SecretsScannerCommand } from "../realtimeScanners/scanners/secrets/secretsScannerCommand";
import { IacScannerCommand } from "../realtimeScanners/scanners/iac/iacScannerCommand";
import { AscaScannerCommand } from "../realtimeScanners/scanners/asca/ascaScannerCommand";
import { ContainersScannerCommand } from "../realtimeScanners/scanners/containers/containersScannerCommand";

export async function registerRealtimeScanners(context: vscode.ExtensionContext, logs: Logs) {
  const configManager = new ConfigurationManager();
  const scannerRegistry = new ScannerRegistry(context, logs, configManager);
  await scannerRegistry.activateAllScanners();
  const configListener = configManager.registerConfigChangeListener((section) => {
    const ossEffected = section(`${constants.ossRealtimeScanner}.${constants.activateOssRealtimeScanner}`);
    if (ossEffected) {
      scannerRegistry.getScanner(constants.ossRealtimeScannerEngineName)?.register();
      return;
    }
    const secretsEffected = section(`${constants.secretsScanner}.${constants.activateSecretsScanner}`);
    if (secretsEffected) {
      scannerRegistry.getScanner(constants.secretsScannerEngineName)?.register();
      return;
    }
    const ascaEffected = section(`${constants.ascaRealtimeScanner}.${constants.activateAscaRealtimeScanner}`);
    if (ascaEffected) {
      scannerRegistry.getScanner(constants.ascaRealtimeScannerEngineName)?.register();
      return;
    }
    const containersEffected = section(`${constants.containersRealtimeScanner}.${constants.activateContainersRealtimeScanner}`);
    if (containersEffected) {
      scannerRegistry.getScanner(constants.containersRealtimeScannerEngineName)?.register();
      return;
    }
    const iacEffected = section(`${constants.iacRealtimeScanner}.${constants.activateIacRealtimeScanner}`);
    if (iacEffected) {
      scannerRegistry.getScanner(constants.iacRealtimeScannerEngineName)?.register();
      return;
    }
  });
  context.subscriptions.push(configListener);

  const ignoreFileManager = IgnoreFileManager.getInstance();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    ignoreFileManager.initialize(workspaceFolder);
  }

  const ossCommand = scannerRegistry.getScanner(constants.ossRealtimeScannerEngineName) as OssScannerCommand;
  const ossScanner = ossCommand.getScannerService();
  const secretCommand = scannerRegistry.getScanner(constants.secretsScannerEngineName) as SecretsScannerCommand;
  const secretScanner = secretCommand.getScannerService();
  const iacCommand = scannerRegistry.getScanner(constants.iacRealtimeScannerEngineName) as IacScannerCommand;
  const iacScanner = iacCommand.getScannerService();
  const ascaCommand = scannerRegistry.getScanner(constants.ascaRealtimeScannerEngineName) as AscaScannerCommand;
  const ascaScanner = ascaCommand.getScannerService();
  const containersCommand = scannerRegistry.getScanner(constants.containersRealtimeScannerEngineName) as ContainersScannerCommand;
  const containersScanner = containersCommand.getScannerService();

  ignoreFileManager.setOssScannerService(ossScanner);
  ignoreFileManager.setSecretsScannerService(secretScanner);
  ignoreFileManager.setIacScannerService(iacScanner);
  ignoreFileManager.setAscaScannerService(ascaScanner);
  ignoreFileManager.setContainersScannerService(containersScanner);
  context.subscriptions.push({ dispose: () => ignoreFileManager.dispose() });

  return { scannerRegistry, ignoreFileManager, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner };
}
