import * as vscode from "vscode";
import { EventEmitter } from "vscode";
import { TreeItem } from "../utils/tree/treeItem";
import {
  GroupBy,
  SeverityLevel,
  StateLevel,
  constants,
} from "../utils/common/constants";
import CxResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/results/CxResult";
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

  // Required for tree.reveal() to work - it needs to know the parent hierarchy
  public getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {

    if (!this.data) {
      return undefined;
    }

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

    const line = node.line > 0 ? +node.line - 1 : 1;

    let range: vscode.Range;

    // For SCA results, highlight at the end of the file page
    if (resultForLink.type === constants.sca) {
      range = new vscode.Range(
        new vscode.Position(Number.MAX_SAFE_INTEGER, 0),
        new vscode.Position(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      );
    } else {
      // For SAST, use the original highlighting
      const column = node.column > 0 ? +node.column - 1 : 1;
      const length = column + node.length;
      range = new vscode.Range(
        new vscode.Position(line, column),
        new vscode.Position(line, length)
      );
    }

    const metadata = {
      label: resultForLink.label,
      fileName: node.fileName,
      line: node.line,
      uniqueId: node.uniqueId,
      packageIdentifier: resultForLink.scaNode?.packageIdentifier,
      resultId: resultForLink.id
    };

    // Link name for both SAST and SCA results
    const shouldAddCodeLink = resultForLink.type === constants.sast || resultForLink.type === constants.sca;
    const linkText = resultForLink.type === constants.sca ? "Checkmarx One SCA Realtime Result" : "Checkmarx One Result";
    this.addDiagnosticToMap(label, severity, node.fileName, range, metadata, folder, map, shouldAddCodeLink, linkText);
  }

  private addDiagnosticToMap(
    label: string,
    severity: vscode.DiagnosticSeverity,
    fileName: string,
    range: vscode.Range,
    metadata: Record<string, unknown>,
    folder: vscode.WorkspaceFolder,
    map: Map<string, vscode.Diagnostic[]>,
    shouldAddCodeLink: boolean = true,
    linkText: string = "Checkmarx One Result"
  ) {
    const filePath = vscode.Uri.joinPath(folder.uri, fileName).toString();
    const diagnostic = new vscode.Diagnostic(range, label, severity);

    (diagnostic as vscode.Diagnostic & { data?: unknown }).data = metadata;

    if (shouldAddCodeLink) {
      const args = encodeURIComponent(JSON.stringify(metadata));
      diagnostic.code = {
        value: linkText,
        target: vscode.Uri.parse(`command:ast-results.openDetailsFromDiagnostic?${args}`)
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

  /**
   * Finds a result in the tree data by matching diagnostic payload information.
   * Searches through the tree using uniqueId (primary) or fileName+line (fallback).
   * 
   * @param payload - Diagnostic payload containing uniqueId, fileName, and line
   * @returns Object with matched TreeItem node and AstResult, or undefined if not found
   */
  public findResultByDiagnosticPayload(payload: {
    uniqueId?: string;
    fileName?: string;
    line?: number;
  }): { node: TreeItem; result: AstResult } | undefined {
    if (!this.data || this.data.length === 0) {
      return undefined;
    }

    const stack: TreeItem[] = [...this.data];

    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) {
        continue;
      }

      const matchResult = this.checkNodeForMatch(node, payload);
      if (matchResult) {
        return matchResult;
      }

      // Add children to stack for traversal
      if (Array.isArray(node.children)) {
        stack.push(...node.children);
      }
    }

    return undefined;
  }

  /**
   * Checks if a tree node contains a result matching the payload.
   */
  private checkNodeForMatch(
    node: TreeItem,
    payload: { uniqueId?: string; fileName?: string; line?: number }
  ): { node: TreeItem; result: AstResult } | undefined {
    if (!node.result) {
      return undefined;
    }

    const res = node.result as AstResult;
    const sastNodes = Array.isArray(res.sastNodes) ? res.sastNodes : [];

    if (sastNodes.length === 0) {
      return undefined;
    }

    const matchedNode = this.findMatchingSastNode(sastNodes, payload);
    if (matchedNode) {
      return { node, result: res };
    }

    return undefined;
  }

  /**
   * Finds a matching SastNode in an array based on payload criteria.
   * Matches by uniqueId (primary) or fileName+line (fallback).
   */
  private findMatchingSastNode(
    sastNodes: SastNode[],
    payload: {
      uniqueId?: string;
      fileName?: string;
      line?: number;
    }
  ): SastNode | undefined {
    const { uniqueId, fileName, line } = payload;

    // Primary match: by uniqueId
    if (uniqueId) {
      return sastNodes.find((sn: SastNode) => sn.uniqueId === uniqueId);
    }

    // Fallback match: by fileName and line
    if (fileName && line !== undefined) {
      return sastNodes.find(
        (sn: SastNode) => sn.fileName === fileName && Number(sn.line) === Number(line)
      );
    }

    return undefined;
  }

  /**
   * Opens a file at the specified location in the editor.
   * 
   * @param fileName - Relative path to the file
   * @param line - Line number (1-based)
   * @param column - Column number (1-based)
   * @returns Promise that resolves when file is opened
   */
  public async openFileAtLocation(
    fileName: string,
    line: number,
    column: number
  ): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || !fileName) {
      return;
    }

    try {
      const filePath = vscode.Uri.joinPath(folder.uri, fileName);
      const document = await vscode.workspace.openTextDocument(filePath);
      const position = this.calculateEditorPosition(line, column);

      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.One,
        selection: new vscode.Range(position, position),
      });
    } catch (error) {
      // File not found or cannot be opened - fail silently
      console.error(`Failed to open file: ${fileName}`, error);
    }
  }

  /**
   * Converts 1-based line/column numbers to 0-based VS Code position.
   */
  private calculateEditorPosition(line: number, column: number): vscode.Position {
    return new vscode.Position(
      line > 0 ? line - 1 : 0,
      column > 0 ? column - 1 : 0
    );
  }

  /**
   * Handles opening details from diagnostic panel.
   * Finds the result, opens the file, reveals in tree, and executes the details command.
   * 
   * @param payload - Diagnostic payload with uniqueId, fileName, line
   * @param treeView - The tree view to reveal the result in
   * @param detailsCommand - VS Code command name to execute for showing details
   * @param commandArgs - Additional arguments to pass to the details command
   * @returns Promise resolving to true if handled, false if not found
   */
  public async handleOpenDetailsFromDiagnostic(
    payload: {
      uniqueId?: string;
      fileName?: string;
      line?: number;
    },
    treeView: vscode.TreeView<TreeItem>,
    detailsCommand: string,
    commandArgs?: unknown[]
  ): Promise<boolean> {
    const match = this.findResultByDiagnosticPayload(payload);
    if (!match) {
      return false;
    }

    // Find the matched sastNode to get file location
    const sastNodes = match.result.sastNodes || [];
    const matchedNode = this.findMatchingSastNode(sastNodes, payload);

    // Open the file at the location
    if (matchedNode) {
      await this.openFileAtLocation(
        matchedNode.fileName,
        matchedNode.line,
        matchedNode.column
      );
    }

    // Reveal the result in the tree view
    await treeView.reveal(match.node, { select: true, focus: false, expand: true });

    // Execute the details command
    const args = [match.result, ...(commandArgs || [])];
    await vscode.commands.executeCommand(detailsCommand, ...args);

    return true;
  }
}
