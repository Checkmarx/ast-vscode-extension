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

	constructor(result: Object) {
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
	
		if (result.type === "sca") { this.scaNode = result.data; }
	
		if (result.type === "infrastructure") { this.kicsNode = result.data; }
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
		html += `<p><a href="#" 
		class="ast-node"
		data-filename="${node.fileName}" data-line="${node.line}" data-column="${node.column}"
		data-fullName="${node.fullName}">${node.fileName}:${node.line}:${node.column}</a></p>`;
	  });
	  return html;
	};
  
	private scaDetails() {
	  let html = `<h3><u>Package Data</u></h3>`;
	  
	  this.scaNode?.packageData.forEach(node => {
		html +=`<li><a href="${node.comment}">${node.comment}</a></li>`;
	  });
	  return html;
	}
  
	private kicsDetails() {
	  let html = `<h2><u>Description</u></h2>`;
	  html +=`<li>${this.kicsNode ? this.kicsNode.queryName + " [ " + this.kicsNode.queryId + " ]" : ""}</li>`;
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