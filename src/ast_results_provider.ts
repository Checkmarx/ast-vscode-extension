import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'vscode';
import { AstResult, SastNode } from './results';
import { EXTENSION_NAME, SCAN_ID_KEY } from './constants';
import { getProperty } from './utils';

export enum IssueFilter {
  fileName = "fileName",
  severity = "severity",
  status = "status",
  language = "language"
}

export class AstResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  public issueFilter: IssueFilter = IssueFilter.severity;

  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> = new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;
  private scanId: string;
  private data: TreeItem[] | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
    private readonly statusBarItem: vscode.StatusBarItem,
    private readonly diagnosticCollection: vscode.DiagnosticCollection) {
      this.scanId = this.context.globalState.get(SCAN_ID_KEY, "");
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

  refresh(): void {
    this.refreshData();
    this._onDidChangeTreeData.fire(undefined);
  }

  clean(): void {
		const resultJsonPath = path.join(__dirname, 'ast-results.json');
		if (fs.existsSync(resultJsonPath)) {
			fs.unlinkSync(resultJsonPath);
		}
    
    this.refreshData();
    this._onDidChangeTreeData.fire(undefined);
  }

  refreshData(): void {
    this.showStatusBarItem();
    this.scanId = this.context.globalState.get(SCAN_ID_KEY, "");
    this.data = this.generateTree().children;
    this.hideStatusBarItem();
  }

  generateTree(): TreeItem {
    const resultJsonPath = path.join(__dirname, 'ast-results.json');
    if (!fs.existsSync(resultJsonPath)) {
      this.diagnosticCollection.clear();
      return new TreeItem("", undefined, []);
    } 

    const jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, 'utf-8'));

    const groups = ['type', this.issueFilter];
    return this.groupBy(jsonResults.results, groups);
  }

  groupBy(list: Object[], groups: string[]): TreeItem {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const map = new Map<string, vscode.Diagnostic[]>();
    const tree = new TreeItem(this.scanId, undefined, []);

    list.forEach(element => this.groupTree(element, folder, map, groups, tree));

    this.diagnosticCollection.clear();
    map.forEach((value, key) => this.diagnosticCollection.set(vscode.Uri.parse(key), value));
    
    return tree;
  }

  groupTree(rawObj: Object, folder: vscode.WorkspaceFolder | undefined, map: Map<string, vscode.Diagnostic[]>, groups: string[], tree: TreeItem) {
    const obj = new AstResult(rawObj);
    if (!obj) { return; }

    const item = new TreeItem(obj.label, obj);
    if (obj.sastNodes.length > 0) {this.createDiagnostic(obj.label, obj.getSeverityCode(), obj.sastNodes[0], folder, map);}
    //obj.sastNodes.forEach((node) => this.createDiagnostic(obj.label, obj.severity, node, folder, map));
    
    const node = groups.reduce((previousValue: TreeItem, currentValue: string) => this.reduceGroups(obj, previousValue, currentValue), tree);
    node.children?.push(item);
  }

  createDiagnostic(label: string, severity: vscode.DiagnosticSeverity, node: SastNode, folder: vscode.WorkspaceFolder | undefined, map: Map<string, vscode.Diagnostic[]>) {
    if(!folder) {
      return;
    }
    const filePath = vscode.Uri.joinPath(folder!.uri, node.fileName).toString();
    const column = (node.column | 1) - 1;
    const line =  (node.line | 1 ) - 1;
    let length = column + node.length;
    const range = new vscode.Range(line, column, line, length);
    
    const diagnostic = new vscode.Diagnostic(range, label, severity);
    if (map.has(filePath)) {
      map.get(filePath)?.push(diagnostic);
    } else {
      map.set(filePath, [diagnostic]);
    }
  }

  reduceGroups(obj: Object, previousValue: TreeItem, currentValue: string) {
    const value = getProperty(obj, currentValue);
    if (!value) { return previousValue; }

    const tree = previousValue.children ? previousValue.children.find(item => (item.label === value)) : undefined;
    if (tree) {
      tree.setDescription();
      return tree;
    }

    const newTree = new TreeItem(value, undefined, []);
    previousValue.children?.push(newTree);
    return newTree;
  }

  getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
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

  constructor(label: string, result?: AstResult, children?: TreeItem[]) {
    super(
      label,
      children === undefined ? vscode.TreeItemCollapsibleState.None :
        vscode.TreeItemCollapsibleState.Collapsed);
    this.result = result;
    this.size = 1;
    this.children = children;
    if (result) {
      this.iconPath =  new vscode.ThemeIcon(result.getIcon());
    }
  };

  setDescription() {
    +this.size++;
    this.description = "" + this.size;
  }
}

