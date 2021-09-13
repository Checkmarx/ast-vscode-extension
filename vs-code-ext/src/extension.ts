import * as vscode from 'vscode';
import * as ast from './ast_results_provider';
import { AstDetailsViewProvider } from "./ast_details_view";
import { ResultNodeType } from "./ast_results_provider";
import { AstResult } from "./ast_results_provider";
import { AstProjectBindingViewProvider } from './ast_project_binding';

export function activate(context: vscode.ExtensionContext) {
	//
	/// Setup the results provider view
	//
	const astResultsProvider = new ast.AstResultsProvider();
	vscode.window.registerTreeDataProvider('astResults', astResultsProvider);	
	//
	/// Setup the project selector view
	//
	let projectView = new AstProjectBindingViewProvider(context.extensionUri);
	let projectProvider = vscode.window.registerWebviewViewProvider(
		AstProjectBindingViewProvider.viewType, projectView);
	context.subscriptions.push(projectProvider);
	//
	/// Setup the details view
	//
	let provider = new AstDetailsViewProvider(context.extensionUri);
	let detailsProvider = vscode.window.registerWebviewViewProvider(
		AstDetailsViewProvider.viewType, provider);
	context.subscriptions.push(detailsProvider);


	//
	/// This is a hover test, it shows code issue when moused over
	//
	/*
	vscode.languages.registerHoverProvider('typescript', {
		provideHover(doc: vscode.TextDocument) {
			console.log(doc);
			let line = doc.lineAt
			let posAt = doc.positionAt;
			let lang = doc.languageId;
			let fileName = doc.fileName;
			return new vscode.Hover('Jeff was here!');
		}
	});
	*/

	//
	/// Add tree node commands
	//
	let sastNodeCmd = vscode.commands.registerCommand('ast-results.viewSastResult', (item: AstResult) => {
		// if(item.type === ResultNodeType.sast) {
		// 	provider.refresh(item);
		// }
		provider.refresh(item);
	});
	context.subscriptions.push(sastNodeCmd);
	// The severity filter
	let newCmd = vscode.commands.registerCommand('ast-results.filterSeverity', (item: AstResult) => {
		astResultsProvider.issueFilter = ast.IssueFilter.severity;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(newCmd);
	// The language filter
	newCmd = vscode.commands.registerCommand('ast-results.filterLanguage', (item: AstResult) => {
		astResultsProvider.issueFilter = ast.IssueFilter.language;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(newCmd);
	// The status filter
	newCmd = vscode.commands.registerCommand('ast-results.filterStatus', (item: AstResult) => {
		astResultsProvider.issueFilter = ast.IssueFilter.status;
		astResultsProvider.refresh();			
	});
	context.subscriptions.push(newCmd);
	// The file filter
	newCmd = vscode.commands.registerCommand('ast-results.filterFile', (item: AstResult) => {
		astResultsProvider.issueFilter = ast.IssueFilter.fileName;
		astResultsProvider.refresh();
	});
	context.subscriptions.push(newCmd);
	//
	/// Command pallet actions
	//
	let disposable = vscode.commands.registerCommand('ast-results.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from AST Results!');
	});
	context.subscriptions.push(disposable);
}

export function deactivate() {}
