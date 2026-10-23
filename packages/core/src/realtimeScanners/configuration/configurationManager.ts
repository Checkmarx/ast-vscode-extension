import * as vscode from "vscode";
import { IScannerConfig } from "../common/types";
import { Logs } from "../../models/logs";
import { PropertiesFileManager } from "../../utils/propertiesFileManager";
import { constants } from "../../utils/common/constants";
import { getExtensionType, EXTENSION_TYPE } from "../../config/extensionConfig";

export class ConfigurationManager {
  private propertiesManager: PropertiesFileManager;

  constructor(private logs: Logs) {
    this.propertiesManager = new PropertiesFileManager(logs);
  }

  isScannerActive(config: IScannerConfig): boolean {
    return vscode.workspace
      .getConfiguration(config.configSection)
      .get(config.activateKey) as boolean;
  }

  async getIdeCopilotSelfHealingEnabled(): Promise<boolean> {
    const configSection = getExtensionType() === EXTENSION_TYPE.CHECKMARX ? 'Checkmarx' : 'Checkmarx Developer Assist';
    return vscode.workspace
      .getConfiguration(configSection)
      .get(constants.activateIdeCopilotSelfHealing) as boolean;
  }

  registerConfigChangeListener(callback: (configSection: (section: string, scope?: vscode.ConfigurationScope) => boolean) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(async (event) => {
      callback(event.affectsConfiguration);

      await this.syncSettingsToPropertiesFile();
    });
  }

  async syncSettingsToPropertiesFile(): Promise<void> {
    const settings = new Map<string, boolean>();

    const ascaConfig: IScannerConfig = {
      engineName: constants.ascaRealtimeScannerEngineName,
      configSection: constants.getAscaRealtimeScanner(),
      activateKey: constants.activateAscaRealtimeScanner,
      enabledMessage: constants.ascaRealtimeScannerStart,
      disabledMessage: constants.ascaRealtimeScannerDisabled,
      errorMessage: constants.errorAscaScanRealtime,
    };

    const ossConfig: IScannerConfig = {
      engineName: constants.ossRealtimeScannerEngineName,
      configSection: constants.getOssRealtimeScanner(),
      activateKey: constants.activateOssRealtimeScanner,
      enabledMessage: constants.ossRealtimeScannerStart,
      disabledMessage: constants.ossRealtimeScannerDisabled,
      errorMessage: constants.errorOssScanRealtime,
    };

    const secretsConfig: IScannerConfig = {
      engineName: constants.secretsScannerEngineName,
      configSection: constants.getSecretsScanner(),
      activateKey: constants.activateSecretsScanner,
      enabledMessage: constants.secretsScannerStart,
      disabledMessage: constants.secretsScannerDisabled,
      errorMessage: constants.errorSecretsScanRealtime,
    };

    const iacConfig: IScannerConfig = {
      engineName: constants.iacRealtimeScannerEngineName,
      configSection: constants.getIacRealtimeScanner(),
      activateKey: constants.activateIacRealtimeScanner,
      enabledMessage: constants.iacRealtimeScannerStart,
      disabledMessage: constants.iacRealtimeScannerDisabled,
      errorMessage: constants.errorIacScanRealtime,
    };

    settings.set("cx_asca_scanner_enabled", this.isScannerActive(ascaConfig));
    settings.set("cx_sca_scanner_enabled", this.isScannerActive(ossConfig));
    settings.set("cx_secret_scanner_enabled", this.isScannerActive(secretsConfig));
    settings.set("cx_kics_scanner_enabled", this.isScannerActive(iacConfig));
    settings.set("copilot_self_healing_enabled", await this.getIdeCopilotSelfHealingEnabled());

    await this.propertiesManager.updateScannerSettings(settings);
  }
}