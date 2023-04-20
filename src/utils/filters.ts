import * as vscode from "vscode";

export async function updateFilter(
  context: vscode.ExtensionContext,
  filter: string,
  value: boolean
) {
  await context.globalState.update(filter, value);
  await vscode.commands.executeCommand("setContext", filter, value);
}
