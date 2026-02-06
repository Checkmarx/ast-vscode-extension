import * as vscode from "vscode";
import { cx } from "../../cx/index";

export class riskManagementService {
  private static instance: riskManagementService;
  private context: vscode.ExtensionContext;
  private constructor(extensionContext: vscode.ExtensionContext) {
    this.context = extensionContext;
  }

  public static getInstance(
    extensionContext: vscode.ExtensionContext
  ): riskManagementService {
    if (!this.instance) {
      this.instance = new riskManagementService(extensionContext);
    }
    return this.instance;
  }

  public getRiskManagementResults(
    projectId: string,
    scanId: string
  ): Promise<object> {
    return cx.getRiskManagementResults(projectId, scanId);
  }

  public async checkIfLatestScan(
    projectId: string,
    scanId: string
  ): Promise<boolean> {
    try {
      const scans = await cx.getScans(projectId, undefined, 1, "Completed");
      return scanId === scans[0]?.id;
    } catch (e) {
      throw new Error(e);
    }
  }
}
