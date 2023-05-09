import * as vscode from "vscode";
import { AstResult } from "../../models/results";
import { GRAPH_ITEM, PROJECT_ITEM, BRANCH_ITEM } from "../common/constants";
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
