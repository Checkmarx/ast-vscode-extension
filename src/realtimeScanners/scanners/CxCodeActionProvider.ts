
import * as vscode from "vscode";
import { HoverData, SecretsHoverData, CxDiagnosticData } from "../common/types";
import { commands } from "../../utils/common/commands";
import { isCursorIDE } from "../../utils/utils";


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

			const item = data.item as HoverData | SecretsHoverData;

			const isCursor = isCursorIDE();
			const fixWithCxButton = `Fix with CxAI & ${isCursor ? "Cursor" : "Copilot"}`;

			const fixAction = new vscode.CodeAction(
				fixWithCxButton,
				vscode.CodeActionKind.QuickFix
			);
			fixAction.command = {
				command: commands.openAIChat,
				title: fixWithCxButton,
				arguments: [item]
			};

			const explainAction = new vscode.CodeAction(
				data.cxType === "secrets" ? "CxAI Explain" : "View CxAI Package Details",
				vscode.CodeActionKind.QuickFix
			);
			explainAction.command = {
				command: commands.viewDetails,
				title: explainAction.title,
				arguments: [item]
			};

			actions.push(fixAction, explainAction);
		}

		return actions.length ? actions : undefined;
	}
}
