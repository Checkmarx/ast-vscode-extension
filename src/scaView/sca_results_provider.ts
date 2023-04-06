import * as vscode from "vscode";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import { EventEmitter } from "vscode";
import {
  EXTENSION_NAME,
  IssueFilter,
  REFRESHING_TREE,
  CLEAR_SCA,
  SCA_SCAN_RUNNING_LOG,
  SCA_START_SCAN,
} from "../utils/common/constants";
import { Logs } from "../models/logs";
import { getAstConfiguration } from "../utils/ast/ast";
import { TreeItem } from "../utils/tree/treeItem";
import { groupBy, orderResults } from "../utils/tree/actions";

export class SCAResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  public process;
  public issueFilter: IssueFilter[] = [
    IssueFilter.severity,
    IssueFilter.packageIdentifier,
  ];
  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
    new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;
  private scan: string | undefined;
  public scaResults: CxResult[];
  private data: TreeItem[] | undefined;

  constructor(
    private readonly logs: Logs,
    private readonly statusBarItem: vscode.StatusBarItem,
    private readonly diagnosticCollection: vscode.DiagnosticCollection
  ) {}

  private showStatusBarItem() {
    this.statusBarItem.text = REFRESHING_TREE;
    this.statusBarItem.tooltip = SCA_SCAN_RUNNING_LOG;
    this.statusBarItem.show();
  }

  private hideStatusBarItem() {
    this.statusBarItem.text = EXTENSION_NAME;
    this.statusBarItem.tooltip = undefined;
    this.statusBarItem.command = undefined;
    this.statusBarItem.hide();
  }

  async clean(): Promise<void> {
    this.logs.info(CLEAR_SCA);
    this.scaResults = [];
    await this.refreshData();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async refreshData(message?: string): Promise<void> {
    this.showStatusBarItem();
    this.data = getAstConfiguration()
      ? this.generateTree(message).children
      : [];
    this._onDidChangeTreeData.fire(undefined);
    this.hideStatusBarItem();
  }

  generateTree(message?: string): TreeItem {
    this.diagnosticCollection.clear();
    let treeItems = [];
    const results = orderResults(this.scaResults);
    let treeItem: TreeItem;
    if (results.length > 0) {
      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      this.scan = `SCA identified ${results.length} vulnerabilities in ${workspaceFolder.name}`;
      treeItem = groupBy(
        results,
        this.issueFilter,
        this.scan,
        this.diagnosticCollection
      );
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      this.scan = message ? message : SCA_START_SCAN;
      treeItem = groupBy(
        results,
        this.issueFilter,
        this.scan,
        this.diagnosticCollection
      );
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
    treeItems = treeItems.concat(treeItem);
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
