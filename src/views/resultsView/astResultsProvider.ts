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
import { validateConfigurationAndLicense } from "../../utils/common/configValidators";

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

    this.riskManagementView = new riskManagementView(context.extensionUri, context, logs);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'riskManagement',
        this.riskManagementView
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(commands.refreshRiskManagementView, async () => {
        this.riskManagementView.updateContent();
      })
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
    if (await validateConfigurationAndLicense(this.logs)) {
      console.log("[AST] refreshData: starting generateTree");
      this.showStatusBarItem(messages.commandRunning);
      const treeItem = await this.generateTree();
      console.log("[AST] refreshData: generateTree returned", !!treeItem, "children count:", treeItem?.children?.length ?? 0);
      this.data = treeItem.children;
      this._onDidChangeTreeData.fire(undefined);
      console.log("[AST] refreshData: treeData fired, data length:", this.data?.length ?? 0);
      this.hideStatusBarItem();
    }
    else {
      console.log("[AST] refreshData: invalid configuration or license, clearing data");
      this.data = [];
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  async openRefreshData(): Promise<void> {
    if (await validateConfigurationAndLicense(this.logs)) {
      console.log("[AST] openRefreshData: starting with valid config");
      this.showStatusBarItem(messages.commandRunning);
      this.loadedResults = undefined;
      const scanIDItem = getFromState(this.context, constants.scanIdKey);
      let scanId = undefined;
      if (scanIDItem && scanIDItem.name) {
        scanId = getFromState(this.context, constants.scanIdKey).name;
      }
      console.log("[AST] openRefreshData: scanId from state:", scanId);
      if (scanId) {
        console.log("[AST] openRefreshData: invoking getResultsWithProgress for scanId");
        await getResultsWithProgress(this.logs, scanId);
        console.log("[AST] openRefreshData: results loaded, refreshing tree");
        await vscode.commands.executeCommand(commands.refreshTree);
        console.log("[AST] openRefreshData: refreshTree executed");
        this.hideStatusBarItem();
      }
    }
  }

  async generateTree(): Promise<TreeItem> {
    const resultJsonPath = getResultsFilePath();
    this.diagnosticCollection.clear();
    // createBaseItems
    let treeItems = this.createRootItems();
    // get scan from state
    this.scan = getFromState(this.context, constants.scanIdKey);
    console.log("[AST] generateTree: scan from state:", this.scan?.id, this.scan?.name);
    const fromTriage = getFromState(this.context, constants.triageUpdate)?.id;
    console.log("[AST] generateTree: fromTriage flag:", fromTriage);
    // Case we come from triage we want to use the loaded results which were modified in triage
    if (fromTriage === undefined || !fromTriage) {
      // in case we scanId, it is needed to load them from the json file
      if (this.scan?.id) {
        console.log("[AST] generateTree: reading results from file:", resultJsonPath);
        this.loadedResults = await readResultsFromFile(resultJsonPath, this.scan?.id)
          .catch((error) => {
            this.logs.error(`Error reading results: ${error.message}`);
            return undefined;
          });
        console.log("[AST] generateTree: loadedResults length:", this.loadedResults?.length ?? -1);



      }
      // otherwise the results must be cleared
      else {
        console.log("[AST] generateTree: no scan id, clearing loadedResults and updating risk view");
        this.loadedResults = undefined;
        this.riskManagementView.updateContent();

      }
    }
    // Case we come from triage we must update the state to load results from the correct place
    else {
      console.log("[AST] generateTree: clearing triageUpdate state");
      updateState(this.context, constants.triageUpdate, {
        id: false, name: constants.triageUpdate,
        scanDatetime: "",
        displayScanId: ""
      });
    }

    // if there are results loaded, the tree needs to be recreated
    if (this.loadedResults !== undefined) {
      console.log("[AST] generateTree: recreating tree with results, count:", this.loadedResults.length);

      // Update the risks management webview with project info
      const project = getFromState(this.context, constants.projectIdKey);
      console.log("[AST] generateTree: updating risk view with project:", project?.id, "scan:", this.scan?.id);
      this.riskManagementView.updateContent({ project, scan: this.scan, cxResults: this.loadedResults });

      const newItem = new TreeItem(`${this.scan.scanDatetime}`, constants.calendarItem);
      treeItems = treeItems.concat(newItem);

      if (this.loadedResults.length !== 0) {
        treeItems = treeItems.concat(this.createSummaryItem(this.loadedResults));
      }

      console.log("[AST] generateTree: grouping by:", this.groupByCommand.activeGroupBy, "active severities:", this.filterCommand.getAtiveSeverities(), "active states:", this.filterCommand.getActiveStates());
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
      console.log("[AST] generateTree: treeItem children count:", treeItem.children.length);
    }
    console.log("[AST] generateTree: returning root with children count:", treeItems.length);
    return new TreeItem("", undefined, undefined, treeItems);
  }

  createRootItems(): TreeItem[] {
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
}
