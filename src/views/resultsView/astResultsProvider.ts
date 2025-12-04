import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  constants
} from "../../utils/common/constants";
import { getResultsFilePath, readResultsFromFile } from "../../utils/utils";
import { Logs } from "../../models/logs";
import { getFromState, Item, updateState } from "../../utils/common/globalState";
import { cx } from "../../cx";
import { commands } from "../../utils/common/commands";
import { TreeItem } from "../../utils/tree/treeItem";
import { FilterCommand } from "../../commands/filterCommand";
import { GroupByCommand } from "../../commands/groupByCommand";
import { messages } from "../../utils/common/messages";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import { getResultsWithProgress } from "../../utils/pickers/pickers";
import { ResultsProvider } from "../resultsProviders";
import { riskManagementView } from '../riskManagementView/riskManagementView';
import { DastApiService, AlertLevelResult, AlertInstance } from "../../services/dastApiService";

export class AstResultsProvider extends ResultsProvider {
  public process;
  public loadedResults: CxResult[];
  private scan: Item | undefined;
  private riskManagementView: riskManagementView;

  constructor(
    protected readonly context: vscode.ExtensionContext,
    private readonly logs: Logs,
    protected readonly statusBarItem: vscode.StatusBarItem,
    private readonly diagnosticCollection: vscode.DiagnosticCollection,
    private readonly filterCommand: FilterCommand,
    private readonly groupByCommand: GroupByCommand
  ) {
    super(context, statusBarItem);
    this.loadedResults = undefined;

    this.riskManagementView = new riskManagementView(context.extensionUri, context);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'riskManagement',
        this.riskManagementView
      )
    );

    // Syncing with AST everytime the extension gets opened
    this.openRefreshData()
      .then(() => logs.info(messages.dataRefreshed));
  }

  async clean(): Promise<void> {
    this.logs.info(messages.clearLoadedInfo);
    const resultJsonPath = path.join(__dirname, "ast-results.json");
    if (fs.existsSync(resultJsonPath)) {
      fs.unlinkSync(resultJsonPath);
    }
    updateState(this.context, constants.scanIdKey, undefined);
    updateState(this.context, constants.projectIdKey, undefined);
    updateState(this.context, constants.branchIdKey, undefined);
    await this.refreshData();
  }

  async refreshData(): Promise<void> {
    this.showStatusBarItem(messages.commandRunning);
    const treeItem = await this.generateTree();
    this.data = await cx.isValidConfiguration() ? treeItem.children : [];
    this._onDidChangeTreeData.fire(undefined);
    this.hideStatusBarItem();
  }

  async openRefreshData(): Promise<void> {
    this.showStatusBarItem(messages.commandRunning);
    this.loadedResults = undefined;
    const scanIDItem = getFromState(this.context, constants.scanIdKey);
    let scanId = undefined;
    if (scanIDItem && scanIDItem.name) {
      scanId = getFromState(this.context, constants.scanIdKey).name;
    }
    if (scanId) {
      await getResultsWithProgress(this.logs, scanId);
      await vscode.commands.executeCommand(commands.refreshTree);
      this.hideStatusBarItem();
    }
  }

  async generateTree(): Promise<TreeItem> {
    const scanMode = this.getCurrentScanMode();

    // Handle DAST mode separately
    if (scanMode === constants.scanModeDast) {
      return this.generateDastTree();
    }

    // SAST/SCA mode - original logic
    return this.generateSastTree();
  }

  private async generateSastTree(): Promise<TreeItem> {
    const resultJsonPath = getResultsFilePath();
    this.diagnosticCollection.clear();
    // createBaseItems
    let treeItems = this.createRootItems();
    // get scan from state
    this.scan = getFromState(this.context, constants.scanIdKey);
    const fromTriage = getFromState(this.context, constants.triageUpdate)?.id;
    // Case we come from triage we want to use the loaded results which were modified in triage
    if (fromTriage === undefined || !fromTriage) {
      // in case we scanId, it is needed to load them from the json file
      if (this.scan?.id) {
        this.loadedResults = await readResultsFromFile(resultJsonPath, this.scan?.id)
          .catch((error) => {
            this.logs.error(`Error reading results: ${error.message}`);
            return undefined;
          });
      }
      // otherwise the results must be cleared
      else {
        this.loadedResults = undefined;
        this.riskManagementView.updateContent();
      }
    }
    // Case we come from triage we must update the state to load results from the correct place
    else {
      updateState(this.context, constants.triageUpdate, {
        id: false, name: constants.triageUpdate,
        scanDatetime: "",
        displayScanId: ""
      });
    }

    // if there are results loaded, the tree needs to be recreated
    if (this.loadedResults !== undefined) {

      // Update the risks management webview with project info
      const project = getFromState(this.context, constants.projectIdKey);
      this.riskManagementView.updateContent({ project, scan: this.scan, cxResults: this.loadedResults });

      const newItem = new TreeItem(`${this.scan.scanDatetime}`, constants.calendarItem);
      treeItems = treeItems.concat(newItem);

      if (this.loadedResults.length !== 0) {
        treeItems = treeItems.concat(this.createSummaryItem(this.loadedResults));
      }

      const treeItem = this.groupBy(
        this.loadedResults,
        this.groupByCommand.activeGroupBy,
        this.scan?.id,
        this.diagnosticCollection,
        this.filterCommand.getAtiveSeverities(),
        this.filterCommand.getActiveStates()
      );
      treeItem.label = "Scan"; // `${constants.scanLabel}`;

      if (treeItem.children.length === 0) {
        treeItem.children.push(new TreeItem(constants.scaNoVulnerabilities, undefined));
      }

      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      treeItems = treeItems.concat(treeItem);
    }
    return new TreeItem("", undefined, undefined, treeItems);
  }

  private async generateDastTree(): Promise<TreeItem> {
    this.diagnosticCollection.clear();
    let treeItems = this.createRootItems();

    // Get environment and scan from state
    const envFromState = getFromState(this.context, constants.environmentIdKey);
    const scanFromState = getFromState(this.context, constants.scanIdKey);

    // Get DAST scan details from state
    const dastScanDetails = this.context.workspaceState.get<{
      scanId: string;
      created: string;
      lastStatus: string;
      riskLevel: { criticalCount: number; highCount: number; mediumCount: number; lowCount: number; infoCount: number };
      alertRiskLevel: { criticalCount: number; highCount: number; mediumCount: number; lowCount: number; infoCount: number };
      riskRating: string;
      scanDuration: number;
      hasResults: boolean;
    }>(constants.dastScanDetailsKey);

    if (dastScanDetails) {
      // Add scan date
      const scanDate = new Date(dastScanDetails.created);
      const formattedDate = scanDate.toLocaleDateString() + " " + scanDate.toLocaleTimeString();
      treeItems = treeItems.concat(new TreeItem(formattedDate, constants.calendarItem));

      // Add scan status
      if (dastScanDetails.lastStatus) {
        treeItems = treeItems.concat(new TreeItem(`Status: ${dastScanDetails.lastStatus}`, constants.statusItem));
      }

      // Fetch and display alerts if we have environment and scan IDs
      if (envFromState?.id && scanFromState?.id) {
        try {
          const dastService = DastApiService.getInstance(this.context);
          const { alerts, total } = await dastService.getAlerts(envFromState.id, scanFromState.id);

          if (alerts.length > 0) {
            // Group alerts by severity
            const alertsBySeverity = this.groupAlertsBySeverity(alerts);

            const resultsNode = new TreeItem(`Results (${total})`, "summary-item", undefined, []);
            resultsNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

            // Add severity groups with instances
            for (const [severity, severityAlerts] of Object.entries(alertsBySeverity)) {
              if (severityAlerts.length > 0) {
                const severityNode = await this.createSeverityNodeWithInstances(
                  severity,
                  severityAlerts,
                  dastService,
                  envFromState.id,
                  scanFromState.id
                );
                resultsNode.children?.push(severityNode);
              }
            }

            treeItems = treeItems.concat(resultsNode);
          } else {
            treeItems = treeItems.concat(new TreeItem("No vulnerabilities found", undefined));
          }
        } catch (error) {
          this.logs.error(`Failed to fetch DAST alerts: ${error}`);
          treeItems = treeItems.concat(new TreeItem("Error loading results", "error"));
        }
      }
    }

    return new TreeItem("", undefined, undefined, treeItems);
  }

  /**
   * Group alerts by severity level
   */
  private groupAlertsBySeverity(alerts: AlertLevelResult[]): Record<string, AlertLevelResult[]> {
    const groups: Record<string, AlertLevelResult[]> = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
      INFO: []
    };

    for (const alert of alerts) {
      const severity = alert.severity || "Informational";
      if (groups[severity]) {
        groups[severity].push(alert);
      } else {
        groups["Informational"].push(alert);
      }
    }

    return groups;
  }

  /**
   * Create a tree node for a severity level with its alerts
   */
  private createSeverityNode(severity: string, alerts: AlertLevelResult[]): TreeItem {
    const severityIconMap: Record<string, string> = {
      "CRITICAL": "critical-severity",
      "HIGH": "high-severity",
      "MEDIUM": "medium-severity",
      "LOW": "low-severity",
      "INFO": "info-severity"
    };

    const alertItems = alerts.map(alert => {
      const instanceText = alert.numInstances === 1 ? "1 instance" : `${alert.numInstances} instances`;
      const alertNode = new TreeItem(
        alert.name,
        "dast-alert-item",
        undefined,
        []
      );
      alertNode.description = `${instanceText} | ${alert.state}`;
      alertNode.tooltip = `${alert.name}\nSeverity: ${alert.severity}\nInstances: ${alert.numInstances}\nState: ${alert.state}\nStatus: ${alert.status}${alert.owasp?.length ? '\nOWASP: ' + alert.owasp.join(', ') : ''}`;

      // Store alert data for potential click handling
      alertNode.contextValue = "dast-alert-item";

      return alertNode;
    });

    const severityNode = new TreeItem(
      `${severity} (${alerts.length})`,
      severityIconMap[severity] || "info-severity",
      undefined,
      alertItems
    );
    severityNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    return severityNode;
  }

  /**
   * Create a tree node for a severity level with its alerts and instances
   */
  private async createSeverityNodeWithInstances(
    severity: string,
    alerts: AlertLevelResult[],
    dastService: DastApiService,
    environmentId: string,
    scanId: string
  ): Promise<TreeItem> {
    const severityIconMap: Record<string, string> = {
      "CRITICAL": "critical-severity",
      "HIGH": "high-severity",
      "MEDIUM": "medium-severity",
      "LOW": "low-severity",
      "INFO": "info-severity"
    };

    // Build alert items with instances
    const alertItems: TreeItem[] = [];

    for (const alert of alerts) {
      const instanceText = alert.numInstances === 1 ? "1 instance" : `${alert.numInstances} instances`;

      // Fetch instances for this alert
      let instanceNodes: TreeItem[] = [];
      try {
        const { instances } = await dastService.getAlertInstances(
          environmentId,
          scanId,
          alert.alertSimilarityId,
          1,
          20  // Limit to first 20 instances
        );

        instanceNodes = instances.map(instance => this.createInstanceNode(instance, alert, environmentId, scanId));

        // Add "more..." indicator if there are more instances
        if (alert.numInstances > 20) {
          instanceNodes.push(new TreeItem(`... and ${alert.numInstances - 20} more`, "more-items"));
        }
      } catch (error) {
        this.logs.error(`Failed to fetch instances for alert ${alert.alertSimilarityId}: ${error}`);
        instanceNodes = [new TreeItem("Error loading instances", "error")];
      }

      const alertNode = new TreeItem(
        alert.name,
        "dast-alert-item",
        undefined,
        instanceNodes
      );
      alertNode.description = `${instanceText} | ${alert.state}`;
      alertNode.tooltip = `${alert.name}\nSeverity: ${alert.severity}\nInstances: ${alert.numInstances}\nState: ${alert.state}\nStatus: ${alert.status}${alert.owasp?.length ? '\nOWASP: ' + alert.owasp.join(', ') : ''}\n\n🤖 Click for AI triage & guidance`;
      alertNode.contextValue = "dast-alert-item";
      alertNode.collapsibleState = instanceNodes.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
      
      // Make alert clickable - trigger triage command
      alertNode.command = {
        command: commands.dastTriage,
        title: "Get AI Triage",
        arguments: [{
          alertSimilarityId: alert.alertSimilarityId,
          alertName: alert.name,
          severity: alert.severity,
          owasp: alert.owasp || [],
          numInstances: alert.numInstances,
          environmentId,
          scanId
        }]
      };

      alertItems.push(alertNode);
    }

    const severityNode = new TreeItem(
      `${severity} (${alerts.length})`,
      severityIconMap[severity] || "info-severity",
      undefined,
      alertItems
    );
    severityNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    return severityNode;
  }

  /**
   * Create a tree node for an alert instance
   */
  private createInstanceNode(
    instance: AlertInstance,
    alert: AlertLevelResult,
    environmentId: string,
    scanId: string
  ): TreeItem {
    const methodColors: Record<string, string> = {
      "GET": "dast-method-get",
      "POST": "dast-method-post",
      "PUT": "dast-method-put",
      "DELETE": "dast-method-delete",
      "PATCH": "dast-method-patch"
    };

    const instanceNode = new TreeItem(
      `${instance.method} ${instance.path}`,
      methodColors[instance.method] || "dast-instance-item",
      undefined,
      []
    );
    instanceNode.description = instance.status;
    instanceNode.tooltip = `Method: ${instance.method}\nPath: ${instance.path}\nURL: ${instance.url}\nStatus: ${instance.status}\n\n🤖 Click to get AI remediation`;
    instanceNode.contextValue = "dast-instance-item";

    // Make clickable - trigger remediation command
    instanceNode.command = {
      command: commands.dastRemediate,
      title: "Get AI Remediation",
      arguments: [{
        alertSimilarityId: alert.alertSimilarityId,
        alertName: alert.name,
        severity: alert.severity,
        owasp: alert.owasp,
        instance: {
          method: instance.method,
          path: instance.path,
          url: instance.url,
          status: instance.status
        },
        environmentId,
        scanId
      }]
    };

    return instanceNode;
  }

  createRootItems(): TreeItem[] {
    const scanMode = this.getCurrentScanMode();
    
    if (scanMode === constants.scanModeDast) {
      // DAST mode: Environment → Scan
      const envFromState = getFromState(this.context, constants.environmentIdKey);

      return [
        new TreeItem(
          `[DAST Mode]`,
          "dast-mode-indicator"
        ),
        new TreeItem(
          envFromState?.name ?? constants.environmentLabel,
          constants.environmentItem
        ),
        new TreeItem(
          `${getFromState(this.context, constants.scanIdKey)?.displayScanId ?? constants.scanLabel}`,
          constants.dastScanItem  // Use DAST-specific scan item
        )
      ];
    }
    
    // Default SAST/SCA mode: Project → Branch → Scan
    return [
      new TreeItem(
        getFromState(this.context, constants.projectIdKey)?.name ?? constants.projectLabel,
        constants.projectItem
      ),
      new TreeItem(
        getFromState(this.context, constants.branchIdKey)?.name ?? constants.branchLabel,
        constants.branchItem
      ),
      new TreeItem(
        `${getFromState(this.context, constants.scanIdKey)?.displayScanId ?? constants.scanLabel}`,
        constants.scanItem
      )
    ];
  }

  // Helper to get current scan mode
  private getCurrentScanMode(): string {
    const mode = getFromState(this.context, constants.scanModeKey);
    return mode?.id ?? constants.scanModeSast; // Default to SAST
  }
}
