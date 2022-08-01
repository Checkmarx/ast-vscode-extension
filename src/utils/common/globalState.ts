import * as vscode from "vscode";
import { ERROR } from "./constants";

export function update(context: vscode.ExtensionContext, key: string, item: Item | undefined) {
	context.workspaceState.update(key, item);
}
export function get(context: vscode.ExtensionContext, key: string): Item | undefined {
	return context.workspaceState.get(key);
}

export function getError(context: vscode.ExtensionContext): string | undefined {
	return context.workspaceState.get(ERROR);
}

export function updateError(context: vscode.ExtensionContext, item: string){
	return context.workspaceState.update(ERROR,item);
}
export class Item {
	id: string| any | undefined;
    name: string | undefined;
}