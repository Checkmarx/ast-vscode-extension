import * as vscode from "vscode";
import { TreeItem } from "../../utils/tree/treeItem";

export class DastResultsProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        // Placeholder: Show a message that DAST is coming soon
        const placeholderItem = new TreeItem(
            "DAST scanning coming soon...",
            "info-item",
            undefined
        );
        placeholderItem.tooltip = "DAST scanning functionality is under development";
        return Promise.resolve([placeholderItem]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}

