import * as vscode from "vscode";
import { AstResult } from "../../models/results";
import { constants } from "../common/constants";

const typeToIconMap: Map<string, string> = new Map([
  [constants.graphItem, "graph"],
  [constants.projectItem, "project"],
  [constants.branchItem, "repo"],
  [constants.bookItem, "book"],
  [constants.requestChangesItem, "request-changes"],
  [constants.mailItem, "mail"],
  [constants.calendarItem, "calendar"],
]);

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
    this.size = 0;
    this.contextValue = type;
    this.children = children;

    if (type) {
      this.iconPath = new vscode.ThemeIcon("shield");
    }
    const vscodeIconValue = typeToIconMap.get(type);
    if (vscodeIconValue) {
      this.iconPath = new vscode.ThemeIcon(vscodeIconValue);
    }
    if (result) {
      // @ts-ignore
      this.iconPath = result.getTreeIcon();
    }
  }

  setDescription() {
    +this.size++;
    this.description = `(${this.size})`;
  }

  setDescriptionValue(description: string) {
    this.description = description;
  }
}
