import path = require("path");
import * as vscode from "vscode";
import { IssueLevel, RESULTS_FILE_EXTENSION } from "../utils/constants";

export class AstResult {
  label: string = "";
  type: string = "";
  fileName: string = "";
  severity: string = "";
  status: string = "";
  language: string = "";
  description: string = "";
  data: any;
  state:string = "";
  sastNodes: SastNode[] = [];
  scaNode: ScaNode | undefined;
  kicsNode: KicsNode | undefined;
  rawObject: Object;

  constructor(result: any) {
    this.type = result.type;
    this.label = result.data.queryName ? result.data.queryName : result.id;
    this.severity = result.severity;
    this.status = result.status;
    this.language = result.data.languageName;
    this.rawObject = result;
    this.description = result.description;
    this.data = result.data;
	this.state = result.state;

    if (result.data.nodes && result.data.nodes[0]) {
      this.sastNodes = result.data.nodes;
      this.fileName = result.data.nodes[0].fileName;

      const shortFilename = this.fileName
        ? this.fileName.slice(this.fileName.lastIndexOf("/"))
        : "";
      this.label += ` (${shortFilename}:${result.data.nodes[0].line})`;
    }

    if (result.type === "dependency") {
      this.scaNode = result.data;
    }

    if (result.type === "infrastructure") {
      this.kicsNode = result;
    }
  }

  getIcon() {
    switch (this.severity) {
      case "HIGH":
        return path.join("media", "icons", "high_untoggle.svg");
      case "MEDIUM":
        return path.join("media", "icons", "medium_untoggle.svg");
      case "INFO":
        return path.join("media", "icons", "info_untoggle.svg");
      case "LOW":
        return path.join("media", "icons", "low_untoggle.svg");
    }
    return "";
  }

  getTreeIcon() {
    return {
      light: path.join(__filename, "..", "..", this.getIcon()),
      dark: path.join(__filename, "..", "..", this.getIcon()),
    };
  }

  getSeverityCode() {
    switch (this.severity) {
      case "HIGH":
        return vscode.DiagnosticSeverity.Error;
      case "MEDIUM":
        return vscode.DiagnosticSeverity.Warning;
      case "INFO":
        return vscode.DiagnosticSeverity.Information;
      case "LOW":
        return vscode.DiagnosticSeverity.Information;
    }
    return vscode.DiagnosticSeverity.Information;
  }
  getSeverity() {
    switch (this.severity) {
      case "HIGH":
        return IssueLevel.high;
      case "MEDIUM":
        return IssueLevel.medium;
      case "INFO":
        return IssueLevel.info;
      case "LOW":
        return IssueLevel.low;
    }
    return IssueLevel.empty;
  }

  getHtmlDetails() {
    if (this.sastNodes && this.sastNodes.length > 0) {
      return this.getSastDetails();
    }
    if (this.scaNode) {
      return this.scaDetails();
    }
    if (this.kicsNode) {
      return this.kicsDetails();
    }

    return "";
  }
  getKicsValues(){
	  let r = "";
	  if(this.kicsNode?.data){
		this.kicsNode.data.value?
			r+= `
			<p>
			Value: ${this.kicsNode?.data.value}
			</p>
		`:
			r+="No Value information";
		this.kicsNode.data.expectedValue?
			r+= `
			<p>
			Expected Value: ${this.kicsNode?.data.expectedValue}
			</p>
		`:
			r+="No Expected Value information";
	  }
	  return r;
  }

  getSastDetails() {
    let html = "";
	if(this.sastNodes){
		this.sastNodes.forEach((node,index) => {
			html += `
			<tr>
			  <td>
					<div class="tooltip">
						  <span class="tooltiptext">
							  ${node.fileName}
						  </span>
						  ${index+1}. \"${node.name.replaceAll('"', "")}\"
							  <a href="#" 
								  class="ast-node"
								  data-filename="${node.fileName}" 
								  data-line="${node.line}" 
								  data-column="${node.column}"
								  data-fullName="${node.fullName}" 
								  data-length="${node.length}"
							  >
								  ${this.getShortFilename(node.fileName)} [${node.line}:${node.column}]
							  </a>
					  </div>
					  </td>
			  </tr>`;
		  });
	}
    else{
		html+="<p>No attack vector information.</p>";
	}
    return html;
  }

  getShortFilename(filename: string) {
	let r;
	filename.length>50?r = "..." + filename.slice(-50):r = filename;
	return r;
  }

  getTitle(){
	  let r = "";
	if (this.sastNodes && this.sastNodes.length > 0) {
		r = "<h3>Attack Vector</h3><hr class=\"division\"/>";
	  }
	  if (this.scaNode) {
		r= "<h3>Package Data</h3><hr class=\"division\"/>";
	  }
	  if (this.kicsNode) {
		r = "<h3>Location</h3><hr class=\"division\"/>";
	  }
  
	  return r;
	
  }
  private scaDetails() {
    let html = "";
	// validar package data
	if(this.scaNode?.packageData){
		this.scaNode?.packageData.forEach((node,index) => {
			html += `<tr>
			<td>
								${index+1}. 
							  <a href="${node.comment}">
								  ${node.comment}
							  </a>
						  </td>
						  </tr>`;
		  });
	}
    else{
		html+="<p>No package data information.</p>";
	}
    return html;
  }

  private kicsDetails() {
	let html = "";
      html += `
        <tr>
        <td>
	  			<div class="tooltip">
					<span class="tooltiptext">
						${this.kicsNode?.data.filename}
					</span>
						1. 
						<a href="#" 
							class="ast-node"
							data-filename="${this.kicsNode?.data.filename}" 
							data-line="${this.kicsNode?.data.line}" 
							data-column="${0}"
							data-fullName="${this.kicsNode?.data.filename}" 
							data-length="${1}"
						>
							${this.getShortFilename(this.kicsNode?.data.filename)} [${this.kicsNode?.data.line}:${0}]
						</a>
				</div>
				</td>
        </tr>`;
    return html;
  }
}

export class SastNode {
  constructor(
    public id: number,
    public column: number,
    public fileName: string,
    public fullName: string,
    public length: number,
    public line: number,
    public methodLine: number,
    public name: string,
    public domType: string,
    public method: string,
    public nodeID: number,
    public definitions: number,
    public nodeSystemId: string,
    public nodeHash: string
  ) {}
}

class ScaNode {
  constructor(
    public description: string,
    public packageData: PackageData[],
    public packageId: PackageData[]
  ) {}
}

class PackageData {
  constructor(
    public comment: string,
    public type: string,
    public url: string
  ) {}
}

class KicsNode {
  constructor(
    public queryId: string,
    public queryName: string,
    public group: string,
    public description: string,
	public data:any
  ) {}
}