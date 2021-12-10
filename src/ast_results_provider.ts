import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import { EventEmitter } from "vscode";
import { AstResult, SastNode } from "./models/results";
import {
  EXTENSION_NAME,
  IssueFilter,
  IssueLevel,
  SCAN_ID_KEY,
  PROJECT_ID_KEY,
  BRANCH_ID_KEY,
  SCAN_LABEL,
  PROJECT_LABEL,
  BRANCH_LABEL,
  PROJECT_ITEM,
  BRANCH_ITEM,
  SCAN_ITEM,
  GRAPH_ITEM,
} from "./utils/constants";
import {
  Counter,
  getProperty, getResultsFilePath,
} from "./utils/utils";
import { Logs } from "./models/logs";
import { get, update } from "./utils/globalState";


export class AstResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  public issueFilter: IssueFilter = IssueFilter.severity;
  public issueLevel: IssueLevel[] = [IssueLevel.high, IssueLevel.medium];

  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> = new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;
  private scan: string | undefined;
  private data: TreeItem[] | undefined;

  constructor(
      private readonly context: vscode.ExtensionContext,
      private readonly logs: Logs,
      private readonly statusBarItem: vscode.StatusBarItem,
      private readonly diagnosticCollection: vscode.DiagnosticCollection
  ) {}

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

  async refreshData(): Promise<void> {
    this.showStatusBarItem();
    this.data = this.generateTree().children;
    this._onDidChangeTreeData.fire(undefined);
    this.hideStatusBarItem();
  }

  generateTree(): TreeItem {
    const resultJsonPath = getResultsFilePath();
    this.diagnosticCollection.clear();

    let treeItems = [
      new TreeItem(get(this.context, PROJECT_ID_KEY)?.name ?? PROJECT_LABEL, PROJECT_ITEM),
      new TreeItem(get(this.context, BRANCH_ID_KEY)?.name ?? BRANCH_LABEL, BRANCH_ITEM),
      new TreeItem(get(this.context, SCAN_ID_KEY)?.name ?? SCAN_LABEL, SCAN_ITEM)];

    this.scan = get(this.context, SCAN_ID_KEY)?.id;
    if (fs.existsSync(resultJsonPath) && this.scan) {
     
      const jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, "utf-8"));
      treeItems = treeItems.concat(this.createSummaryItem(jsonResults.results));
      const groups = ["type", this.issueFilter];
      const treeItem = this.groupBy(jsonResults.results, groups);
      treeItem.label = `${SCAN_LABEL} ${this.scan}`;
      treeItems = treeItems.concat(treeItem);
    }

    return new TreeItem("", undefined, undefined, treeItems);
  }

  createSummaryItem(list: CxResult[]): TreeItem {
    const counter = new Counter(list, (p: CxResult) => p.severity);
    const label = Array.from(counter.keys()).map(key =>  `${key}: ${counter.get(key)}`).join(' | ');
    return new TreeItem(label, GRAPH_ITEM, undefined);
  }

  groupBy(list: Object[], groups: string[]): TreeItem {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const map = new Map<string, vscode.Diagnostic[]>();
    const tree = new TreeItem(this.scan ?? "", undefined, undefined, []);

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
    // TODO: Use a type enum
     if (type) {
      this.iconPath = new vscode.ThemeIcon("shield");
    }

    if (type) {
      this.iconPath = new vscode.ThemeIcon("shield");
    }
    if (type === GRAPH_ITEM) {
      this.iconPath = new vscode.ThemeIcon("graph");
    }
    if (type === PROJECT_ITEM) {
      this.iconPath = new vscode.ThemeIcon("project");
    }
    if (type === BRANCH_ITEM) {
      this.iconPath = new vscode.ThemeIcon("repo");
    }
    if (result) {
      this.iconPath = result.getTreeIcon();
    }
  }

  setDescription() {
    +this.size++;
    this.description = "" + this.size;
  }

  setDescriptionValue(description: string) {
    this.description = description;
  }
}
