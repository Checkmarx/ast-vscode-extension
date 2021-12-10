import { AstResultsProvider } from "../ast_results_provider";
import { Logs } from "../models/logs";
import { IssueFilter } from "./constants";


export async function group(logs: Logs, astResultsProvider: AstResultsProvider, issueFilter: IssueFilter) {
	logs.info(`Group by ${issueFilter}`);
	astResultsProvider.issueFilter = issueFilter;
	await astResultsProvider.refreshData();
}