import * as vscode from "vscode";
import { TreeItem } from "../../utils/tree/treeItem";
import { constants } from "../../utils/common/constants";
import { DOC_LINKS } from "../../constants/documentation";

export class DocAndFeedbackView implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;

    private treeItems: Map<TreeItem, string>;

    constructor(documentationUrl: string) {
        this.treeItems = new Map<TreeItem, string>([
            [new TreeItem(constants.documentation, constants.bookItem, undefined), documentationUrl],
            [new TreeItem(constants.feedback, constants.mailItem, undefined), DOC_LINKS.feedback],
        ]);
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            return Promise.resolve(Array.from(this.treeItems.keys()));
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getUrl(treeItem: TreeItem): string | undefined {
        return this.treeItems.get(treeItem);
    }
}