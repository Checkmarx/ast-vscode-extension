import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "vscode";
import { AstResult, SastNode } from "./results";
import {
  EXTENSION_NAME,
  SCAN_ID_KEY,
  HIGH_FILTER,
  MEDIUM_FILTER,
  LOW_FILTER,
  INFO_FILTER,
} from "./constants";
import {
  getBranchId,
  getProjectId,
  getProperty,
  getScanId,
  Item,
  updateBranchId,
  updateProjectId,
  updateScanId,
} from "./utils";
import { Logs } from "./logs";

export enum IssueFilter {
  fileName = "fileName",
  severity = "severity",
  status = "status",
  language = "language",
}

export enum IssueLevel {
  high = "HIGH",
  medium = "MEDIUM",
  low = "LOW",
  info = "INFO",
  empty = "",
}

export class AstResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  public issueFilter: IssueFilter = IssueFilter.severity;
  public issueLevel: IssueLevel[] = [IssueLevel.high, IssueLevel.medium];

  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
    new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;
  private scanId: string;
  private data: TreeItem[] | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logs: Logs,
    private readonly statusBarItem: vscode.StatusBarItem,
    private readonly diagnosticCollection: vscode.DiagnosticCollection
  ) {
    this.initializeFilters();
    this.scanId = getScanId(this.context).id;
    this.refreshData();
  }

  private showStatusBarItem() {
    this.statusBarItem.text = "$(sync~spin) Refreshing tree";
    this.statusBarItem.tooltip = "Checkmarx command is running";
    this.statusBarItem.show();
  }

  private hideStatusBarItem() {
    this.statusBarItem.text = EXTENSION_NAME;
    this.statusBarItem.tooltip = undefined;
    this.statusBarItem.command = undefined;
    this.statusBarItem.hide();
  }

  private async initializeFilters() {
    // Get the saved state
    var high = await this.context.globalState.get(HIGH_FILTER);
    var medium = await this.context.globalState.get(MEDIUM_FILTER);
    var low = await this.context.globalState.get(LOW_FILTER);
    var info = await this.context.globalState.get(INFO_FILTER);
    // Check if it there was anything stored in the state
    if (high === undefined) {
      high = true;
    }
    if (medium === undefined) {
      medium = true;
    }
    if (low === undefined) {
      low = false;
    }
    if (info === undefined) {
      info = false;
    }
    // Update the context, state and local array
    if (high === false) {
      this.issueLevel = this.issueLevel.filter((x) => {
        return x !== IssueLevel.high;
      });
    }
    await vscode.commands.executeCommand("setContext", HIGH_FILTER, high);
    await this.context.globalState.update(HIGH_FILTER, high);
    if (medium === false) {
      this.issueLevel = this.issueLevel.filter((x) => {
        return x !== IssueLevel.medium;
      });
    }
    await vscode.commands.executeCommand("setContext", MEDIUM_FILTER, medium);
    await this.context.globalState.update(MEDIUM_FILTER, medium);
    if (info === true) {
      this.issueLevel = this.issueLevel.concat([IssueLevel.info]);
    }
    await vscode.commands.executeCommand("setContext", INFO_FILTER, info);
    await this.context.globalState.update(INFO_FILTER, info);
    if (low === true) {
      this.issueLevel = this.issueLevel.concat([IssueLevel.low]);
    }
    await this.context.globalState.update(LOW_FILTER, low);
    await vscode.commands.executeCommand("setContext", LOW_FILTER, low);
  }

  refresh(): void {
    this.refreshData();
    this._onDidChangeTreeData.fire(undefined);
  }

  clean(): void {
    const resultJsonPath = path.join(__dirname, "ast-results.json");
    if (fs.existsSync(resultJsonPath)) {
      fs.unlinkSync(resultJsonPath);
    }
    // Used to check if the refresh is being called from a filter button
    this.diagnosticCollection.clear();
    const projectTreeItem = new TreeItem(
      "project",
      "project",
      undefined,
      undefined
    );

    const branchTreeItem = new TreeItem("branch", "branch", undefined);
    const scanTreeItem = new TreeItem("scan ID", "scanTree", undefined);
    var tree = new TreeItem("", undefined, undefined, [
      projectTreeItem,
      branchTreeItem,
      scanTreeItem,
      new TreeItem("scan ID", undefined, undefined, [
        new TreeItem("", undefined, undefined, []),
      ]),
    ]);
    var branch = new Item();
    branch.name = "branch";
    var project = new Item();
    project.name = "project";
    project.id = "project";
    var scan = new Item();
    scan.name = "scan ID";
    scan.id = "scan ID";
    updateScanId(this.context, scan);
    updateBranchId(this.context, branch);
    updateProjectId(this.context, project);
    this.data = tree.children;
    vscode.commands.executeCommand("ast-results.refreshTree");
    this._onDidChangeTreeData.fire(undefined);
  }

  async refreshData(typeFilter?: string): Promise<void> {
    this.showStatusBarItem();

    // Used to check if the refresh is being called from a filter button
    if (typeFilter) {
      var context = await this.context.globalState.get(typeFilter);
      // Change the selection value in the context
      await this.context.globalState.update(typeFilter, !context);
      await vscode.commands.executeCommand("setContext", typeFilter, !context);
    }
    this.scanId = getScanId(this.context).id;
    this.data = this.generateTree().children;
    this._onDidChangeTreeData.fire(undefined);
    this.hideStatusBarItem();
  }

  generateTree(): TreeItem {
    const resultJsonPath = path.join(__dirname, "ast-results.json");
    // Empty tree if there are no results loaded in disk
    if (!fs.existsSync(resultJsonPath)) {
      this.diagnosticCollection.clear();
      const projectTreeItem = new TreeItem(
        getProjectId(this.context).name
          ? getProjectId(this.context).name
          : "project",
        "project",
        undefined,
        undefined
      );
      const branchTreeItem = new TreeItem(
        getBranchId(this.context).name
          ? getBranchId(this.context).name
          : "branch",
        "branch",
        undefined
      );
      const scanTreeItem = new TreeItem(
        getScanId(this.context).name ? getScanId(this.context).name : "scan ID",
        "scanTree",
        undefined
      );
      return new TreeItem("", undefined, undefined, [
        projectTreeItem,
        branchTreeItem,
        scanTreeItem,
        new TreeItem("scan ID"),
      ]);
    }

    const jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, "utf-8"));

    const groups = ["type", this.issueFilter];
    const treeItem = this.groupBy(jsonResults.results, groups);
    treeItem.label = "scan ID " + getScanId(this.context).name;
    const projectTreeItem = new TreeItem(
      getProjectId(this.context).name,
      "project",
      undefined,
      undefined
    );
    const branchTreeItem = new TreeItem(
      getBranchId(this.context).name,
      "branch",
      undefined
    );
    const scanTreeItem = new TreeItem(
      getScanId(this.context).name,
      "scanTree",
      undefined
    );

    return new TreeItem("", undefined, undefined, [
      projectTreeItem,
      branchTreeItem,
      scanTreeItem,
      treeItem,
    ]);
  }

  groupBy(list: Object[], groups: string[]): TreeItem {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const map = new Map<string, vscode.Diagnostic[]>();
    const tree = new TreeItem(this.scanId, undefined, undefined, []);

    list.forEach((element) =>
      this.groupTree(element, folder, map, groups, tree)
    );

    this.diagnosticCollection.clear();
    map.forEach((value, key) =>
      this.diagnosticCollection.set(vscode.Uri.parse(key), value)
    );

    return tree;
  }

  groupTree(
    rawObj: Object,
    folder: vscode.WorkspaceFolder | undefined,
    map: Map<string, vscode.Diagnostic[]>,
    groups: string[],
    tree: TreeItem
  ) {
    const obj = new AstResult(rawObj);
    if (!obj) {
      return;
    }
    const item = new TreeItem(obj.label.replaceAll("_", " "), undefined, obj);
    // Verify the current severity fiters applied
    if (this.issueLevel.length > 0) {
      // Filter only the results for the severity filters type
      if (this.issueLevel.includes(obj.getSeverity())) {
        if (obj.sastNodes.length > 0) {
          this.createDiagnostic(
            obj.label,
            obj.getSeverityCode(),
            obj.sastNodes[0],
            folder,
            map
          );
        }
        const node = groups.reduce(
          (previousValue: TreeItem, currentValue: string) =>
            this.reduceGroups(obj, previousValue, currentValue),
          tree
        );
        node.children?.push(item);
      }
    }
    // If there is no severity filter no information should be stored in the tree
    else {
      new TreeItem("");
    }
  }

  createDiagnostic(
    label: string,
    severity: vscode.DiagnosticSeverity,
    node: SastNode,
    folder: vscode.WorkspaceFolder | undefined,
    map: Map<string, vscode.Diagnostic[]>
  ) {
    if (!folder) {
      return;
    }
    const filePath = vscode.Uri.joinPath(folder!.uri, node.fileName).toString();
    // Needed because vscode uses zero based line number
    const column = node.column > 0 ? +node.column - 1 : 1;
    const line = node.line > 0 ? +node.line - 1 : 1;
    let length = column + node.length;
    const startPosition = new vscode.Position(line, column);
    const endPosition = new vscode.Position(line, length);
    const range = new vscode.Range(startPosition, endPosition);

    const diagnostic = new vscode.Diagnostic(range, label, severity);
    if (map.has(filePath)) {
      map.get(filePath)?.push(diagnostic);
    } else {
      map.set(filePath, [diagnostic]);
    }
  }

  reduceGroups(obj: Object, previousValue: TreeItem, currentValue: string) {
    const value = getProperty(obj, currentValue);
    if (!value) {
      return previousValue;
    }

    const tree = previousValue.children
      ? previousValue.children.find((item) => item.label === value)
      : undefined;
    if (tree) {
      tree.setDescription();
      return tree;
    }

    const newTree = new TreeItem(value, undefined, undefined, []);
    previousValue.children?.push(newTree);
    return newTree;
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

export class TreeItem extends vscode.TreeItem {
  children: TreeItem[] | undefined;
  result: AstResult | undefined;
  size: number;

  constructor(
    label: string,
    type?: string,
    result?: AstResult,
    children?: TreeItem[]
  ) {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.result = result;
    this.size = 1;
    this.contextValue = type;
    this.children = children;
    if (type) {
      this.iconPath = new vscode.ThemeIcon("shield");
    }

    if (type === "project") {
      this.iconPath = new vscode.ThemeIcon("project");
    }
    if (type === "branch") {
      this.iconPath = new vscode.ThemeIcon("repo");
    }
    if (result) {
      this.iconPath = result.getIcon();
    }
  }

  setDescription() {
    +this.size++;
    this.description = "" + this.size;
  }
}
