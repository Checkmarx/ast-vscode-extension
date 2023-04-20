import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "vscode";
import {
  EXTENSION_NAME,
  SCAN_ID_KEY,
  PROJECT_ID_KEY,
  BRANCH_ID_KEY,
  SCAN_LABEL,
  PROJECT_LABEL,
  BRANCH_LABEL,
  PROJECT_ITEM,
  BRANCH_ITEM,
  SCAN_ITEM,
  REFRESHING_TREE,
} from "../../utils/common/constants";
import { getResultsFilePath, getResultsWithProgress } from "../../utils/utils";
import { Logs } from "../../models/logs";
import { get, update } from "../../utils/common/globalState";
import { getAstConfiguration } from "../../ast/ast";
import { KICS_SETINGS, REFRESH_TREE } from "../../utils/common/commands";
import { TreeItem } from "../../utils/tree/treeItem";
import {
  createSummaryItem,
  groupBy,
  orderResults,
} from "../../utils/tree/actions";
import { FilterCommand } from "../../commands/filterCommand";
import { GroupByCommand } from "../../commands/groupByCommand";

export class AstResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  public process;

  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
    new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;
  private scan: string | undefined;
  private data: TreeItem[] | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logs: Logs,
    private readonly statusBarItem: vscode.StatusBarItem,
    private readonly kicsStatusBarItem: vscode.StatusBarItem,
    private readonly diagnosticCollection: vscode.DiagnosticCollection,
    private readonly filterCommand: FilterCommand,
    private readonly groupByCommand: GroupByCommand
  ) {
    const onSave = vscode.workspace
      .getConfiguration("CheckmarxKICS")
      .get("Activate KICS Auto Scanning") as boolean;
    this.kicsStatusBarItem.text =
      onSave === true
        ? "$(check) Checkmarx kics"
        : "$(debug-disconnect) Checkmarx kics";
    this.kicsStatusBarItem.tooltip = "Checkmarx kics auto scan";
    this.kicsStatusBarItem.command = KICS_SETINGS;
    this.kicsStatusBarItem.show();
  }

  private showStatusBarItem() {
    this.statusBarItem.text = REFRESHING_TREE;
    this.statusBarItem.tooltip = "Checkmarx command is running";
    this.statusBarItem.show();
  }

  private hideStatusBarItem() {
    this.statusBarItem.text = EXTENSION_NAME;
    this.statusBarItem.tooltip = undefined;
    this.statusBarItem.command = undefined;
    this.statusBarItem.hide();
  }

  async clean(): Promise<void> {
    this.logs.info("Clear all loaded information");
    const resultJsonPath = path.join(__dirname, "ast-results.json");
    if (fs.existsSync(resultJsonPath)) {
      fs.unlinkSync(resultJsonPath);
    }
    update(this.context, SCAN_ID_KEY, undefined);
    update(this.context, PROJECT_ID_KEY, undefined);
    update(this.context, BRANCH_ID_KEY, undefined);
    await this.refreshData();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async refreshData(): Promise<void> {
    this.showStatusBarItem();
    this.data = getAstConfiguration() ? this.generateTree().children : [];
    this._onDidChangeTreeData.fire(undefined);
    this.hideStatusBarItem();
  }

  async openRefreshData(): Promise<void> {
    this.showStatusBarItem();
    const scanIDItem = get(this.context, SCAN_ID_KEY);
    let scanId = undefined;
    if (scanIDItem && scanIDItem.name) {
      scanId = get(this.context, SCAN_ID_KEY).name;
    }
    if (scanId) {
      await getResultsWithProgress(this.logs, scanId);
      await vscode.commands.executeCommand(REFRESH_TREE);
      this.hideStatusBarItem();
    }
  }

  generateTree(): TreeItem {
    const resultJsonPath = getResultsFilePath();
    this.diagnosticCollection.clear();

    let treeItems = [
      new TreeItem(
        get(this.context, PROJECT_ID_KEY)?.name ?? PROJECT_LABEL,
        PROJECT_ITEM
      ),
      new TreeItem(
        get(this.context, BRANCH_ID_KEY)?.name ?? BRANCH_LABEL,
        BRANCH_ITEM
      ),
      new TreeItem(
        get(this.context, SCAN_ID_KEY)?.name ?? SCAN_LABEL,
        SCAN_ITEM
      ),
    ];

    this.scan = get(this.context, SCAN_ID_KEY)?.id;
    if (fs.existsSync(resultJsonPath) && this.scan) {
      const jsonResults = JSON.parse(
        fs
          .readFileSync(resultJsonPath, "utf-8")
          .replace(/:([0-9]{15,}),/g, ':"$1",')
      );
      const results = orderResults(jsonResults.results);

      treeItems = treeItems.concat(createSummaryItem(results));

      const treeItem = groupBy(
        results,
        this.groupByCommand.activeGroupBy,
        this.scan,
        this.diagnosticCollection,
        this.filterCommand.activeSeverities,
        this.filterCommand.activeStates
      );
      treeItem.label = `${SCAN_LABEL} ${this.scan}`;
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      treeItems = treeItems.concat(treeItem);
    }

    return new TreeItem("", undefined, undefined, treeItems);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(
    element?: TreeItem | undefined
  ): vscode.ProviderResult<TreeItem[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }
}
