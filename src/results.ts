import * as vscode from 'vscode';
import { IssueLevel } from './ast_results_provider';
import * as fs from 'fs';

export class AstResult {
	label: string = "";
	type: string = "";
	fileName: string = "";
	severity: string = "";
	status: string = "";
	language: string = ""; 
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
	
		if (result.data.nodes) {
			this.sastNodes = result.data.nodes;
			this.fileName = result.data.nodes[0].fileName;
		}
	
		if (result.type === "dependency") { this.scaNode = result.data; }
	
		if (result.type === "infrastructure") { this.kicsNode = result.data; }
	}

	 getIcon() {
		switch(this.severity) {
			case "HIGH":
				return __dirname + "/media/icons/high_untoggle.svg";
			case "MEDIUM":
				return __dirname + "/media/icons/medium_untoggle.svg";
			case "INFO":
				return __dirname + "/media/icons/info_untoggle.svg";
			case "LOW":
				return __dirname + "/media/icons/low_untoggle.svg";
		}
		return "";
	}
	

	getSeverityCode() {
		switch(this.severity) {
			case "HIGH":
				return vscode.DiagnosticSeverity.Error;
			case "MEDIUM":
				return vscode.DiagnosticSeverity.Warning;
			case "INFO":
				return vscode.DiagnosticSeverity.Information;
			case "LOW":
				return vscode.DiagnosticSeverity.Information;	
		}
		return vscode.DiagnosticSeverity.Information;;
	}
	getSeverity() {
		
		switch(this.severity) {
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
	  if (this.sastNodes && this.sastNodes.length > 0) {return this.sastDetails();}
	  if (this.scaNode) {return this.scaDetails();}
	  if (this.kicsNode ) {return this.kicsDetails();}
	  
	  return "";
	}
  
	private sastDetails() {
	  let html = `<h3><u>Attack Vector</u></h3>`;
	  this.sastNodes.forEach(node => {
		html += `<p>- <a href="#" 
		class="ast-node"
		data-filename="${node.fileName}" data-line="${node.line}" data-column="${node.column}"
		data-fullName="${node.fullName}" data-length="${node.length}">${node.fileName} [${node.line}:${node.column}]</a></p>`;
	  });
	  return html;
	};
  
	private scaDetails() {
	  let html = `<h3><u>Package Data</u></h3>`;
	  
	  this.scaNode?.packageData.forEach(node => {
		html +=`<p>- <a href="${node.comment}">${node.comment}</a></p>`;
	  });
	  return html;
	}
  
	private kicsDetails() {
	  let html = `<h2><u>Description</u></h2>`;
	  html +=`<p>- ${this.kicsNode ? this.kicsNode.queryName + " [ " + this.kicsNode.queryId + " ]" : ""}</p>`;
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
	) { }
}

class ScaNode {
	constructor(
		public description: string,
		public packageData: PackageData[],
		public packageId: PackageData[]

	) { }
}

class PackageData {
	constructor(
		public comment: string,
		public type: string,
		public url: string
	) { }
}

class KicsNode {
	constructor(
		public queryId: string,
		public queryName: string,
		public group: string,
		public description: string,

	) { }
}