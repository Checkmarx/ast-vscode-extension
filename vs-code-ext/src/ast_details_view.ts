import { pathToFileURL } from 'url';
import * as vscode from 'vscode';
import { AstResult } from "./ast_results_provider";

export class AstDetailsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'astDetailsView';
	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		public astResult?: AstResult
	) { }

	public refresh(astResult: AstResult) {
		this.astResult = astResult;
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
				case 'showVuln':
					{
						console.log("IN VS code size: " + data.text);
						console.log(data);
						this.loadDecorations(data);
						break;
					}
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
			let absPath = folder.uri.path + data.path;
			console.log(absPath);
			let filePath = vscode.Uri.file(absPath);
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
		const decoration2 = {range: new vscode.Range(line, data.column, line, (data.column + data.length)), hoverMessage: (data.queryName + ", Comment: " + data.comment)};
		cxVulns.push(decoration2);
		editor.setDecorations(this.vulnHighlightType, cxVulns);
	}

	private showDecoratorsOLDVER(data: any) {
		console.log(vscode.workspace.textDocuments);	
		// We need to map disk files to editors when they are opened
		console.log("Trying to load decorations");
		let activeEditor = vscode.window.activeTextEditor;
		if (activeEditor !== undefined) {
			console.log("Found Active Editor!");
			const cxVulns: vscode.DecorationOptions[] = [];
	
			// This needs to be mapped to the vulnerabilities in the tree
			const startPos = activeEditor.document.positionAt(214);
			const endPos = activeEditor.document.positionAt(236);
			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: 'This is the vulnerability!' };
			cxVulns.push(decoration);
			activeEditor.setDecorations(this.vulnHighlightType, cxVulns);
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		if (this.astResult !== undefined) {
			return this._getHtmlForResultView(webview);
		} else {
			return this._getHtmlForEmptyView(webview);
		}
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

	private _getHtmlForResultView(webview: vscode.Webview) {
	
		const scriptUri = "";
		const styleResetUri = "";
		const styleVSCodeUri = "";
		const styleMainUri = "";
		let queryName: string = "";
		let severity: string = "";
		if (this.astResult !== undefined) {
			queryName = this.astResult.queryName;
			severity = this.astResult.severity;
		}

		let html = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>AST Result</title>
			</head>
			<body>
				<h2>${queryName}</h2>
				<h3>SAST | ${severity}</h3><br/>

				<h2><u>Attack Vector</u></h2>
				<ol>`;
		if(this.astResult !== undefined) {
			if(this.astResult.sastNodes !== undefined) {
				for (let result of this.astResult.sastNodes) {
					let fileName: string = result.fileName;
					let lineNum: number = result.line;
					html += `<li><a href="#" onclick="showVuln('${fileName}', '${result.fullName}', ${lineNum}, ${result.column}, ${result.length}, '${this.astResult.comment}', '${this.astResult.queryName}');">${fileName}:${lineNum}</a> | [code snip]`;
				}
			}
		}
		html +=	
				`</ol>

				<script>
				const vscode = acquireVsCodeApi();

				function showVuln(fileName, fullName, lineNum, columnNum, vulnLength, resultComment, query) {
						vscode.postMessage({
							command: 'showVuln',
							sourceFile: fileName,
							path: fullName,
							line: lineNum,
							column: columnNum,
							length: vulnLength,
							comment: resultComment,
							queryName: query
						})
				}
				</script>
			</body>
		</html>`;
		return html;
	}
}
