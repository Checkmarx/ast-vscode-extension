import { AstResult } from "../models/results";
import * as vscode from "vscode";
import { ERROR_MESSAGE, PROJECT_ID_KEY, STATE, STATUS, SCA } from "./constants";

export class Details {
	result: AstResult;
	context: vscode.ExtensionContext;
	constructor(result: AstResult, context: vscode.ExtensionContext) {
		this.result = result;
		this.context = context;
	}

	header(severityPath: vscode.Uri) {
		return (
			`
			<div class="header-container">
				<div class="header-item-title">
					<h2 id="cx_title">
						<img class="logo" src="${severityPath}" alt="CxLogo" id="logo_img" />
						${this.result.label.replaceAll("_", " ")}
					</h2>
				</div>
				${this.result.sastNodes.length>0 ?
					`
					<div class="header-item-codebashing" id="cx_header_codebashing">
						<span class="codebashing-link">
							Learn more at <span class="orange-color">&gt;_</span><span id="cx_codebashing" class="codebashing-link-value" title="Learn more about `+ this.result.queryName + ` using Checkmarx's eLearning platform">codebashing</span>
						<span>
					</div>`
					:
					""
				}
			</div>
			<hr class="division"/>
			`
		);
	}

	loader(): string {
		return (
			`
			<div id=\"history-container-loader\">
				<center>
					<p class=\"history-container-loader\">
						Loading changes
					</p>
					<div class=\"loader\">
					</div>
				</center>
			</div>
			`
		);
	}

	triage(selectClassname: string) {
		let state = STATE.filter((element) => {
			return (!!element.dependency === (this.result.type === SCA));
		});
		const updateButton = this.result.type !== SCA ? `<button class="submit">Update</button>` : ``;
		const comment = this.result.type !== SCA ? 
			`<div class="comment-container">
				<textarea placeholder="Comment (optional)" cols="42" rows="3" class="comments" type="text" id="comment_box"></textarea>
			</div>` : ``;

		return (
			`<div class="ast-triage">
				<select id="select_severity" onchange="this.className=this.options[this.selectedIndex].className" class=${selectClassname}>
					${STATUS.map((element) => {
				return (

					`<option id=${element.value} class="${element.class}" ${this.result.severity === element.value ? 'selected' : ""}>
									${element.value}	
								</option>`
				);
			})
			}
				</select>
				<select id="select_state" class="state">
					${state.map((element) => {
						return (
							`<option id=${element.value} ${this.result.state === element.tag ? 'selected="selected"' : ""}>
											${element.value}	
										</option>`);
						})
					}
				</select>
				${updateButton}
			</div>
			${comment}
			</br>`
		);
	}

	generalTab(cxPath: vscode.Uri) {
		return (
			`<body>
				<span class="details">
					${this.result.description
				?
				"<p>" +
				this.result.description +
				"</p>"
				:
				''
			}
					${this.result.data.value ? this.result.getKicsValues() : ""}
				</span>
				${this.result.getTitle()}
				<table class="details-table">
					<tbody>
						${this.result.getHtmlDetails(cxPath)}
					</tbody>
				</table>	
			</body>`
		);
	}

	detailsTab() {
		return (
			`<p>
			</p>
			`
		);
	}

	// Generic tab component
	tab(tab1Content: string, tab2Content: string, tab3Content: string, tab1Label: string, tab2Label: string, tab3Label: string) {
		return (
			`<input type="radio" name="tabs" id="general-tab" checked />
			<label for="general-tab" id="general-label">
				${tab1Label}
			</label>
			<input type="radio" name="tabs" id="learn-tab" />
			<label for="learn-tab" id="learn-label">
				${tab2Label}
			</label>
			<input type="radio" name="tabs" id="changes-tab" />
			<label for="changes-tab" id="changes-label">
				${tab3Label}
			</label>
			<div class="tab general">
				${tab1Content}
			</div>
			<div class="tab learn">
				${tab2Content}
			</div>
			<div class="tab changes">
				${tab3Content}
			</div>`
		);
	}
}