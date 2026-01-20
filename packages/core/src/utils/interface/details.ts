import { AstResult } from "../../models/results";
import * as vscode from "vscode";
import * as os from "os";
import { constants } from "../common/constants";
import CxMask from "@checkmarx/ast-cli-javascript-wrapper/dist/main/mask/CxMask";
import { messages } from "../common/messages";
import { getGlobalContext } from "../../activate/activateCore";

export class Details {
	result: AstResult;
	context: vscode.ExtensionContext;
	iAIEnabled: boolean;
	masked?: CxMask;

	constructor(
		result: AstResult,
		context: vscode.ExtensionContext,
		iAIEnabled: boolean
	) {
		this.result = result;
		this.context = context;
		this.iAIEnabled = iAIEnabled;
	}

	header(severityPath: vscode.Uri) {
		return `
			<div class="header-container">
				<div class="header-item-title">
					<h2 id="cx_title">
						<img class="logo" src="${severityPath}" alt="CxLogo" id="logo_img" />
						${this.result.riskScore ? `<span class="header-risk-score ${this.result.severity.toLowerCase()}-risk" style="padding:2px">${this.result.riskScore.toFixed(1)}</span>` : ""
			}
						${this.result.label.replaceAll("_", " ")}
					</h2>
				</div>
			</div>
			<hr class="division"/>
			`;
	}

	scaHeader(severityPath: vscode.Uri) {
		return `
			<div class="header">
				<img alt="icon" class="header-severity" src="${severityPath}" />
				${this.result.riskScore ? `<p class="header-risk-score ${this.result.severity.toLowerCase()}-risk">${this.result.riskScore.toFixed(1)}</p>` : ""}
				<p class="header-title">
					${this.result.label}
				</p>
				<p class="header-name">
					${this.result.scaNode?.packageIdentifier ? this.result.scaNode.packageIdentifier : ""}
				</p>
			</div>
			<hr class="division"/>
		`;
	}

	changes(selectClassname): string {
		return (
			this.triage(selectClassname) +
			`
			<div id="history-container-loader">
				<center>
					<p class="history-container-loader">
						Loading changes
					</p>
					<div class="loader">
					</div>
				</center>
			</div>
			`
		);
	}

	triage(selectClassname: string) {
		const context = getGlobalContext();
		const customStates = context.globalState.get(constants.customStates);
		const state = constants.state;

		const stateOptions =
			this.result.type === constants.sast
				? this.getSastStateOptions(customStates, state)
				: this.getDefaultStateOptions(state);

		const updateButton = `<button class="submit">Update</button>`;
		const commentPlaceholder = this.result.type === constants.sca
			? "Note (required)"
			: "Note (Optional or required based on tenant configuration)";
		const comment = `<div class="comment-container">
				<textarea placeholder="${commentPlaceholder}" cols="41" rows="3" class="comments" type="text" id="comment_box"></textarea>
			</div>`;

		const severitySelect = this.result.type === constants.sca
			? ""
			: `<select id="select_severity" onchange="this.className=this.options[this.selectedIndex].className" class=${selectClassname}>
				${constants.status.map((element) => {
				return `<option id=${element.value} class="${element.class}" ${this.result.severity === element.value ? "selected" : ""}>${element.value}</option>`;
			})}
			</select>`;

		return `<div class="ast-triage">
		${severitySelect}
		${stateOptions}
		</div>
		${comment}
		${updateButton}
		</br>`;
	}

	getSastStateOptions(customStates, state) {
		return `<select id="select_state" class="state">
      ${customStates
				.map((customState) => {
					const matchedState = state.find(
						(element) => element.tag === customState.name
					);
					return `<option id=${customState.name} ${this.result.state?.toLowerCase() === customState.name ||
						this.result.state === matchedState?.tag
						? 'selected="selected"'
						: ""
						} value="${customState.name}">${matchedState ? matchedState.value : customState.name}</option>`;
				})
				.join("")}
    </select>`;
	}

	getDefaultStateOptions(state) {
		return `<select id="select_state" class="state">
      ${state.map((element) => {
			return `<option id=${element.value.replaceAll(" ", "")} ${this.result.state.trim() === element.tag.trim() ? 'selected="selected"' : ""
				} value="${element.tag.trim()}">${element.value.trim()}</option>`;
		})}
    </select>`;
	}
	generalTab(cxPath: vscode.Uri) {
		return `<body>
				<span class="details">
					${this.result.description ? "<p>" + this.result.description + "</p>" : ""}
					${this.result.data.value ? this.result.getKicsValues() : ""}
				</span>
				${this.result.getTitle()}
				<table class="details-table">
					<tbody>
						${this.result.getHtmlDetails(cxPath)}
					</tbody>
				</table>
				${this.result.traits !== undefined ? `<hr class="division">
				<div style="border:0">
					<div style="display: inline-block;position: relative;">
						<p class="header-content">
							Additional Trait
						</p>
					</div>
					<div class="card-content">
							${this.result.getHtmlAdditionaltrait(this.result)}
					</div>
				</div>` : ""}
			</body>`;
	}

	secretDetectiongeneralTab() {
		let description = typeof this.result.description === "undefined" ? "" : this.result.description;
		const startIndex = description.indexOf('/');
		let filePath = "";
		if (startIndex !== -1) {
			// Extract the file path from the description
			// and remove it from the description
			filePath = description.slice(startIndex);
			description = description.slice(0, startIndex);
		}
		return `<body>
				<tr>
					<td style="background:var(--vscode-editor-background)">
					<td>
						<div>
							<div class="bfl-title">
								${description} 
								<a href="#" 
									class="ast-node"
									id="ast-node-0"
									data-filename="${this.result.data.filename}" 
									data-line="${this.result.data.line}" 
									data-column="${0}"
									data-length="${1}"
								>
								${filePath}
								</a>
							</div>
						</div>
					</td>
				</tr>
				</body>`;
	}

	scaView(
		scaAtackVector,
		scaComplexity,
		scaAuthentication,
		scaConfidentiality,
		scaIntegrity,
		scaAvailability,
		scaUpgrade,
		scaUrl: vscode.Uri,
		type?: string
	) {
		return `
			<div class="content">
				${this.result.scaContent(
			this.result,
			scaUpgrade,
			scaUrl,
			scaAtackVector,
			scaComplexity,
			scaAuthentication,
			scaConfidentiality,
			scaIntegrity,
			scaAvailability,
			type
		)}
			</div>	
		`;
	}

	detailsTab() {
		return `
			<div>
				<div id="learn-container-loader">
					<center>
						<p class="history-container-loader">
							Loading more details
						</p>
						<div class="loader">
						</div>
					</center>
				</div>
			</div>
			`;
	}

	secretDetectionDetailsRemediationTab() {
		const remediation = this.result.data?.remediation;

		if (!remediation) {
			return `<div>${messages.noRemediationExamplesTab}</div>`;
		}

		return `
	  <div>
		${remediation ? `<p>${remediation}</p>` : ""}
	  </div>
	`;
	}

	secretDetectionDetailsDescriptionTab() {
		const ruleDescription = this.result.data?.ruleDescription;

		if (!ruleDescription) {
			return `<div>${messages.noDescriptionTab}</div>`;
		}

		return `
	  <div>
	  ${ruleDescription ? `<p>${ruleDescription}</p>` : ""}
	  </div>
	`;
	}

	// Generic tab component
	tab(
		tab1Content: string,
		tab2Content: string,
		tab3Content: string,
		tab1Label: string,
		tab2Label: string,
		tab3Label: string,
		tab4Label: string,
		tab5Content: string,
		tab6Label: string,
		tab6Content: string
	) {
		return `${tab1Label !== ""
			? `<input type="radio" name="tabs" id="general-tab" checked />
			<label for="general-tab" id="general-label">
				${tab1Label}
			</label>`
			: ""
			}
			${tab2Label !== ""
				? `<input type="radio" name="tabs" id="learn-tab" />
			<label for="learn-tab" id="learn-label">
				${tab2Label}
			</label>`
				: ""
			}
			${tab4Label !== ""
				? `<input type="radio" name="tabs" id="code-tab" />
			<label for="code-tab" id="code-label">
				${tab4Label}
			</label>`
				: ""
			}
			${tab6Label !== ""
				? `<input type="radio" name="tabs" id="ai-tab" />
			<label for="ai-tab" id="ai-label">
				${tab6Label}
			</label>`
				: ""
			}
			${tab3Label !== ""
				? `<input type="radio" name="tabs" id="changes-tab" />
		<label for="changes-tab" id="changes-label">
			${tab3Label}
		</label>`
				: ""
			}
			${tab1Content !== ""
				? `<div class="tab general">
			${tab1Content}
			</div>`
				: ""
			}
			${tab2Content !== ""
				? `<div class="tab learn">
			${tab2Content}
			</div>`
				: ""
			}
			${tab3Content !== ""
				? `<div class="tab changes">
			${tab3Content}
		</div>`
				: ""
			}
		${tab5Content !== ""
				? `<div class="tab code">
		<div id="tab-code">
			<pre class="pre-code">
				<code id="code">
					${tab5Content}
				</code>
			</pre>
		</div>
	</div>`
				: ""
			}
			${tab6Content !== ""
				? `<div class="tab ai">
					${tab6Content}
				  </div>`
				: ""
			}
			`;
	}
	guidedRemediationSastTab(kicsIcon, masked: CxMask) {
		this.masked = masked;
		return `
		<div class="inner-body-sast" id="innerBodySast" style="min-height: 80vh;display: flex;justify-content: center;align-items: center;">
		<button id="startSastChat" class="start-sast-chat">
			<div class="row">
				<div class="col">
					<img class="sast-gpt-logo" src="${kicsIcon}" alt="gptLogo"/>
				</div>
			</div>
			<div class="row">
				<div class="col">
					<h2 class="start-chat-text">
						Start Remediation
					</h2>
				</div>
			</div>
		</button>
		</div>
		`;
	}

	guidedRemediationTab(kicsIcon, masked: CxMask) {
		// TODO: try to make it generic to be used by the tab and the webview
		this.masked = masked;
		const userInfo = os.userInfo();
		// Access the username
		const username = userInfo.username;
		return `
		<div class="inner-body">
		<div>
	<div class="container" style="padding:0;width:100 !important;">
		<div class="card" style="border:none;margin-bottom:1em;background:transparent;color:var(--vscode-editor-foreground);">
			<div class="card-body" style="padding:0">
				<div class="row">
					<div class="col">
						<p>
							<img src="${kicsIcon}" class="avatar" alt="Avatar" />
							${constants.aiSecurityChampion}
						</p>
					</div>
				</div>
				<div class="row" style="margin-top:0.8em">
					<div class="col">
						<p>Welcome ${username}!</p>
						<p>”${constants.aiSecurityChampion
			}” harnesses the power of AI to help you to understand the
							vulnerabilities in your code, and resolve them quickly and easily.</p>
						<p style="margin-bottom:0">We protect your sensitive data by anonymizing the source file
							before sending data to GPT.</p>
					</div>
				</div>
				<div class="row" style="padding:0.6em">
					<div id="accordion" style="width:100%">
						<div class="card" style="background:transparent;">
							<div class="card-header" id="headingOne" style="padding:0!important;color:var(--vscode-editor-foreground);">
								<h5 class="mb-0">import { messages } from '../common/messages';

									<button class="btn btn-link" data-toggle="collapse" data-target="#collapseOne"
										aria-expanded="true" aria-controls="collapseOne"
										style="color:var(--vscode-editor-foreground);text-align:left">
										Masked Secrets ${this.masked && this.masked.maskedSecrets
				? "(" + this.masked.maskedSecrets.length + ")"
				: ""
			}
									</button>
								</h5>
							</div>
							<div id="collapseOne" class="collapse" aria-labelledby="headingOne"
								data-parent="#accordion">
								<div class="card-body">
									${this.generateMaskedSection()}
								</div>
							</div>
						</div>
					</div>
				</div>
				<div class="row" style="">
					<div class="col">
						<p style="margin-bottom:0">Here are some suggested questions for getting the conversation
							started:</p>
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
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
									class="bi bi-arrow-right" viewBox="0 0 16 16">
									<path fill-rule="evenodd"
										d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z" />
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
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
									class="bi bi-arrow-right" viewBox="0 0 16 16">
									<path fill-rule="evenodd"
										d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z" />
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
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
									class="bi bi-arrow-right" viewBox="0 0 16 16">
									<path fill-rule="evenodd"
										d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z" />
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
					”${constants.aiSecurityChampion
			}” will only answer questions that are relevant to this IaC file and its
					results.The responses are generated by OpenAI's GPT. The content may contain inaccuracies. Use
					your judgement in determining how to utilize this information.
				</p>
			</div>
		</div>
	</div>
</div>
<div id="chat-container">
</div>
<div>
	<div style="margin-bottom:10px">
		<div class="row" style="bottom: 10px">
			<div class="col">
				<div class="input-group" style="display:flex" id="askGroup">
					<textarea
						style="width:90%;resize:none;border:1px solid #3794FF;"
						class="form-control custom-control" id="askQuestion" rows="1"
						placeholder="Ask a question"></textarea>
					<button
						style="border:1px solid rgba(55, 148, 255, 0.2);display:flex;justify-content:center;align-items:center;border-radius:0;background:#6769725c;width:10%;border-style:solid solid solid none;border-color:#3794FF"
						class="input-group-addon btn btn-primary" id="userQuestion">
						<svg id="send" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
							class="bi bi-send" viewBox="0 0 16 16">
							<path
								d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
<button type="button" class="btn btn-floating btn-sm" id="btn-back-to-top">
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-up"
		viewBox="0 0 16 16">
		<path fill-rule="evenodd"
			d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z" />
	</svg>
</button>
</div>
		`;
	}

	generateMaskedSection(): string {
		let html = "";
		if (
			this.masked &&
			this.masked.maskedSecrets &&
			this.masked.maskedSecrets.length > 0
		) {
			for (let i = 0; i < this.masked.maskedSecrets.length; i++) {
				html +=
					"<p>Secret: " +
					this.masked.maskedSecrets[i].secret +
					"<br/>" +
					"Masked: " +
					this.masked.maskedSecrets[i].masked
						.replaceAll("<", "&lt;")
						.replaceAll(">", "&gt;") +
					"<br/>Line: " +
					this.masked.maskedSecrets[i].line +
					"</p>";
			}
		} else {
			html += "No secrets were detected and masked";
		}
		return html;
	}
}
