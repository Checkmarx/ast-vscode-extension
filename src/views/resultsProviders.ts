import * as vscode from "vscode";
import { EventEmitter } from "vscode";
import { TreeItem } from "../utils/tree/treeItem";
import {
  GroupBy,
  SeverityLevel,
  StateLevel,
  constants,
} from "../utils/common/constants";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import { Counter } from "../models/counter";
import { AstResult } from "../models/results";
import { SastNode } from "../models/sastNode";
import { getProperty } from "../utils/utils";
export class ResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  protected _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
    new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;
  protected data: TreeItem[] | undefined;
  constructor(
    protected readonly context: vscode.ExtensionContext,
    protected readonly statusBarItem: vscode.StatusBarItem
  ) {}

  public getTreeItem(
    element: TreeItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  public getChildren(
    element?: TreeItem | undefined
  ): vscode.ProviderResult<TreeItem[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }
  protected hideStatusBarItem() {
    this.statusBarItem.text = constants.extensionName;
    this.statusBarItem.tooltip = undefined;
    this.statusBarItem.command = undefined;
    this.statusBarItem.hide();
  }
  protected showStatusBarItem(message: string) {
    this.statusBarItem.text = constants.refreshingTree;
    this.statusBarItem.tooltip = message;
    this.statusBarItem.show();
  }
  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public determineTypeLabel(result: CxResult): string | undefined {
    if (result.label) {
      return result.label;
    }
    if (result.type === constants.scsSecretDetection) {
      return constants.scs;
    }
    return undefined;
  }

  public createSummaryItem(list: CxResult[]): TreeItem {
    const filteredList = list.filter((result: CxResult) =>
      this.determineTypeLabel(result)
    );
    const counter = new Counter(filteredList, (p: CxResult) => p.severity);
    const label = Array.from(counter.keys())
      .map((key) => `${key}: ${counter.get(key)}`)
      .join(" | ");
    return new TreeItem(label, constants.graphItem, undefined);
  }

  public groupBy(
    list: object[],
    groups: string[],
    scan: string | undefined,
    diagnosticCollection: vscode.DiagnosticCollection,
    issueLevel: string[] = [
      SeverityLevel.critical,
      SeverityLevel.high,
      SeverityLevel.medium,
      SeverityLevel.low,
      SeverityLevel.info,
    ],
    stateLevel: string[] = [
      StateLevel.confirmed,
      StateLevel.toVerify,
      StateLevel.urgent,
      StateLevel.notIgnored,
    ]
  ): TreeItem {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const map = new Map<string, vscode.Diagnostic[]>();

    const tree = new TreeItem(scan ?? "", undefined, undefined, []);
    list.forEach((element: object) => {
      this.groupTree(
        element,
        folder,
        map,
        groups,
        tree,
        issueLevel,
        stateLevel
      );
    });

    diagnosticCollection.clear();
    map.forEach((value, key) =>
      diagnosticCollection.set(vscode.Uri.parse(key), value)
    );

    return tree;
  }

  private groupTree(
    rawObj: object,
    folder: vscode.WorkspaceFolder | undefined,
    map: Map<string, vscode.Diagnostic[]>,
    groups: string[],
    tree: TreeItem,
    issueLevel: string[],
    stateLevel: string[]
  ) {
    const obj = new AstResult(rawObj);
    if (!obj || !obj.typeLabel) {
      return;
    }
    const item = new TreeItem(obj.label.replaceAll("_", " "), undefined, obj);
    let node;
    // Verify the current severity filters applied
    if (issueLevel.length > 0) {
      // Filter only the results for the severity and state filters type
      if (
        (!obj.getState() || issueLevel.includes(obj.getSeverity())) &&
        (!obj.getState() || stateLevel.includes(obj.getState()))
      ) {
        if (obj.sastNodes.length > 0) {
          this.createDiagnostic(
            obj.label,
            obj.getSeverityCode(),
            obj.sastNodes[0],
            folder,
            map
          );
        }
        node = groups.reduce(
          (previousValue: TreeItem, currentValue: string) =>
            this.reduceGroups(obj, previousValue, currentValue),
          tree
        );
        node.children?.push(item);
      }
    }
  }

  private createDiagnostic(
    label: string,
    severity: vscode.DiagnosticSeverity,
    node: SastNode,
    folder: vscode.WorkspaceFolder | undefined,
    map: Map<string, vscode.Diagnostic[]>
  ) {
    if (!folder) {
      return;
    }
    const filePath = vscode.Uri.joinPath(folder?.uri, node.fileName).toString();
    // Needed because vscode uses zero based line number
    const column = node.column > 0 ? +node.column - 1 : 1;
    const line = node.line > 0 ? +node.line - 1 : 1;
    const length = column + node.length;
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

  private reduceGroups(
    obj: AstResult,
    previousValue: TreeItem,
    currentValue: string
  ) {
    let value = getProperty(obj, currentValue);

    // Needed to group by filename in kics, in case nothing is found then its a kics result and must be found inside data.filename
    if (currentValue === GroupBy.fileName && value.length === 0) {
      value = getProperty(obj.data, GroupBy.fileName.toLowerCase());
    }

    if (!value) {
      return previousValue;
    }

    const tree = previousValue.children
      ? previousValue.children.find(
          (item) => item.label === value.replaceAll("_", " ")
        )
      : undefined;
    if (tree) {
      tree.setDescription();
      return tree;
    }

    const newTree = new TreeItem(
      value.replaceAll("_", " "),
      undefined,
      undefined,
      []
    );
    previousValue.children?.push(newTree);
    return newTree;
  }
}
