import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logs } from '../models/logs';
import * as vscode from 'vscode';

export class PropertiesFileManager {
  private static readonly PROPERTIES_FILE_NAME = 'cx-onboarding-vscode.properties';
  private static readonly PROPERTIES_DIR = '.checkmarx';

  private readonly propertiesFilePath: string;
  private logs: Logs;

  constructor(logs: Logs) {
    this.logs = logs;
    const homeDir = os.homedir();
    this.propertiesFilePath = path.join(homeDir, PropertiesFileManager.PROPERTIES_DIR, PropertiesFileManager.PROPERTIES_FILE_NAME);
  }

  async updateScannerSettings(settings: Map<string, boolean>): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureDirectoryExists();

      // Read existing properties or get empty map
      const properties = await this.readPropertiesFile();

      // Update with new values
      settings.forEach((value, key) => {
        properties.set(key, value.toString());
      });

      // Write back to file
      await this.writePropertiesFile(properties);

      this.logs.info(`Scanner settings synced to ${this.propertiesFilePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logs.warn(`Failed to sync scanner settings to properties file: ${errorMsg}`);

      // Show notification to user (non-blocking)
      if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
        vscode.window.showWarningMessage(
          `Unable to sync Checkmarx settings to ${this.propertiesFilePath}. Please check read/write permissions for ~/.checkmarx/ directory.`,
          'OK'
        );
      }
      // Fail silently - don't throw, don't block plugin
    }
  }

  private async readPropertiesFile(): Promise<Map<string, string>> {
    const properties = new Map<string, string>();

    try {
      if (!fs.existsSync(this.propertiesFilePath)) {
        return properties;
      }

      const content = await fs.promises.readFile(this.propertiesFilePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex > 0) {
          const key = trimmed.substring(0, equalsIndex).trim();
          const value = trimmed.substring(equalsIndex + 1).trim();
          properties.set(key, value);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logs.warn(`Error reading properties file: ${errorMsg}`);
    }

    return properties;
  }

  private async writePropertiesFile(properties: Map<string, string>): Promise<void> {
    try {
      let content = '# Checkmarx VSCode cx-devassist agentic plugin configuration\n\n';

      properties.forEach((value, key) => {
        content += `${key}=${value}\n`;
      });

      const tempFilePath = this.propertiesFilePath + '.tmp';
      await fs.promises.writeFile(tempFilePath, content, 'utf-8');

      await fs.promises.rename(tempFilePath, this.propertiesFilePath);
    } catch (error) {
      throw error;
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    const dir = path.dirname(this.propertiesFilePath);
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      throw error;
    }
  }
}
