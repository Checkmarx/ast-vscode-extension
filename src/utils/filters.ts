import * as vscode from "vscode";
import { AstResultsProvider } from "../ast_results_provider";
import { Logs } from "../models/logs";
import { REFRESH_TREE } from "./commands";
import {CONFIRMED_FILTER, HIGH_FILTER, IGNORED_FILTER, INFO_FILTER, IssueLevel, LOW_FILTER, MEDIUM_FILTER, NOT_EXPLOITABLE_FILTER, PROPOSED_FILTER, StateLevel, TO_VERIFY_FILTER, URGENT_FILTER} from "./constants";

export async function initializeFilters(logs: Logs,
	context: vscode.ExtensionContext,
	astResultsProvider: AstResultsProvider) {

	logs.info(`Initialize severity filters`);
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
	
	logs.info(`Initialize state filters`);
	const notExploitable = context.globalState.get<boolean>(NOT_EXPLOITABLE_FILTER) ?? true;
	updateResultsProviderState(astResultsProvider, StateLevel.notExploitable, notExploitable);
	await updateFilter(context, NOT_EXPLOITABLE_FILTER, notExploitable);
	
	const proposed = context.globalState.get<boolean>(PROPOSED_FILTER) ?? true;
	updateResultsProviderState(astResultsProvider, StateLevel.proposed, proposed);
	await updateFilter(context, PROPOSED_FILTER, proposed);

	const confirmed = context.globalState.get<boolean>(CONFIRMED_FILTER) ?? true;
	updateResultsProviderState(astResultsProvider, StateLevel.confirmed, confirmed);
	await updateFilter(context, CONFIRMED_FILTER, confirmed);

	const toVerify = context.globalState.get<boolean>(TO_VERIFY_FILTER) ?? true;
	updateResultsProviderState(astResultsProvider, StateLevel.toVerify, toVerify);
	await updateFilter(context, TO_VERIFY_FILTER, toVerify);

	const urgent = context.globalState.get<boolean>(URGENT_FILTER) ?? true;
	updateResultsProviderState(astResultsProvider, StateLevel.urgent, urgent);
	await updateFilter(context, URGENT_FILTER, urgent);

	const ignored = context.globalState.get<boolean>(IGNORED_FILTER) ?? true;
	updateResultsProviderState(astResultsProvider, StateLevel.ignored, ignored);
	await updateFilter(context, IGNORED_FILTER, ignored);

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

export async function filterState(logs: Logs,
	context: vscode.ExtensionContext,
	astResultsProvider: AstResultsProvider,
	stateLevel:StateLevel,
	filter: string) {

	logs.info(`Filtering ${stateLevel} results`);
	const currentValue = context.globalState.get(filter);
	updateResultsProviderState(astResultsProvider, stateLevel, !currentValue);

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

function updateResultsProviderState(astResultsProvider: AstResultsProvider, stateLevel: StateLevel, include: boolean) {
	const currentIncluded = astResultsProvider.stateLevel.includes(stateLevel);
	if (include && !currentIncluded) {
		astResultsProvider.stateLevel = astResultsProvider.stateLevel.concat([stateLevel]);
	}
	if (!include && currentIncluded) {
		astResultsProvider.stateLevel = astResultsProvider.stateLevel.filter((x) => {
			return x !== stateLevel;
		});
	}
}