import * as vscode from "vscode";
import { Cx } from "../../cx/cx";
import { Logs } from "../../models/logs";
import { AST_ERROR_CODEBASHING_NO_LESSON, AST_ERROR_CODEBASHING_NO_LICENSE, ERROR_REGEX } from "../common/constants";
import AstError from "../../exceptions/AstError";

const CODEBASHING_NO_LICENSE: string = "You don't have a license for Codebashing. Please Contact your Admin for the full version implementation. Meanwhile, you can use the link below.";
const CODEBASHING_NO_LESSON: string = "Currently, this vulnerability has no lesson";

const PROGRESS_HEADER: vscode.ProgressOptions = {
	location: vscode.ProgressLocation.Notification,
	title: "Getting codebashing link",
	cancellable: false,
};

export async function getCodebashingLink(cweId: string, language: string, queryName: string, logs: Logs) {
	vscode.window.withProgress(PROGRESS_HEADER,
		async (progress, token) => {
			token.onCancellationRequested(() => logs.info("Canceled loading"));
			try {
				const cx =  new Cx();
				logs.info("Fetching codebashing link");
				const codeBashingArray = await cx.getCodeBashing(cweId, language, queryName);
				vscode.env.openExternal(vscode.Uri.parse(codeBashingArray!.path));
			} catch (err) {
				logs.error("Failed getting codebashing link");
				if (err instanceof AstError) {
					if (err.code === AST_ERROR_CODEBASHING_NO_LICENSE) {
						vscode.window.showInformationMessage(CODEBASHING_NO_LICENSE, 'Codebashing')
							.then(selection => vscode.env.openExternal(vscode.Uri.parse('https://free.codebashing.com')));
						return;
					} else if (err.code === AST_ERROR_CODEBASHING_NO_LESSON) {
						vscode.window.showInformationMessage(CODEBASHING_NO_LESSON);
						return;
					}
				}
		
				vscode.window.showWarningMessage(String(err).replace(ERROR_REGEX, "").replaceAll("\n", ""));	
		}
	});
}
