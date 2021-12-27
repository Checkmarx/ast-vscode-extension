import * as vscode from "vscode";
import { AstResultsProvider } from "../ast_results_provider";
import { Logs } from "../models/logs";
import { REFRESH_TREE } from "./commands";
import {HIGH_FILTER, INFO_FILTER, IssueLevel, LOW_FILTER, MEDIUM_FILTER} from "./constants";

export async function initializeFilters(logs: Logs,
	context: vscode.ExtensionContext,
	astResultsProvider: AstResultsProvider) {

	logs.info(`Initialize filters`);
	const high = context.globalState.get<boolean>(HIGH_FILTER) ?? true;
	updateResultsProvider(astResultsProvider, IssueLevel.high, high);
	await updateFilter(context, HIGH_FILTER, high);

	const medium = context.globalState.get<boolean>(MEDIUM_FILTER) ?? true;
	updateResultsProvider(astResultsProvider, IssueLevel.medium, medium);
	await updateFilter(context, MEDIUM_FILTER, medium);

	const low = context.globalState.get<boolean>(LOW_FILTER) ?? true;
	updateResultsProvider(astResultsProvider, IssueLevel.low, low);
	await updateFilter(context, LOW_FILTER, low);

	const info = context.globalState.get<boolean>(INFO_FILTER) ?? true;
	updateResultsProvider(astResultsProvider, IssueLevel.info, info);
	await updateFilter(context, INFO_FILTER, info);

	await vscode.commands.executeCommand(REFRESH_TREE);
}


export async function filter(logs: Logs,
	context: vscode.ExtensionContext,
	astResultsProvider: AstResultsProvider,
	issueLevel: IssueLevel,
	filter: string) {

	logs.info(`Filtering ${issueLevel} results`);
	const currentValue = context.globalState.get(filter);
	updateResultsProvider(astResultsProvider, issueLevel, !currentValue);

	await updateFilter(context, filter, !currentValue);
	await vscode.commands.executeCommand(REFRESH_TREE);
}

async function updateFilter(context: vscode.ExtensionContext, filter: string, value: boolean) {
	await context.globalState.update(filter, value);
	await vscode.commands.executeCommand("setContext", filter, value);
}

function updateResultsProvider(astResultsProvider: AstResultsProvider, issueLevel: IssueLevel, include: boolean) {
	const currentIncluded = astResultsProvider.issueLevel.includes(issueLevel);
	if (include && !currentIncluded) {
		astResultsProvider.issueLevel = astResultsProvider.issueLevel.concat([issueLevel]);
	}
	if (!include && currentIncluded) {
		astResultsProvider.issueLevel = astResultsProvider.issueLevel.filter((x) => {
			return x !== issueLevel;
		});
	}
}