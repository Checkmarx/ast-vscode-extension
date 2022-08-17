import * as vscode from "vscode";
import { AstResultsProvider } from "../ast_results_provider";
import { Logs } from "../models/logs";
import { REFRESH_TREE } from "./common/commands";
import {CONFIRMED_FILTER, HIGH_FILTER, NOT_IGNORED_FILTER, INFO_FILTER, IssueLevel, LOW_FILTER, MEDIUM_FILTER, NOT_EXPLOITABLE_FILTER, PROPOSED_FILTER, StateLevel, TO_VERIFY_FILTER, URGENT_FILTER, IGNORED_FILTER, IssueFilter, QUERY_NAME_GROUP, LANGUAGE_GROUP, SEVERITY_GROUP, STATUS_GROUP, STATE_GROUP, FILE_GROUP} from "./common/constants";
import { updateResultsProviderGroup } from "./group";

export async function initializeFilters(logs: Logs,
	context: vscode.ExtensionContext,
	astResultsProvider: AstResultsProvider) {

	logs.info(`Initializing severity filters`);
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
	
	logs.info(`Initializing state filters`);
	const notExploitable = context.globalState.get<boolean>(NOT_EXPLOITABLE_FILTER) ?? false;
	updateResultsProviderState(astResultsProvider, StateLevel.notExploitable, notExploitable);
	await updateFilter(context, NOT_EXPLOITABLE_FILTER, notExploitable);
	
	const proposed = context.globalState.get<boolean>(PROPOSED_FILTER) ?? false;
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

	const notIgnored = context.globalState.get<boolean>(NOT_IGNORED_FILTER) ?? true;
	updateResultsProviderState(astResultsProvider, StateLevel.notIgnored, notIgnored);
	await updateFilter(context, NOT_IGNORED_FILTER, notIgnored);

	const ignored = context.globalState.get<boolean>(IGNORED_FILTER) ?? true;
	updateResultsProviderState(astResultsProvider, StateLevel.ignored, ignored);
	await updateFilter(context, IGNORED_FILTER, ignored);
	
	logs.info(`Initializing group by selections`);
	const groupQueryName = context.globalState.get<boolean>(QUERY_NAME_GROUP) ?? false;
	updateResultsProviderGroup(astResultsProvider, IssueFilter.queryName, groupQueryName);
	await updateFilter(context, QUERY_NAME_GROUP, groupQueryName);
	await vscode.commands.executeCommand(REFRESH_TREE);

	const groupLanguage = context.globalState.get<boolean>(LANGUAGE_GROUP) ?? false;
	updateResultsProviderGroup(astResultsProvider, IssueFilter.language, groupLanguage);
	await updateFilter(context, LANGUAGE_GROUP, groupLanguage);
	await vscode.commands.executeCommand(REFRESH_TREE);
	
	// By default only get results grouped by severity 
	const groupBySeverity = context.globalState.get<boolean>(SEVERITY_GROUP) ?? true;
	updateResultsProviderGroup(astResultsProvider, IssueFilter.severity, groupBySeverity);
	await updateFilter(context, SEVERITY_GROUP, groupBySeverity);
	await vscode.commands.executeCommand(REFRESH_TREE);

	const groupByStatus = context.globalState.get<boolean>(STATUS_GROUP) ?? false;
	updateResultsProviderGroup(astResultsProvider, IssueFilter.status, groupByStatus);
	await updateFilter(context, STATUS_GROUP, groupByStatus);
	await vscode.commands.executeCommand(REFRESH_TREE);

	const groupByState = context.globalState.get<boolean>(STATE_GROUP) ?? false;
	updateResultsProviderGroup(astResultsProvider, IssueFilter.state, groupByState);
	await updateFilter(context, STATE_GROUP, groupByState);
	await vscode.commands.executeCommand(REFRESH_TREE);

	const groupByFileName = context.globalState.get<boolean>(FILE_GROUP) ?? false;
	updateResultsProviderGroup(astResultsProvider, IssueFilter.fileName, groupByFileName);
	await updateFilter(context, FILE_GROUP, groupByFileName);
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

export async function updateFilter(context: vscode.ExtensionContext, filter: string, value: boolean) {
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

