import * as vscode from "vscode";
import { AstResultsProvider } from "../ast_results_provider";
import { Logs } from "../models/logs";
import { REFRESH_TREE } from "./common/commands";
import { IssueFilter } from "./common/constants";
import { updateFilter } from "./filters";


export async function group(logs: Logs, context:vscode.ExtensionContext, astResultsProvider: AstResultsProvider, issueFilter: IssueFilter, filter: string) {
	logs.info(`Grouping by ${issueFilter}`);
	const currentValue = context.globalState.get(filter);
	updateResultsProviderGroup(astResultsProvider, issueFilter, !currentValue);
	await updateFilter(context, filter, !currentValue);
	await vscode.commands.executeCommand(REFRESH_TREE);
	await astResultsProvider.refreshData();
}

export function updateResultsProviderGroup(astResultsProvider: AstResultsProvider, issueFilter: IssueFilter, include: boolean) {
	const currentIncluded = astResultsProvider.issueFilter.includes(issueFilter);
	if (include && !currentIncluded) {
		astResultsProvider.issueFilter = astResultsProvider.issueFilter.concat([issueFilter]);
	}
	if (!include && currentIncluded) {
		astResultsProvider.issueFilter = astResultsProvider.issueFilter.filter((x) => {
			return x !== issueFilter;
		});
	}
}