import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { IScannerCommand } from "../common/types";
import { ConfigurationManager } from "../configuration/configurationManager";
import { OssScannerCommand } from "./oss/ossScannerCommand";

export class ScannerRegistry {
  private scanners: Map<string, IScannerCommand> = new Map();
  private configManager: ConfigurationManager;
  
  constructor(
    context: vscode.ExtensionContext,
    logs: Logs,
    configManager: ConfigurationManager
  ) {
    this.configManager = configManager;
    
    // Register all scanners here
    this.registerScanner("oss", new OssScannerCommand(context, logs, configManager));
  }
  
  registerScanner(id: string, scanner: IScannerCommand): void {
    this.scanners.set(id, scanner);
  }
  
  async activateAllScanners(): Promise<void> {
    for (const scanner of this.scanners.values()) {
      await scanner.register();
    }
  }
  
  async deactivateAllScanners(): Promise<void> {
    for (const scanner of this.scanners.values()) {
      await scanner.dispose();
    }
  }
  
  getScanner(id: string): IScannerCommand | undefined {
    return this.scanners.get(id);
  }
}