import { pathToFileURL } from 'url';
import * as vscode from 'vscode';
import { AstResult, ResultNodeType } from "./ast_results_provider";

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
				case 'showSastVuln':
					{
						console.log("IN VS code size: " + data.text);
						console.log(data);
						this.loadDecorations(data);
						break;
					}
					case 'showScaVuln':
						{
							console.log("IN VS code size SCA vulnerabilty data: " + data.text);
							console.log(data);
							//this.loadDecorations(data);
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
		let context: string = "";
		if (this.astResult !== undefined) {
			switch(this.astResult.contextValue) {
				case "sastNode":
					queryName = this.astResult.queryName;
					severity = this.astResult.severity;
					context = "SAST";
					break;
				case "scaNode":
					queryName = this.astResult.label;
					severity = this.astResult.severity;
					context = "SCA";	
					break;
				case "kicsNode":
					queryName = this.astResult.label + "";	
					severity = this.astResult.severity;	
					context = "KICS";
					break;
				default:
						queryName = "";
						severity = "";	
			}
			
			
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
			<body>`;
			if(queryName !== "" && severity !== "") {
			html += `<h2>${queryName}</h2>
				<h3> ${context} | ${severity}</h3><br/>`;
			}

				if(this.astResult?.description){
					html += `<p>${this.astResult.description}</p>`;
				}
			if(this.astResult?.contextValue === "sastNode"){	
			html +=	`<h2><u>Attack Vector</u></h2>
				<ol>`;
			}
			else if(this.astResult?.contextValue === "scaNode"){
				html +=	`<h2><u>Package Data</u></h2>
				<ol>`;
			}
			else if(this.astResult?.contextValue === "kicsNode"){
				html +=	`<h2><u>Description</u></h2>
				<ol>`;
			}	
		if(this.astResult !== undefined) {
			if(this.astResult.sastNodes.length > 0) {
				for (let result of this.astResult.sastNodes) {
					let fileName: string = result.fileName;
					let lineNum: number = result.line;
					html += `<li><a href="#" onclick="showSastVuln('${fileName}', '${result.fullName}', ${lineNum}, ${result.column}, ${result.length}, '${this.astResult.comment}', '${this.astResult.queryName}');">${fileName}:${lineNum}</a> | [code snip]`;
				}
			}
			else if ( this.astResult.contextValue === "scaNode" && this.astResult.scaNodes!== undefined ) {
				if(this.astResult.scaNodes.packageData !== undefined && this.astResult.scaNodes.packageData.length > 0) {
				for (let result of this.astResult.scaNodes.packageData) {
					let comment = result.comment;
					html += `<li><a href="${comment}">${comment}</a>`;
				}
			}
			else{
				html += `<p>${this.astResult.description}</p>`;
			}
			}
			else if (this.astResult.contextValue === "kicsNode" && this.astResult.kicsNodes !== undefined) {			
					let comment = this.astResult.kicsNodes.queryName + "[" + this.astResult.kicsNodes.queryId + "]";
					html += `<li><p>${comment}</p>`;				
			}
		}
		html +=	
				`</ol>

				<script>
				const vscode = acquireVsCodeApi();

				function showSastVuln(fileName, fullName, lineNum, columnNum, vulnLength, resultComment, query) {
						vscode.postMessage({
							command: 'showSastVuln',
							sourceFile: fileName,
							path: fullName,
							line: lineNum,
							column: columnNum,
							length: vulnLength,
							comment: resultComment,
							queryName: query
						})
				}
				function showScaVuln(comment, type, description, queryName) {
					vscode.postMessage({
						command: 'showScaVuln',
						comment: comment,
						type: type,
						description: description,
						queryName: query
					})
			}	

				</script>
			</body>
		</html>`;
		return html;
	}
}
