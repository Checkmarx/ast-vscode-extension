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
    }

    return new TreeItem('', undefined, undefined, treeItems);
  }

  createRootItems(): TreeItem[] {
    return [
      new TreeItem(
        getFromState(this.context, constants.environmentIdKey)?.name ?? constants.environmentLabel,
        constants.environmentItem
      ),
      new TreeItem(
        `${getFromState(this.context, constants.dastScanIdKey)?.displayScanId ?? constants.scanLabel}`,
        constants.dastScanItem
      ),
    ];
  }

  private createDastSeveritySummary(alertRiskLevelJson: string | undefined): string | undefined {
    if (!alertRiskLevelJson) {
      return undefined;
    }

    try {
      const alertRiskLevel = JSON.parse(alertRiskLevelJson);
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
    } catch {
      return undefined;
    }
  }
}
