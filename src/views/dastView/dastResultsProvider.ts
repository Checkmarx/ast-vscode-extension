import * as vscode from "vscode";
import { TreeItem } from "../../utils/tree/treeItem";
import { getFromState } from '../../utils/common/globalState';
import { constants } from '../../utils/common/constants';

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
        const env = getFromState(vscode.extensions.getExtension('checkmarx.ast-vscode-extension').exports.context, constants.environmentIdKey);
        const envLabel = env?.name || constants.environmentLabel || 'Environment';
        const envItem = new TreeItem(envLabel, 'environment-item');
        envItem.tooltip = 'Select and search for environments';

        return Promise.resolve([envItem]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}

