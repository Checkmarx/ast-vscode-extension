import { AstResult } from "../../models/results";
import * as vscode from "vscode";
import { constants } from "../common/constants";

export class Details {
	result: AstResult;
	context: vscode.ExtensionContext;

	constructor(result: AstResult, context: vscode.ExtensionContext) {
		this.result = result;
		this.context = context;
	}

	header(severityPath: vscode.Uri, gptPath?: vscode.Uri) {
		return `
			<div class="header-container">
				<div class="header-item-title">
					<h2 id="cx_title">
						<img class="logo" src="${severityPath}" alt="CxLogo" id="logo_img" />
						${this.result.label.replaceAll("_", " ")}
					</h2>
				</div>
				${this.result.type === constants.kics ? `
				<div class="header-item-gpt">
					<h4 id="cx_title_gpt" class="title_gpt">
						<img class="gpt_logo" src="${gptPath}" alt="gptLogo" id="gpt_logo_img" />
						Ask KICS
					</h4>
				</div>
				`: ""}
				${this.result.sastNodes.length > 0
				? `
					<div class="header-item-codebashing" id="cx_header_codebashing">
						<span class="codebashing-link">
							Learn more at <span class="orange-color">&gt;_</span><span id="cx_codebashing" class="codebashing-link-value" title="Learn more about ` +
				this.result.queryName +
				` using Checkmarx's eLearning platform">codebashing</span>
						<span>
					</div>`
				: ""
			}
			</div>
			<hr class="division"/>
			`;
	}

	loader(): string {
		return `
			<div id="history-container-loader">
				<center>
					<p class="history-container-loader">
						Loading changes
					</p>
					<div class="loader">
					</div>
				</center>
			</div>
			`;
	}

	triage(selectClassname: string) {
		const state = constants.state.filter((element) => {
			return !!element.dependency === (this.result.type === constants.sca);
		});
		const updateButton =
			this.result.type !== constants.sca ? `<button class="submit">Update</button>` : ``;
		const comment =
			this.result.type !== constants.sca
				? `<div class="comment-container">
				<textarea placeholder="Comment (optional)" cols="42" rows="3" class="comments" type="text" id="comment_box"></textarea>
			</div>`
				: ``;

		return `<div class="ast-triage">
				<select id="select_severity" onchange="this.className=this.options[this.selectedIndex].className" class=${selectClassname}>
					${constants.status.map((element) => {
			return `<option id=${element.value} class="${element.class}" ${this.result.severity === element.value ? "selected" : ""
				}>
									${element.value}	
								</option>`;
		})}
				</select>
				<select id="select_state" class="state">
					${state.map((element) => {
			return `<option id=${element.value} ${this.result.state === element.tag ? 'selected="selected"' : ""
				}>
											${element.value}	
										</option>`;
		})}
				</select>
				${updateButton}
			</div>
			${comment}
			</br>`;
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
			</body>`;
	}

	scaView(
		severityPath,
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
			<body class="body-sca">
			<div class="header">
				<img alt="icon" class="header-severity" src="${severityPath}" />
				<p class="header-title">
					${this.result.label}
				</p>
				<p class="header-name">
					${this.result.scaNode.packageIdentifier
				? this.result.scaNode.packageIdentifier
				: ""
			}
				</p>
			</div>
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
		</body>			
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

	// Generic tab component
	tab(
		tab1Content: string,
		tab2Content: string,
		tab3Content: string,
		tab1Label: string,
		tab2Label: string,
		tab3Label: string,
		tab4Label: string,
		tab5Content: string
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
			
			`;
	}
}
