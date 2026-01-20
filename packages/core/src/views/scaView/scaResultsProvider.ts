import * as vscode from "vscode";
import CxResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import {
  GroupBy,
  constants
} from "../../utils/common/constants";
import { Logs } from "../../models/logs";
import { TreeItem } from "../../utils/tree/treeItem";
import { messages } from "../../utils/common/messages";
import { orderResults } from "../../utils/utils";
import { ResultsProvider } from "../resultsProviders";
import CxScaRealTimeErrors from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTimeErrors";
import { cx } from "../../cx";

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
    if (!await cx.isStandaloneEnabled(this.logs)) {
      this.showStatusBarItem(constants.scaScanRunningLog);
      this.message = message ? message : messages.scaStartScan;
      this.data = this.generateTree().children;
      this._onDidChangeTreeData.fire(undefined);
      this.hideStatusBarItem();
    }
    else {
      this.data = [];
      this._onDidChangeTreeData.fire(undefined);
    }
  }


  generateTree(): TreeItem {
    const resultsTree = this.generateResultsTree();
    const issuesTree = this.generateErrorsTree();

    if (!resultsTree && !issuesTree) {
      return new TreeItem(undefined, undefined, undefined, [new TreeItem(this.message)]);
    }

    const statusTreeItem = new TreeItem(!issuesTree ? messages.scaSucces : messages.scaErrors, constants.statusItem, undefined, undefined);
    const summaryTreeItem = this.createSummaryItem(this.scaResults);

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

    return new TreeItem(messages.scaDependencyErros, undefined, undefined, errors);
  }

  generateResultsTree(): TreeItem {
    const results = orderResults(this.scaResults);
    if (results.length === 0) {
      return undefined;
    }
    const treeItem = this.groupBy(results, this.activeGroupBy, messages.scaVulnerabilities, this.diagnosticCollection, undefined, undefined);
    treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    return treeItem;
  }
}
