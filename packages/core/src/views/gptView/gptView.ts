import * as vscode from "vscode";
import * as path from "path";
import { getNonce } from "../../utils/utils";
import * as os from 'os';
import { GptResult } from "../../models/gptResult";
import CxMask from "@checkmarx/ast-cli-javascript-wrapper/dist/main/mask/CxMask";
import { constants } from "../../utils/common/constants";
import { MediaPathResolver } from "../../utils/mediaPathResolver";

export class GptView implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private askKicsIcon: vscode.Uri;
	private kicsUserIcon: vscode.Uri;
	constructor(
		private result: GptResult,
		private context: vscode.ExtensionContext,
		private loadChanges: boolean,
		private type?: string,
		private masked?: CxMask,
	) { }

	public getWebView() {
		return this._view;
	}

	public setResult(result: GptResult) {
		this.result = result;
	}

	public setLoad(loadChanges: boolean) {
		this.loadChanges = loadChanges;
	}

	public getLoad(): boolean {
		return this.loadChanges;
	}

	public getAskKicsIcon() {
		return this.askKicsIcon;
	}

	public getAskKicsUserIcon() {
		return this.kicsUserIcon;
	}

	public getResult(): GptResult {
		return this.result;
	}
	public async resolveWebviewView(
		webviewView: vscode.WebviewView,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_context: vscode.WebviewViewResolveContext,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.context.extensionUri, 'media'),
				vscode.Uri.file(MediaPathResolver.getCoreMediaPath())
			],
		};
		webviewView.webview.html = await this.getDetailsWebviewContent(
			webviewView.webview
		);
	}

	async getDetailsWebviewContent(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("gpt.js"))
		);
		const scriptJquery = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("jquery", "jquery-3.7.1.min.js"))
		);
		const styleResetUri = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("reset.css"))
		);
		const styleVSCodeUri = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("vscode.css"))
		);
		const styleGptUri = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("gpt.css"))
		);
		const styleMainUri = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("main.css"))
		);
		const styleDetails = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("details.css"))
		);
		const scaDetails = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("sca.css"))
		);
		const styleMainGptUri = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("gpt-main.css"))
		);
		const styleBootStrap = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("bootstrap", "bootstrap.min.css"))
		);
		const scriptBootStrap = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("bootstrap", "bootstrap.min.js"))
		);
		const scriptHighlight = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("codeRenderers", "highlight.min.js"))
		);
		const scriptMarked = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("codeRenderers", "marked.min.js"))
		);
		const scriptShowdown = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("codeRenderers", "showdown.min.js"))
		);
		const kicsIcon = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("icons", "kics.png"))
		);
		const kicsUserIcon = webview.asWebviewUri(
			vscode.Uri.file(MediaPathResolver.getMediaFilePath("icons", "userKics.png"))
		);
		this.askKicsIcon = kicsIcon;
		this.kicsUserIcon = kicsUserIcon;
		const nonce = getNonce();
		// Get the user information
		const userInfo = os.userInfo();
		// Access the username
		const username = userInfo.username;
		return `<!DOCTYPE html>
			<html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleResetUri}" rel="stylesheet">
          <link href="${styleVSCodeUri}" rel="stylesheet">
          <link href="${styleMainUri}" rel="stylesheet">
          <link href="${styleDetails}" rel="stylesheet">
          <link href="${scaDetails}" rel="stylesheet">
		  <link href="${styleBootStrap}" rel="stylesheet">
		  <link href="${styleGptUri}" rel="stylesheet">
		  <link href="${styleMainGptUri}" rel="stylesheet">
		  <script nonce="${nonce}" src="${scriptJquery}"></script>
		  <script nonce="${nonce}" src="${scriptBootStrap}"></script>
		  <script nonce="${nonce}" src="${scriptHighlight}"></script>
		  <script nonce="${nonce}" src="${scriptShowdown}"></script>
		  <script nonce="${nonce}" src="${scriptMarked}"></script>
          <title>
            Checkmarx
          </title>
        </head>
        <div id="main_div">
        <div class="container-fluid">
		<div class="container" style="padding:0;width:100 !important;">
		<div class="card" style="border:none;margin-bottom:1em;background:transparent;color:var(--vscode-editor-foreground);">
               <div class="card-body" style="padding:0">
                  <div class="row">
                     <div class="col">
					 <p>
					 	<img src="${kicsIcon}" class="avatar"
					 	alt="Avatar" />
					 	${constants.aiSecurityChampion}
					 </p>
         			</div>
                  </div>
                  <div class="row" style="margin-top:0.8em">
                     <div class="col">
						<p>Welcome ${username}!</p>
						<p>”${constants.aiSecurityChampion}” harnesses the power of AI to help you to understand the vulnerabilities in your code, and resolve them quickly and easily.</p>
						<p style="margin-bottom:0">We protect your sensitive data by anonymizing the source file before sending data to GPT.</p>
         			</div>
                  </div>
				  <div class="row" style="padding:0.6em">
					 <div id="accordion" style="width:100%">
						<div class="card" style="background:transparent;">
							<div class="card-header" id="headingOne" style="padding:0!important">
								<h5 class="mb-0">
								<button class="btn btn-link" data-toggle="collapse" data-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne" style="color:var(--vscode-editor-foreground);text-align:left">
									Masked Secrets ${this.masked && this.masked.maskedSecrets ? "(" + this.masked.maskedSecrets.length + ")" : ""}
								</button>
								</h5>
							</div>
							<div id="collapseOne" class="collapse" aria-labelledby="headingOne" data-parent="#accordion">
								<div class="card-body">
									${this.generateMaskedSection()}
								</div>
							</div>
							</div>
						</div>
                  </div>
				  <div class="row" style="">
                     <div class="col">
						<p style="margin-bottom:0">Here are some suggested questions for getting the conversation started:</p>
         			</div>
                  </div>
               </div>
            </div>
			<div class="row" id="cards-container">
				<div class="col">
					<div class="questionCard">
					<div class="card-body" id="explainFile">
						<div class="row">
							<div class="col">
								What is the purpose of this IaC file?
							</div>
							<div class="cardArrow">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
									<path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
								</svg>
                     		</div>
						</div>
					</div>
					</div>
					<div class="questionCard" style="margin-top:0.5em">
					<div class="card-body" id="explainResults">
						<div class="row">
							<div class="col">
								What do these results mean?
							</div>
							<div class="cardArrow">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
									<path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
								</svg>
                     		</div>
						</div>
					</div>
					</div>
					<div class="questionCard" style="margin-top:0.5em">
					<div class="card-body" id="explainRemediations">
						<div class="row">
							<div class="col">
								How can I remediate this vulnerability?
							</div>
							<div class="cardArrow">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
									<path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
								</svg>
                     		</div>
						</div>
					</div>
					</div>
				</div>
			</div>
			<div class="row" style="margin-top:1em">
				<div class="col">
					<p style="color:#676972;font-size:12px">
					”${constants.aiSecurityChampion}” will only answer questions that are relevant to this IaC file and its results.The responses are generated by OpenAI's GPT. The content may contain inaccuracies. Use your judgement in determining how to utilize this information.
					</p>
				</div>
			</div>
		</div>
		</div>
		<div id="chat-container">
		</div>
	</div>
	<div>
	<div class="container-fluid" style="margin-bottom:10px">
			<div class="row" style="bottom: 10px">
					<div class="col">
					<div class="input-group" style="display:flex" id="askGroup">
						<textarea style="width:90%;background:#6769725c;color:white;resize:none;border:1px solid #3794FF;border-style:solid none solid solid" class="form-control custom-control" id="askQuestion" rows="1" placeholder="Ask a question"></textarea>     
						<button style="border:1px solid rgba(55, 148, 255, 0.2);display:flex;justify-content:center;align-items:center;border-radius:0;background:#6769725c;width:10%;border-style:solid solid solid none;border-color:#3794FF" class="input-group-addon btn btn-primary" id="userQuestion">
							<svg id="send" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-send" viewBox="0 0 16 16">
								<path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
					  		</svg>
						</button>
					</div>
					</div>
			</div>
		</div>
	</div>
	<button type="button" class="btn btn-floating btn-sm" id="btn-back-to-top">
		<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-up" viewBox="0 0 16 16">
		<path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/>
	</svg>
	</button>
	<script>
		const vscode = acquireVsCodeApi();
  	</script>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</html>`;
	}

	generateMaskedSection(): string {
		let html = "";
		if (this.masked && this.masked.maskedSecrets && this.masked.maskedSecrets.length > 0) {
			for (let i = 0; i < this.masked.maskedSecrets.length; i++) {
				html += "<p>Secret: " + this.masked.maskedSecrets[i].secret + "<br/>" + "Masked: " + this.masked.maskedSecrets[i].masked.replaceAll("<", "&lt;").replaceAll(">", "&gt;") + "<br/>Line: " + this.masked.maskedSecrets[i].line + "</p>";
			}
		} else {
			html += "No secrets were detected and masked";
		}
		return html;
	}
}

