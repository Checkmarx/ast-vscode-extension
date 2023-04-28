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
  STATUS_ITEM,
  ERROR_ITEM,
} from "../utils/common/constants";
import { Logs } from "../models/logs";
import { getAstConfiguration } from "../utils/ast/ast";
import { TreeItem } from "../utils/tree/treeItem";
import { createSummaryItem, groupBy, orderResults } from "../utils/tree/actions";
import CxScaRealTimeErrors from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTimeErrors";

export class SCAResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  public process: any;
  public groupFilter: IssueFilter[] = [
    IssueFilter.fileName,
    IssueFilter.severity,
    IssueFilter.packageIdentifier,
  ];
  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
    new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;
  private message: string | undefined;
  public scaResults: CxResult[];
  public scaResultsErrors: CxScaRealTimeErrors [];
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
    this.scaResultsErrors = [];
    await this.refreshData();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async refreshData(message?:string): Promise<void> {
    this.showStatusBarItem();
    this.message = message ? message : SCA_START_SCAN;
    this.data = this.generateTree().children;
    this._onDidChangeTreeData.fire(undefined);
    this.hideStatusBarItem();
  }

  generateTree(): TreeItem {
    const resultsTree = this.generateResultsTree();
    const issuesTree = this.generateErrorsTree();

    if (!resultsTree && !issuesTree) {
      return new TreeItem(undefined, undefined, undefined, [new TreeItem(this.message)]);
    }

    const statusTreeItem = new TreeItem(!issuesTree ? "Scan finished successfully" : "Scan finished with errors", STATUS_ITEM, undefined, undefined);
    const summaryTreeItem = createSummaryItem(this.scaResults);

    return new TreeItem("", undefined, undefined, [statusTreeItem, summaryTreeItem.label ? summaryTreeItem : undefined, resultsTree, issuesTree]);
  }

  generateErrorsTree(): TreeItem {
    if (!this.scaResultsErrors || this.scaResultsErrors.length === 0) {
      return undefined;
    }
    const errors = this.scaResultsErrors.map(error => {
      const messageItem = new TreeItem(error.message);
      return new TreeItem(error.filename, undefined, undefined, [messageItem]);
    }); 
    
    return new TreeItem("Dependency resolution errors", undefined, undefined, errors);
  }

  generateResultsTree(): TreeItem {
    const results = orderResults(this.scaResults);
    if (results.length === 0) {
      return undefined;
    }
    
    const treeItem = groupBy(results, this.groupFilter, "Vulnerabilities", this.diagnosticCollection, undefined, undefined);
    treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    return treeItem;
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


