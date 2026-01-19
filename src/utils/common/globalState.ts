import * as vscode from "vscode";
import { constants } from "./constants";

export async function updateState(
  context: vscode.ExtensionContext,
  key: string,
  item: Item | undefined
) {
  await context.workspaceState.update(key, item);
}

export function getFromState(
  context: vscode.ExtensionContext,
  key: string
): Item | undefined {
  return context.workspaceState.get(key);
}

export function getErrorFromState(context: vscode.ExtensionContext): string | undefined {
  return context.workspaceState.get(constants.error);
}

export function updateStateError(context: vscode.ExtensionContext, item: string) {
  return context.workspaceState.update(constants.error, item);
}

export async function updateStateFilter(
  context: vscode.ExtensionContext,
  filter: string,
  value: boolean
) {
  await context.globalState.update(filter, value);
  await vscode.commands.executeCommand("setContext", filter, value);
}

export class Item {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  id: string | any | undefined;
  name: string | undefined;
  scanDatetime: string | undefined;
  displayScanId: string | undefined;
  // Generic data field for storing additional item-specific data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}
