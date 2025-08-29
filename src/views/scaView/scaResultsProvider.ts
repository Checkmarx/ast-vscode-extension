import * as vscode from "vscode";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import {
  GroupBy,
  constants
} from "../../utils/common/constants";
import { Logs } from "../../models/logs";
import { messages } from "../../utils/common/messages";
import { orderResults } from "../../utils/utils";
import { ResultsProvider } from "../resultsProviders";
import CxScaRealTimeErrors from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTimeErrors";

/**
 * Custom TreeItem that extends VS Code TreeItem
 */
export class TreeItem extends vscode.TreeItem {
  children?: TreeItem[];

  constructor(
    label?: string,
    contextValue?: string,
    iconPath?: any,
    children?: TreeItem[],
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label ?? "", collapsibleState);
    this.contextValue = contextValue;
    this.iconPath = iconPath;
    this.children = children;
  }
}

/**
 * SCA Results Provider
 */
export class SCAResultsProvider extends ResultsProvider {
  public process;
  public issueFilter: GroupBy[] = [GroupBy.severity, GroupBy.queryName];
  private scan: string | undefined;
  public scaResults: CxResult[];
  private message: string | undefined;
  public scaResultsErrors: CxScaRealTimeErrors[];
  public activeGroupBy: GroupBy[] = [
    GroupBy.fileName,
    GroupBy.severity,
    GroupBy.queryName,
  ];

  constructor(
    protected readonly context: vscode.ExtensionContext,
    private readonly logs: Logs,
    protected readonly statusBarItem: vscode.StatusBarItem,
    private readonly diagnosticCollection: vscode.DiagnosticCollection
  ) {
    super(context, statusBarItem);
    this.scaResults = [];
  }

  async clean(): Promise<void> {
    this.logs.info(constants.clearSca);
    this.scaResults = [];
    await this.refreshData();
  }

  async refreshData(message?: string): Promise<void> {
    this.showStatusBarItem(constants.scaScanRunningLog);
    this.message = message ? message : messages.scaStartScan;
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

    const statusTreeItem = new TreeItem(
      !issuesTree ? messages.scaSucces : messages.scaErrors,
      constants.statusItem
    );

    const summaryTreeItem = this.createSummaryItem(this.scaResults);

    return new TreeItem(
      "",
      undefined,
      undefined,
      [
        statusTreeItem,
        summaryTreeItem.label ? summaryTreeItem : undefined,
        resultsTree,
        issuesTree
      ].filter(Boolean) // filter out undefined
    );
  }

  generateErrorsTree(): TreeItem | undefined {
    if (!this.scaResultsErrors || this.scaResultsErrors.length === 0) {
      return undefined;
    }

    const errors = this.scaResultsErrors.map(error => {
      const messageItem = new TreeItem(error.message);
      return new TreeItem(error.filename, undefined, undefined, [messageItem]);
    });

    return new TreeItem(messages.scaDependencyErros, undefined, undefined, errors);
  }

  generateResultsTree(): TreeItem | undefined {
    const results = orderResults(this.scaResults);
    if (results.length === 0) {
      return undefined;
    }

    const treeItem = this.groupBy(
      results,
      this.activeGroupBy,
      messages.scaVulnerabilities,
      this.diagnosticCollection,
      undefined,
      undefined
    );

    treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    return treeItem;
  }
}
