import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  constants
} from "../../utils/common/constants";
import { getResultsFilePath, readResultsFromFile } from "../../utils/utils";
import { Logs } from "../../models/logs";
import { getFromState, updateState } from "../../utils/common/globalState";
import { cx } from "../../cx";
import { commands } from "../../utils/common/commands";
import { TreeItem } from "../../utils/tree/treeItem";
import { FilterCommand } from "../../commands/filterCommand";
import { GroupByCommand } from "../../commands/groupByCommand";
import { messages } from "../../utils/common/messages";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import { getResultsWithProgress } from "../../utils/pickers/pickers";
import { ResultsProvider } from "../resultsProviders";

export class AstResultsProvider extends ResultsProvider {
  public process;
  public loadedResults: CxResult[];
  private scan: string | undefined;

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
    this.data = cx.getAstConfiguration() ? this.generateTree().children : [];
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

  generateTree(): TreeItem {
    const resultJsonPath = getResultsFilePath();
    this.diagnosticCollection.clear();
    // createBaseItems
    let treeItems = this.createRootItems();
    // get para getFromState
    this.scan = getFromState(this.context, constants.scanIdKey)?.id;
    // in case we scanId, it is needed to load them from the json file
    if (this.scan) {
      this.loadedResults = readResultsFromFile(resultJsonPath, this.scan);
    }
    // otherwise the results must be cleared
    else {
      this.loadedResults = undefined;
    }
    // if there are results loaded, the tree needs to be recreated
    if (this.loadedResults !== undefined) {
      const dt = getFromState(this.context, constants.scanIdKey).datetime;
      const newItem = new TreeItem(`${dt}`, constants.calendarItem);
      treeItems = treeItems.concat(newItem);
    
      treeItems = treeItems.concat(this.createSummaryItem(this.loadedResults));

      const treeItem = this.groupBy(
        this.loadedResults,
        this.groupByCommand.activeGroupBy,
        this.scan,
        this.diagnosticCollection,
        this.filterCommand.getAtiveSeverities(),
        this.filterCommand.getActiveStates()
      );
      treeItem.label = "Scan";
      
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      treeItems = treeItems.concat(treeItem);
    }
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
        `${getFromState(this.context, constants.scanIdKey)?.formattedId ?? constants.scanLabel}`,
        constants.scanItem
      )
    ];
  }

}
