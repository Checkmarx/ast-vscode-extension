import "../mocks/vscode-mock";
import { expect } from "chai";
import * as vscode from "vscode";
import { TreeItem } from "../../utils/tree/treeItem";
import { constants } from "../../utils/common/constants";

describe("TreeItem", () => {
  it("should create leaf item without children", () => {
    const item = new TreeItem("label");
    expect(item.label).to.equal("label");
    expect(item.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.None);
  });

  it("should create parent item with collapsed children", () => {
    const child = new TreeItem("child");
    const parent = new TreeItem("parent", constants.projectItem, undefined, [child]);
    expect(parent.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Collapsed);
    expect(parent.children).to.have.lengthOf(1);
  });

  it("should assign icon from type map", () => {
    const item = new TreeItem("project", constants.projectItem);
    expect(item.iconPath).to.exist;
  });

  it("should use result icon when result is provided", () => {
    const result = { getTreeIcon: () => new vscode.ThemeIcon("bug") } as any;
    const item = new TreeItem("finding", constants.graphItem, result);
    expect(item.iconPath).to.exist;
  });

  it("should increment description size", () => {
    const item = new TreeItem("group");
    item.setDescription();
    item.setDescription();
    expect(item.description).to.equal("(2)");
  });

  it("should set explicit description value", () => {
    const item = new TreeItem("group");
    item.setDescriptionValue("custom");
    expect(item.description).to.equal("custom");
  });
});
