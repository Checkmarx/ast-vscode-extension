import { AstResult } from "../models/results";
import * as vscode from "vscode";
import { ERROR_MESSAGE, PROJECT_ID_KEY, STATE, STATUS,TYPES } from "./constants";
import { triageShow } from "./ast";
import { get } from "./globalState";
import { convertDate } from "./utils";

export class Details {
	result:AstResult;
	context:vscode.ExtensionContext;
	constructor(result: AstResult, context:vscode.ExtensionContext) {
	  this.result = result;
	  this.context = context;
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
				<!-- -->
				<button class="submit">
					Update
				</button>
			</div>
			<div class="comment_container">
				<p id="show_comment" class="comment_placeholder"> 
					<a id="comment_label">Show comment &#8615</a>
				</p>
			</div>
			<div class="comment_container">
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
				<table class="details_table">
					<tbody>
						${this.result.getHtmlDetails()}
					</tbody>
				</table>	
			</body>`
		);
	}

	async changesTab(){
		let projectId = get(this.context,PROJECT_ID_KEY)?.id;
		let changes:any[] |undefined = await triageShow(projectId!,this.result.similarityId,TYPES[this.result.type]);
		let html = "<body>";
		if(changes!.length>0){
			// 
			if(changes![0] !== ERROR_MESSAGE){
				for (let change of changes!) {
					html+=this.userCardInfo(change.CreatedBy,convertDate(change.CreatedAt),this.infoChanges(change));
				}
			}
			else{
				html+=
				`
				<p>
					${changes![1]}
				</p>
				`;
			}
		}
		else{
			html+=
				`
				<div class="history_container">
					<p>
						No changes to display. 
					</p>
				</div>`;
		}
		html+="</body>";
		return html;
	}

	infoChanges(change:any){
		let classname="";
		if(change.Comment.length>0){
			classname = "comment";
		}
		return(
			`<p class="${change.Severity.length>0?"select_"+change.Severity.toLowerCase():""}">
				${change.Severity.length>0?change.Severity:"No changes in severity."}
			</p>
			<p class="state">
				${change.State.length>0?change.State.replaceAll("_"," "):"No changes in state."}
			</p>
			<p class=${classname}>
				${change.Comment.length>0?change.Comment:""}
			</p>
			`
		);
	}
	detailsTab(){
		return(
			`<p>
			</p>
			`
		);
	}
	
	// Generic card for changes
	userCardInfo(username:string,date:string,info:string){
		return(
			`<div class="history_container">
				<div class="history_header">
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
			<label for="tab1" id="tab1_label">
				${tab1Label}
			</label>
			<input type="radio" name="tabs" id="tab2" />
			<label for="tab2" id="tab2_label">
				${tab2Label}
			</label>
			<input type="radio" name="tabs" id="tab3" />
			<label for="tab3" id="tab3_label">
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