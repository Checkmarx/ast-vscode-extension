import * as vscode from "vscode";

export function update(context: vscode.ExtensionContext, key: string, item: Item | undefined) {
	context.globalState.update(key, item);
}
export function get(context: vscode.ExtensionContext, key: string): Item | undefined {
	return context.globalState.get(key);
}

export class Item {
	id: string| undefined;
    name: string | undefined;
}