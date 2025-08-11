
import * as vscode from "vscode";
import { HoverData, SecretsHoverData, CxDiagnosticData, ContainersHoverData, AscaHoverData } from "../common/types";
import { commands } from "../../utils/common/commands";



export class CxCodeActionProvider implements vscode.CodeActionProvider {




	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken
	): vscode.CodeAction[] | undefined {
		const actions: vscode.CodeAction[] = [];

		for (const diagnostic of context.diagnostics) {
			const data = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;

			if (!data || !data.item || !data.cxType) {
				continue;
			}

			const item = data.item as HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData;


			const fixWithCxButton = `Fix with CxOne Assist`;

			const fixAction = new vscode.CodeAction(
				fixWithCxButton,
				vscode.CodeActionKind.QuickFix
			);
			fixAction.command = {
				command: commands.openAIChat,
				title: fixWithCxButton,
				arguments: [item]
			};

			const viewDetails = "View details";
			const explainAction = new vscode.CodeAction(
				viewDetails,
				vscode.CodeActionKind.QuickFix
			);
			explainAction.command = {
				command: commands.viewDetails,
				title: explainAction.title,
				arguments: [item]
			};
			const ignoreVulnerbility = this.isEligibleForIgnoreSecret(item)
				? "Ignore this secret in file"
				: "Ignore this vulnerability";
			const ignoreAction = new vscode.CodeAction(ignoreVulnerbility, vscode.CodeActionKind.QuickFix);
			ignoreAction.command = {
				command: commands.ignorePackage,
				title: ignoreAction.title,
				arguments: [item]
			};

			const actionList = [fixAction, explainAction, ignoreAction];

			if (this.isEligibleForIgnoreAll(item)) {
				const ignoreAllVulnerbility = "Ignore all of this type";
				const ignoreAllAction = new vscode.CodeAction(ignoreAllVulnerbility, vscode.CodeActionKind.QuickFix);
				ignoreAllAction.command = {
					command: commands.ignoreAll,
					title: ignoreAllAction.title,
					arguments: [item]
				};
				actionList.push(ignoreAllAction);
			}


			actions.push(...actionList);
		}

		return actions.length ? actions : undefined;
	}

	private isEligibleForIgnoreAll(
		item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData
	): boolean {
		return "packageManager" in item || "imageName" in item;
	}

	private isEligibleForIgnoreSecret(
		item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData
	): boolean {
		return "title" in item && "secretValue" in item;
	}
}
