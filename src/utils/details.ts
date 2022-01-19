import { AstResult } from "../models/results";
import * as vscode from "vscode";
import { STATE, STATUS } from "./constants";

export class Details {
	result:AstResult;
	context:vscode.ExtensionContext;
	constructor(result: AstResult, context:vscode.ExtensionContext) {
	  this.result = result;
	  this.context = context;
	}

	header(severityPath:vscode.Uri){
		return(
			`<table class="header-table" >
				<tbody>
					<tr>
						<td class="logo_td">
							<img class="logo" src="${severityPath}" alt="CxLogo" id="logo_img"/>
						</td>
						<td class="title-td">
							<h2> 
								${this.result.label.replaceAll("_", " ")}  
							</h2>
						</td>
					</tr>
				</tbody>
			</table>`
		);
	}

	loader():string{
		return(
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

	triage(selectClassname:string){
		let state = STATE;
		if(this.result.type === 'dependency'){
			state = STATE.filter((element)=> {return (element.dependency===true);});
		}
		else{
			state = STATE.filter((element)=> {return (element.dependency!==true);});
		}
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
						state.map((element)=>{
							return(
								`<option id=${element.value} ${this.result.state === element.tag ? 'selected="selected"' : ""}>
									${element.value}	
								</option>`
								
							);
						})
					}
				</select>
				<button class="submit">
					Update
				</button>
			</div>
			<div class="comment-container">
				<p id="show_comment" class="comment-placeholder"> 
					<a id="comment_label">Show comment &#8615</a>
				</p>
			</div>
			<div class="comment-container">
				<textarea placeholder="Comment (optional)" cols="42" rows="3" class="comments" type="text" id="comment_box"></textarea>
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
						''
					}
					${this.result.data.value ? this.result.getKicsValues() : ""}
				</span>
				${this.result.getTitle()}
				<table class="details-table">
					<tbody>
						${this.result.getHtmlDetails()}
					</tbody>
				</table>	
			</body>`
		);
	}

	detailsTab(){
		return(
			`<p>
			</p>
			`
		);
	}
	
	// Generic tab component
	tab(tab1Content:string,tab2Content:string,tab3Content:string,tab1Label:string,tab2Label:string,tab3Label:string){
		return(
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