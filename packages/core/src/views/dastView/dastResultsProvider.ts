import * as vscode from 'vscode';
import { TreeItem } from '../../utils/tree/treeItem';
import { getFromState, updateState } from '../../utils/common/globalState';
import { constants } from '../../utils/common/constants';
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
    updateState(this.context, constants.scanIdKey, undefined);
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
    const treeItems = this.createRootItems();
    return new TreeItem('', undefined, undefined, treeItems);
  }

  createRootItems(): TreeItem[] {
    return [
      new TreeItem(
        getFromState(this.context, constants.environmentIdKey)?.name ?? constants.environmentLabel,
        constants.environmentItem
      ),
      new TreeItem(
        `${getFromState(this.context, constants.scanIdKey)?.displayScanId ?? constants.scanLabel}`,
        constants.scanItem
      ),
    ];
  }
}
