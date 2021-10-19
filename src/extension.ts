import * as vscode from "vscode";
var fs = require("fs");
import * as ast from "./ast_results_provider";
import { AstDetailsViewProvider } from "./ast_details_view";
import { AstResultsProvider, TreeItem } from "./ast_results_provider";
import { AstProjectBindingViewProvider } from "./ast_project_binding";
import { EXTENSION_NAME } from "./constants";
import { Logs } from "./logs";

export function activate(context: vscode.ExtensionContext) {
	const diagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_NAME);
	const output = vscode.window.createOutputChannel(EXTENSION_NAME);
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	const logs = new Logs(output);

	const projectView = new AstProjectBindingViewProvider(context, context.extensionUri, statusBarItem,logs);
	const projectProvider = vscode.window.registerWebviewViewProvider(`astProjectView`, projectView);
	context.subscriptions.push(projectProvider);
	
	const astResultsProvider = new AstResultsProvider(context, logs, statusBarItem, diagnosticCollection);
	vscode.window.registerTreeDataProvider(`astResults`, astResultsProvider);	
	
	const tree = vscode.window.createTreeView("astResults", {treeDataProvider: astResultsProvider, showCollapseAll: true });
    tree.onDidChangeSelection((item) => {
		if (!item.selection[0].children) {
			astDetailsViewProvider.refresh(item.selection[0]);
		}
	});

	logs.show();
    logs.log("Info","Checkmarx plugin is running");

	const astDetailsViewProvider = new AstDetailsViewProvider(context.extensionUri);
	const viewProvider = vscode.window.registerWebviewViewProvider(`astDetailsView`, astDetailsViewProvider);
	context.subscriptions.push(viewProvider);

	const cleanTree = vscode.commands.registerCommand(`${EXTENSION_NAME}.cleanTree`, () => {
		astResultsProvider.clean();
		astDetailsViewProvider.clean();
	});
	context.subscriptions.push(cleanTree);

	const refreshTree = vscode.commands.registerCommand(`${EXTENSION_NAME}.refreshTree`, () => {
		astResultsProvider.refresh();
	});
	context.subscriptions.push(refreshTree);
	
	const viewSeetings = vscode.commands.registerCommand(`${EXTENSION_NAME}.viewSettings`, () => {
		vscode.commands.executeCommand("workbench.action.openSettings", `checkmarx`);
	});
	context.subscriptions.push(viewSeetings);

	const viewResult = vscode.commands.registerCommand(`${EXTENSION_NAME}.viewResult`, (item: ast.TreeItem) => {
		astDetailsViewProvider.refresh(item);
	});
	context.subscriptions.push(viewResult);
	
	const groupBySeverity = vscode.commands.registerCommand(`${EXTENSION_NAME}.groupBySeverity`, () => {
		logs.log("Info","Group by severity");
		astResultsProvider.issueFilter = ast.IssueFilter.severity;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(groupBySeverity);
	
	const groupByLanguage = vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByLanguage`, () => {
		logs.log("Info","Group by language");
		astResultsProvider.issueFilter = ast.IssueFilter.language;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(groupByLanguage);

	const groupByStatus = vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStatus`, () => {
		logs.log("Info","Group by status");
		astResultsProvider.issueFilter = ast.IssueFilter.status;
		astResultsProvider.refresh();			
	});
	context.subscriptions.push(groupByStatus);

	const groupByFile = vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByFile`, () => {
		logs.log("Info","Group by fileName");
		astResultsProvider.issueFilter = ast.IssueFilter.fileName;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(groupByFile);

	const clearResults = vscode.commands.registerCommand(`${EXTENSION_NAME}.cleanResults`, () => {
		logs.log("Info","Clear results");
		diagnosticCollection.clear();
	});
	context.subscriptions.push(clearResults);

}

export function deactivate() {}
