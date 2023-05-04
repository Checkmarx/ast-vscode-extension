import * as vscode from "vscode";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import {
  GroupBy,
  constants
} from "../../utils/common/constants";
import { Logs } from "../../models/logs";
import { TreeItem } from "../../utils/tree/treeItem";
import { groupBy } from "../../utils/tree/actions";
import { messages } from "../../utils/common/messages";
import { orderResults } from "../../utils/utils";
import { ResultsProvider } from "../resultsProviders";

export class SCAResultsProvider extends ResultsProvider {
  public process;
  public issueFilter: GroupBy[] = [GroupBy.severity, GroupBy.packageIdentifier];
  private scan: string | undefined;
  public scaResults: CxResult[];

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
    this.data = this.generateTree(message).children;
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
      this.scan = messages.scaTreeVulnerabilities(
        results.length,
        workspaceFolder.name
      );
      treeItem = groupBy(
        results,
        this.issueFilter,
        this.scan,
        this.diagnosticCollection
      );
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      this.scan = message ? message : constants.scaStartScan;
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
}
