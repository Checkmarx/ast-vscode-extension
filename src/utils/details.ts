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

	scaView(severityPath,scaAtackVector,scaComplexity,scaAuthentication,scaConfidentiality,scaIntegrity,scaAvailability,scaUpgrade,scaUrl: vscode.Uri) {
		return (
			`
			<body class="body-sca">
			<div class="header">
				<img alt="icon" class="header-severity" src="${severityPath}" />
				<p class="header-title">
					${this.result.label}
				</p>
				<p class="header-name">
					${this.result.scaNode.packageIdentifier?this.result.scaNode.packageIdentifier:""}
				</p>
			</div>
			<div class="content">
				<div class="left-content">
					<div class="card" style="border-top: 1px;border-top-style: solid;border-color: rgb(128, 128, 128,0.5) ;">
						<p class="header-content">
							Description
						</p>
						<p class="description">
							${this.result.description}
						</p>
					</div>
					${this.result.scaNode.scaPackageData?
						`
						<div class="card">
						<p class="header-content">
							Remediation
						</p>
						<div class="card-content">
							<div class="remediation-container">
								<div class="remediation-icon">
									<img alt="icon" src="${scaUpgrade}" class="remediation-upgrade" />
								</div>
								<div class="remediation-version">
									<div class="remediation-version-container">
										<p class="remediation-description">
											Upgrade To Version
										</p>
										<p>
										${this.result.scaNode.recommendedVersion?this.result.scaNode.recommendedVersion:"Not available"}
										</p>
									</div>
								</div>
								<div class="remediation-links-container">
									<div class="remediation-links-about">
										<div class="remediation-links-rows">
											<img class="remediation-links-rows-image" alt="icon" src="${scaUrl}" />
											<p class="remediation-links-text" id="${this.result.scaNode.scaPackageData.fixLink}">
												About this vulnerability
											</p>
										</div>
									</div>
									<div class="remediation-links-package">
										<div class="remediation-links-rows">
											<img class="remediation-links-rows-image" alt="icon" src="${scaUrl}" />
											<p class="remediation-links-text">
												Find best package version
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="card">
							<p class="header-content">
								Vulnerable Package Paths
							</p>
							${this.result.scaNode.scaPackageData.dependencyPaths?
								`
								<div class="package-buttons-container">
								<button 
									class="package-back"
									id="package-back"
									data-current="1" 
									data-total="${this.result.scaNode.scaPackageData.dependencyPaths.length}" 
									data-previous="null"
									disabled
								>
									
								</button>
								<p id="package-counter" class="package-counter-numbers">1/${this.result.scaNode.scaPackageData.dependencyPaths.length}</p>
								<button 
									class="package-next"
									data-current="1" 
									${this.result.scaNode.scaPackageData.dependencyPaths.length===1?"disabled":""}
									data-total="${this.result.scaNode.scaPackageData.dependencyPaths.length}"
									id="package-next"
									data-previous="null"
								>
									
								</button>
							</div>
						${this.result.scaPackages()}	
					</div>`
								:
						`
							<div class="card-content">
								<p style="margin:25px;font-size:0.9em">
									No package path information available
								</p>
							</div>
					</div>
								`
							}
					<div class="card" style="border:0">
						<p class="header-content">
							References
						</p>
						<div class="card-content">
							${this.result.scaReferences()}
						</div>
					</div>
				</div>
						`
					:`
					<div class="card" style="border:0">
						<p class="header-content">
							<p style="margin:25px;font-size:0.9em"> 
								No more information available
							</p>
						</p>
					</div>
				</div>
					`
					}
				<div class="right-content">
					${this.result.vulnerabilityDetails.cvss.version?
						`
						<div class="content">
							<div ${parseInt(this.result.vulnerabilityDetails.cvss.version)===2?'class="header-content-selected"':'class="header-content-not-selected"'} >
								<button ${parseInt(this.result.vulnerabilityDetails.cvss.version)===2?'class="cvss-button-selected"':'class="cvss-button-not-selected"'}>
									CVSS 2
								</button>
							</div>
							<div ${parseInt(this.result.vulnerabilityDetails.cvss.version)===3?'class="header-content-selected"':'class="header-content-not-selected"'}>
								<button ${parseInt(this.result.vulnerabilityDetails.cvss.version)===3?'class="cvss-button-selected"':'class="cvss-button-not-selected"'}>
									CVSS 3
								</button>
							</div>
						</div>
					`
					:
					''}
					<div class="sca-details" style="border-bottom: 1px;border-bottom-style: solid;border-color: rgb(128, 128, 128,0.5);">
						<div class="score-card" style="${
								this.result.severity==="HIGH"?
									"border: 1px solid #D94B48":
									this.result.severity==="MEDIUM"?
									"border: 1px solid #F9AE4D":
									this.result.severity==="LOW"?
									"border: 1px solid #029302":
									"border: 1px solid #87bed1"
					 }">
							<div class="left-${this.result.severity}">
								<p class="header-text">
									Score
								</p>
								<p>
									${this.result.vulnerabilityDetails.cvssScore.toFixed(1)}
								</p>
							</div>
							<div class="right-${this.result.severity}">
								<p class="header-text-${this.result.severity}">
									${this.result.severity}
								</p>
								<div class="severity-inner-${this.result.severity}">
									<div class="severity-bar-${this.result.severity}">
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="sca-details">
						<div class="info-cards">
							<div class="info-cards-text">
								<p class="info-cards-description">
									Attack Vector
								</p>
								<p class="info-cards-value">
									${this.result.vulnerabilityDetails.cvss.attackVector?this.result.vulnerabilityDetails.cvss.attackVector:"No information"}
								</p>
							</div>
							<div class="info-cards-icon">
								<img alt="icon" class="info-cards-icons" src="${scaAtackVector}" />
							</div>
						</div>
					</div>
					<div class="sca-details">
						<div class="info-cards">
							<div class="info-cards-text">
								<p class="info-cards-description">
									Attack Complexity
								</p>
								<p class="info-cards-value">
									${this.result.vulnerabilityDetails.cvss.attackComplexity?this.result.vulnerabilityDetails.cvss.attackComplexity:"No information"}
								</p>
							</div>
							<div class="info-cards-icon">
								<img alt="icon" class="info-cards-icons" src="${scaComplexity}" />
							</div>
						</div>
					</div>
					${this.result.vulnerabilityDetails.cvss.privilegesRequired?
						`
						<div class="sca-details">
						<div class="info-cards">
							<div class="info-cards-text">
								<p class="info-cards-description">
									Privileges Required
								</p>
								<p class="info-cards-value">
									${this.result.vulnerabilityDetails.cvss.privilegesRequired?this.result.vulnerabilityDetails.cvss.privilegesRequired:"No information"}
								</p>
							</div>
							<div class="info-cards-icon">
								<img alt="icon" class="info-cards-icons" src="${scaAuthentication}" />
							</div>
						</div>
					</div>`
					:
						``
					}
					<div class="sca-details">
						<div class="info-cards">
							<div class="info-cards-text">
								<p class="info-cards-description">
									Confidentiality Impact
								</p>
								<p class="info-cards-value">
									${this.result.vulnerabilityDetails.cvss.confidentiality?this.result.vulnerabilityDetails.cvss.confidentiality:"No information"}
								</p>
							</div>
							<div class="info-cards-icon">
								<img alt="icon" class="info-cards-icons" src="${scaConfidentiality}" />
							</div>
						</div>
					</div>
					${this.result.vulnerabilityDetails.cvss.integrityImpact?
						`
						<div class="sca-details">
							<div class="info-cards">
								<div class="info-cards-text">
									<p class="info-cards-description">
										Integrity Impact
									</p>
									<p class="info-cards-value">
										${this.result.vulnerabilityDetails.cvss.integrityImpact?this.result.vulnerabilityDetails.cvss.integrityImpact:"No information"}
									</p>
								</div>
								<div class="info-cards-icon">
									<img alt="icon" class="info-cards-icons" src="${scaIntegrity}" />
								</div>
							</div>
						</div>`:``
					}
					<div class="sca-details">
						<div class="info-cards">
							<div class="info-cards-text">
								<p class="info-cards-description">
									Availability Impact
								</p>
								<p class="info-cards-value">
									${this.result.vulnerabilityDetails.cvss.availability?this.result.vulnerabilityDetails.cvss.availability:"No information"}
								</p>
							</div>
							<div class="info-cards-icon">
								<img alt="icon" class="info-cards-icons" src="${scaAvailability}" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</body>			`
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