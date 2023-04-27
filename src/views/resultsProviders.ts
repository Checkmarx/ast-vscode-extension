import * as vscode from "vscode";
import { EventEmitter } from "vscode";
import { TreeItem } from "../utils/tree/treeItem";
import { constants } from "../utils/common/constants";
export class ResultsProvider implements vscode.TreeDataProvider<TreeItem> {
	protected _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
		new EventEmitter<TreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
		this._onDidChangeTreeData.event;
	protected data: TreeItem[] | undefined;
	constructor(
		protected readonly context: vscode.ExtensionContext,
		protected readonly statusBarItem: vscode.StatusBarItem,
	) {
	}

	public getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
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

}