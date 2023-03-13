import * as vscode from "vscode";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import { AstResult } from "../../models/results";
import { SastNode } from "../../models/sastNode";
import { GRAPH_ITEM, IssueFilter } from "../common/constants";
import { Counter, getProperty } from "../utils";
import { TreeItem } from "./treeItem";

export function orderResults(list: CxResult[]): CxResult[] {
  const order = ["HIGH", "MEDIUM", "LOW", "INFO"];
  return list.sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
  );
}

export function createSummaryItem(list: CxResult[]): TreeItem {
  const counter = new Counter(list, (p: CxResult) => p.severity);
  const label = Array.from(counter.keys())
    .map((key) => `${key}: ${counter.get(key)}`)
    .join(" | ");
  return new TreeItem(label, GRAPH_ITEM, undefined);
}

export function groupBy(
  list: Object[],
  groups: string[],
  scan: string | undefined,
  diagnosticCollection: vscode.DiagnosticCollection
): TreeItem {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const map = new Map<string, vscode.Diagnostic[]>();

  const tree = scan ? new TreeItem(scan, undefined, undefined, []) : undefined;
  list.forEach((element: any) => {
    groupTree(element, folder, map, groups, tree);
  });

  diagnosticCollection.clear();
  map.forEach((value, key) =>
    diagnosticCollection.set(vscode.Uri.parse(key), value)
  );

  return tree;
}

export function groupTree(
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
  let node;
  // Verify the current severity filters applied

  if (obj.sastNodes.length > 0) {
    createDiagnostic(
      obj.label,
      obj.getSeverityCode(),
      obj.sastNodes[0],
      folder,
      map
    );
  }
  node = groups.reduce(
    (previousValue: TreeItem, currentValue: string) =>
      reduceGroups(obj, previousValue, currentValue),
    tree
  );
  node.children?.push(item);
}

export function createDiagnostic(
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

export function reduceGroups(
  obj: any,
  previousValue: TreeItem,
  currentValue: string
) {
  var value = getProperty(obj, currentValue);

  // Needed to group by filename in kics, in case nothing is found then its a kics result and must be found inside data.filename
  if (currentValue === IssueFilter.fileName && value.length === 0) {
    value = getProperty(obj.data, IssueFilter.fileName.toLowerCase());
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
