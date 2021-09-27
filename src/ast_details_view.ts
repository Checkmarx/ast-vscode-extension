import { pathToFileURL } from 'url';
import * as vscode from 'vscode';
import { TreeItem, AstResult } from './ast_results_provider';

export class AstDetailsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'astDetailsView';
	private _view?: vscode.WebviewView;
	private result: AstResult | undefined;
	constructor(
		private readonly _extensionUri: vscode.Uri
	) { }

	public refresh(astResult: TreeItem) {
		this.result = astResult.result;
		if (this._view !== undefined) {
			this._view.webview.html = this._getHtmlForWebview(this._view.webview);
		}
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.command) {
				case 'showFile':
					this.loadDecorations(data);
					break;
			}
		});
	}


	private vulnHighlightType = vscode.window.createTextEditorDecorationType({
		borderWidth: '3px',	
		borderStyle: 'solid',
		overviewRulerColor: 'blue',
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		backgroundColor: 'gray',
		light: {
			// this color will be used in light color themes
			borderColor: 'darkblue'
		},
		dark: {
			// this color will be used in dark color themes
			borderColor: 'lightblue'
		}
	});
	
	
	//
	/// TEST CODE: Shows decorations on highlighted file
	//
	private loadDecorations(data: any) {		
		// TODO: This will get mad if you have more then one workspace.
		// This entire section of code needs polish
		console.log("Showing decorations");
		const folder = vscode.workspace.workspaceFolders?.[0];				
		if (folder) {	
			//const pattern1 = new vscode.RelativePattern(folder, '*.ts');
			let absPath = folder.uri.path + data.sourceFile;
			console.log(absPath);
			let filePath = vscode.Uri.file(absPath);
			//TODO check if the file is open. If open, show decorations. If not, open text editor in new tab
			vscode.workspace.openTextDocument(filePath).then((a: vscode.TextDocument) => {
				vscode.window.showTextDocument(a, 1, false).then(e => {
					console.log("Document should be open now");
					this.showDecorators(e, data);
				});
			});
		}
	}
	
	private showDecorators(editor: vscode.TextEditor, data: any) {		
		//data.line
		//data.column
		//data.length
		//data.comment
		// TODO: this won'ot handle more the one decoration per file.
		console.log("Trying to load decorations");		
		console.log(data);
		const cxVulns: vscode.DecorationOptions[] = [];
		const startPos = editor.document.positionAt(214);
		const endPos = editor.document.positionAt(236);
		//const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: data.comment};		
		//cxVulns.push(decoration);
		let line = (data.line-1);
		let column = 1;
		if(data.column){
			column = data.column;
		}
		const decoration2 = {range: new vscode.Range(line, column, line, (column + data.length)), hoverMessage: (data.queryName + ", Comment: " + data.comment)};
		cxVulns.push(decoration2);
		editor.setDecorations(this.vulnHighlightType, cxVulns);
		let activeEditor:any = vscode.window.activeTextEditor;
		let range = activeEditor.document.lineAt(line).range;
		activeEditor.selection =  new vscode.Selection(range.start, range.end);
		activeEditor.revealRange(range);
	}

	private _getHtmlForEmptyView(webview: vscode.Webview) {
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>AST Result</title>
			</head>
			<body>
			&nbsp;				
			</body>
		</html>
		`;
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		if (!this.result) {return this._getHtmlForEmptyView(webview);}
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'view.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
		
		const nonce = getNonce();
		
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>Cat Colors</title>
			</head>
			<body>
				<h2>${this.result?.label}</h2>
				<h3> ${this.result?.type} | ${this.result?.status} | ${this.result?.severity}</h3><br/>
				${this.result?.getHtmlDetails()}

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
