import { AstResult } from "../models/results";
import * as vscode from "vscode";
import { STATE, STATUS } from "./constants";

export class Details {
	result:AstResult;

	constructor(result: AstResult) {
	  this.result = result;
	}

	header(severityPath:vscode.Uri){
		return(
			`<table class="header_table" >
				<tbody>
					<tr>
						<td class="logo_td">
							<img class="logo" src="${severityPath}" alt="CxLogo"/>
						</td>
						<td class="title_td">
							<h2> 
								${this.result.label.replaceAll("_", " ")}  
							</h2>
						</td>
					</tr>
				</tbody>
			</table>`
		);
	}

	triage(selectClassname:string){
		return(
			`<div class="ast-triage">
				<select id="select_severity" onchange="this.className=this.options[this.selectedIndex].className" class=${selectClassname}>
					${
						STATUS.map((element)=>{
							return(
								`<option id=${element.value} class="${element.class}" ${this.result.severity === element.value ? 'selected' : ""}>
									${element.value}	
								</option>`
							);
						})
					}
				</select>
				<select id="select_state" class="state">
					${
						STATE.map((element)=>{
							return(
								`<option id=${element.value} ${this.result.state === element.tag ? 'selected="selected"' : ""}>
									${element.value}	
								</option>`
							);
						})
					}
				</select>
				<!-- -->
				<button class="submit"/>
			</div>
			</br>`
		);
	}

	generalTab(){
		return(
			`<body>
				<span class="details">
					${
					this.result.data.description
						? 
						"<p>" + 
							this.result.data.description + 
						"</p>"
						: 
						'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laboru.'
					}
					${this.result.data.value ? this.result.getKicsValues() : ""}
				</span>
				${this.result.getTitle()}
				<table class="details_table">
					<tbody>
						${this.result.getHtmlDetails()}
					</tbody>
				</table>	
			</body>`
		);
	}

	changesTab(){
		return(
			`<body>
				${this.userCardInfo("O","org_admin","29 December 2021 15:58","Changed severity from 'MEDIUM' to 'HIGH'")}
				${this.userCardInfo("O","org_admin","29 December 2021 15:54","Changed severity to 'MEDIUM'")}
			</body>`
		);
	}

	detailsTab(){
		return(
			`<p>
				Interesting Details
			</p>
			<p>
				Interesting Details
			</p>
			<p>
			</p>
			<p>
				Interesting Details
			</p>
			<p>
				Interesting Details
			</p>
			`
		);
	}
	
	// Generic card for changes
	userCardInfo(avatar:string,username:string,date:string,info:string){
		return(
			`<div class="history_container">
				<div class="history_header">
					<div class="avatar">
						${avatar}
					</div>
				<div class="username">
					${username}
				</div>
				<div class="date">
					${date}
				</div>
				</div>
				<div class="text_content">
					${info}
				</div>
			</div>`
		);
	}

	// Generic tab component
	tab(tab1Content:string,tab2Content:string,tab3Content:string,tab1Label:string,tab2Label:string,tab3Label:string){
		return(
			`<input type="radio" name="tabs" id="tab1" checked />
			<label for="tab1">
				${tab1Label}
			</label>
			<input type="radio" name="tabs" id="tab2" />
			<label for="tab2">
				${tab2Label}
			</label>
			<input type="radio" name="tabs" id="tab3" />
			<label for="tab3">
				${tab3Label}
			</label>
			<div class="tab content1">
				${tab1Content}
			</div>
			<div class="tab content2">
				${tab2Content}
			</div>
			<div class="tab content3">
				${tab3Content}
			</div>`
		);
	}
}