import * as vscode from 'vscode';
import * as ast from './ast_results_provider';
import { AstDetailsViewProvider } from "./ast_details_view";
import { AstResultsProvider } from "./ast_results_provider";
import { AstProjectBindingViewProvider } from './ast_project_binding';

export function activate(context: vscode.ExtensionContext) {
	const astResultsProvider = new AstResultsProvider();
	vscode.window.registerTreeDataProvider('astResults', astResultsProvider);	

	const projectView = new AstProjectBindingViewProvider(context.extensionUri);
	const projectProvider = vscode.window.registerWebviewViewProvider(
		AstProjectBindingViewProvider.viewType, projectView);
	context.subscriptions.push(projectProvider);

	const astDetailsViewProvider = new AstDetailsViewProvider(context.extensionUri);
	const viewProvider = vscode.window.registerWebviewViewProvider(
		AstDetailsViewProvider.viewType, astDetailsViewProvider);
	context.subscriptions.push(viewProvider);

	const refreshTree = vscode.commands.registerCommand('ast-results.refreshTree', () => {
		astResultsProvider.refresh();
	});
	context.subscriptions.push(refreshTree);


	const viewResult = vscode.commands.registerCommand('ast-results.viewResult', (item: ast.TreeItem) => {
		astDetailsViewProvider.refresh(item);
	});
	context.subscriptions.push(viewResult);
	
	const groupBySeverity = vscode.commands.registerCommand('ast-results.groupBySeverity', () => {
		astResultsProvider.issueFilter = ast.IssueFilter.severity;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(groupBySeverity);
	
	const groupByLanguage = vscode.commands.registerCommand('ast-results.groupByLanguage', () => {
		astResultsProvider.issueFilter = ast.IssueFilter.language;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(groupByLanguage);

	const groupByStatus = vscode.commands.registerCommand('ast-results.groupByStatus', () => {
		astResultsProvider.issueFilter = ast.IssueFilter.status;
		astResultsProvider.refresh();			
	});
	context.subscriptions.push(groupByStatus);

	const groupByFile = vscode.commands.registerCommand('ast-results.groupByFile', () => {
		astResultsProvider.issueFilter = ast.IssueFilter.fileName;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(groupByFile);
}

export function deactivate() {}
