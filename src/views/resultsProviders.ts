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
import { commands } from "../utils/common/commands";
export class ResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  protected _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
    new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;
  protected data: TreeItem[] | undefined;
  constructor(
    protected readonly context: vscode.ExtensionContext,
    protected readonly statusBarItem: vscode.StatusBarItem
  ) { }

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

  public getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
    // Required for tree.reveal() to work - it needs to know the parent hierarchy
    if (!this.data) {
      return undefined;
    }

    // Search for the parent of the given element
    const findParent = (items: TreeItem[], target: TreeItem, parent?: TreeItem): TreeItem | undefined => {
      for (const item of items) {
        if (item === target) {
          return parent;
        }
        if (item.children) {
          const found = findParent(item.children, target, item);
          if (found !== undefined) {
            return found;
          }
        }
      }
      return undefined;
    };

    return findParent(this.data, element);
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
      return constants.secretDetection;
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
      StateLevel.customStates,
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

        // --- SCA Hide Dev & Test Dependencies filter logic ---
        // Check if obj is an SCA node (adjust this check as needed for your model)
        const isScaNode = obj.type === constants.sca; // <-- replace with your actual SCA type label
        const scaHideDevTest = this.context.globalState.get<boolean>(constants.scaHideDevTestFilter) ?? false;

        if (
          isScaNode &&
          scaHideDevTest &&
          (
            (obj.data?.scaPackageData.isDevelopmentDependency === true) ||
            (obj.data?.scaPackageData.isTestDependency === true)
          )
        ) {
          // Skip adding this item if it's a dev dependency and the filter is ON
          return;
        }

        if (obj.sastNodes.length > 0) {
          this.createDiagnostic(
            obj.label,
            obj.getSeverityCode(),
            obj.sastNodes[0],
            folder,
            map,
            obj
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
    map: Map<string, vscode.Diagnostic[]>,
    resultForLink: AstResult
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

    //Add uniqueId to SASTNode object
    (diagnostic as vscode.Diagnostic & { data?: unknown }).data = {
      label: resultForLink.label,
      fileName: node.fileName,
      line: node.line,
      uniqueId: node.uniqueId
    };

    if (resultForLink.type === constants.sast) {
      const args = encodeURIComponent(JSON.stringify([{
        label: resultForLink.label,
        fileName: node.fileName,
        line: node.line,
        uniqueId: node.uniqueId
      }]));
      diagnostic.code = {
        value: "CxOne Result",
        target: vscode.Uri.parse(`command:${commands.openDetailsFromDiagnostic}?${args}`)
      };
    }

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
    newTree.setDescription();
    return newTree;
  }
}
