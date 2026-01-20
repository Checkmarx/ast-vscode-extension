import * as vscode from 'vscode';
import { TreeItem } from '../../utils/tree/treeItem';
import { getFromState, updateState } from '../../utils/common/globalState';
import { constants, SeverityLevel } from '../../utils/common/constants';
import { GroupByCommand } from '../../commands/groupByCommand';
import { FilterCommand } from '../../commands/filterCommand';
import { Logs } from '../../models/logs';
import { ResultsProvider } from '../resultsProviders';
import { messages } from '../../utils/common/messages';
import { validateConfigurationAndLicense } from '../../utils/common/configValidators';
import { getCx } from '../../cx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EnvironmentStateItem {
  id?: string;
  name?: string;
  displayScanId?: string;
  data?: {
    scanType?: string;
    url?: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ScanStateItem {
  id?: string;
  name?: string;
  displayScanId?: string;
  scanDatetime?: string;
  data?: {
    statistics?: string;
    alertRiskLevel?: unknown;
    scanDuration?: string;
    initiator?: string;
    scannedPathsCount?: number;
    source?: string;
  };
}

export class DastResultsProvider extends ResultsProvider {
  constructor(
    protected readonly context: vscode.ExtensionContext,
    private readonly logs: Logs,
    protected readonly statusBarItem: vscode.StatusBarItem,
    private readonly diagnosticCollection: vscode.DiagnosticCollection,
    private readonly filterCommand: FilterCommand,
    private readonly groupByCommand: GroupByCommand
  ) {
    super(context, statusBarItem);

    // Syncing with AST everytime the extension gets opened
    this.openRefreshData().then(() => logs.info(messages.dataRefreshed));
  }

  async clean(): Promise<void> {
    this.logs.info(messages.clearLoadedInfo);
    updateState(this.context, constants.dastScanIdKey, undefined);
    updateState(this.context, constants.environmentIdKey, undefined);
    await this.refreshData();
  }

  async refreshData(): Promise<void> {
    const validAndLicense = await validateConfigurationAndLicense(this.logs);
    let hasDastLicense = false;
    if (validAndLicense) {
      const cx = getCx();
      hasDastLicense = await cx.isDastLicenseEnabled(this.logs);
    }

    if (validAndLicense && hasDastLicense) {
      this.showStatusBarItem(messages.commandRunning);
      const treeItem = await this.generateTree();
      this.data = treeItem.children;
      this._onDidChangeTreeData.fire(undefined);
      this.hideStatusBarItem();
    } else {
      this.data = [];
      if (validAndLicense && !hasDastLicense) {
        this.data = [new TreeItem(messages.dastLicenseNotEnabled, undefined)];
      }
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  async openRefreshData(): Promise<void> {
    // TODO: implement
  }

  async generateTree(): Promise<TreeItem> {
    this.diagnosticCollection.clear();
    // createBaseItems
    let treeItems = this.createRootItems();

    // Get scan details from state
    const scanItem = getFromState(this.context, constants.dastScanIdKey);

    if (scanItem?.id) {
      // Add scan date
      if (scanItem.scanDatetime) {
        treeItems = treeItems.concat(new TreeItem(scanItem.scanDatetime, constants.calendarItem));
      }

      // Add status from data
      if (scanItem.data?.statistics) {
        treeItems = treeItems.concat(new TreeItem(`Status: ${scanItem.data.statistics}`, constants.statusItem));
      }

      // Add severity summary from alertRiskLevel
      const severitySummary = this.createDastSeveritySummary(scanItem.data?.alertRiskLevel);
      if (severitySummary) {
        treeItems = treeItems.concat(new TreeItem(severitySummary, constants.graphItem));
      }
    }

    return new TreeItem('', undefined, undefined, treeItems);
  }

  createRootItems(): TreeItem[] {
    const environmentItem = getFromState(this.context, constants.environmentIdKey) as EnvironmentStateItem | undefined;
    const scanItem = getFromState(this.context, constants.dastScanIdKey) as ScanStateItem | undefined;

    const envTreeItem = new TreeItem(
      environmentItem?.name ?? constants.environmentLabel,
      constants.environmentItem
    );
    if (environmentItem?.id) {
      envTreeItem.setTooltip(this.createEnvironmentTooltip(environmentItem));
    }

    const scanTreeItem = new TreeItem(
      `${scanItem?.displayScanId ?? constants.scanLabel}`,
      constants.dastScanItem
    );
    if (scanItem?.id) {
      scanTreeItem.setTooltip(this.createScanTooltip(scanItem));
    }

    return [envTreeItem, scanTreeItem];
  }

  private createEnvironmentTooltip(env: EnvironmentStateItem): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    const data = env.data;
    md.appendMarkdown(`${env.name ?? ''}\n\n`);
    md.appendMarkdown(`**Scan Type:** ${data?.scanType ?? 'N/A'}\n\n`);
    md.appendMarkdown(`**URL:** ${data?.url ?? 'N/A'}`);
    return md;
  }

  private createScanTooltip(scan: ScanStateItem): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    const data = scan.data;
    md.appendMarkdown(`${scan.displayScanId ?? ''}\n\n`);
    md.appendMarkdown(`**Duration:** ${data?.scanDuration ?? 'N/A'}\n\n`);
    md.appendMarkdown(`**Initiated By:** ${data?.initiator ?? 'N/A'}\n\n`);
    md.appendMarkdown(`**Paths Count:** ${data?.scannedPathsCount ?? 'N/A'}\n\n`);
    md.appendMarkdown(`**Origin:** ${data?.source ?? 'N/A'}`);
    return md;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createDastSeveritySummary(alertRiskLevel: any): string | undefined {
    if (!alertRiskLevel) {
      return undefined;
    }

    const severityOrder = [
      { key: 'criticalCount', label: SeverityLevel.critical.toUpperCase() },
      { key: 'highCount', label: SeverityLevel.high.toUpperCase() },
      { key: 'mediumCount', label: SeverityLevel.medium.toUpperCase() },
      { key: 'lowCount', label: SeverityLevel.low.toUpperCase() },
      { key: 'infoCount', label: SeverityLevel.info.toUpperCase() },
    ];

    const parts: string[] = [];
    for (const severity of severityOrder) {
      const count = alertRiskLevel[severity.key];
      if (count && count > 0) {
        parts.push(`${severity.label}: ${count}`);
      }
    }

    return parts.length > 0 ? parts.join(' | ') : undefined;
  }
}
