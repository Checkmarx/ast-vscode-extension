import path = require("path");
import * as vscode from "vscode";
import { StateLevel,IssueLevel, SCA, KICS } from "../utils/constants";
import { KicsNode } from "./kicsNode";
import { SastNode } from "./sastNode";
import { ScaNode } from "./scaNode";

export class AstResult {
  label: string = "";
  type: string = "";
  fileName: string = "";
  queryName: string = "";
  severity: string = "";
  status: string = "";
  language: string = "";
  description: string = "";
  similarityId:string = "";
  data: any;
  state: string = "";
  queryId: string = "";
  sastNodes: SastNode[] = [];
  scaNode: ScaNode | undefined;
  kicsNode: KicsNode | undefined;
  rawObject: Object;
  cweId: string| undefined;
  setSeverity(severity:string){
    this.severity=severity;
    if(this.kicsNode){
      this.kicsNode.severity = severity;
    }
  }

  setState(state:string){
    this.state=state;
  }

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
    this.similarityId = result.similarityId;
    this.queryName = result.data.queryName;
    this.queryId = result.data.queryId;

    if (result.data.nodes && result.data.nodes[0]) {
      this.sastNodes = result.data.nodes;
      this.fileName = result.data.nodes[0].fileName;
      const shortFilename = this.fileName
        ? this.fileName.slice(this.fileName.lastIndexOf("/"))
        : "";
      this.label += ` (${shortFilename}:${result.data.nodes[0].line})`;
      this.cweId = result.cweId;
      if (!this.cweId) {
        this.cweId = this.cweId = result.vulnerabilityDetails?.cweId;
      }
    }
    if (result.type === SCA) {
      this.scaNode = result.data;
    }
    if (result.type === KICS) {
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

  getCxIcon() {
    return path.join("media", "icon.png");
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

  getState() {
    switch (this.state) {
      case "NOT_EXPLOITABLE":
        return StateLevel.notExploitable;
      case "PROPOSED_NOT_EXPLOITABLE":
        return StateLevel.proposed;
      case "CONFIRMED":
        return StateLevel.confirmed;
      case "TO_VERIFY":
        return StateLevel.toVerify;
      case "URGENT":
        return StateLevel.urgent;
      case "NOT_IGNORED":
        return StateLevel.notIgnored;
       case "IGNORED":
        return StateLevel.ignored;
    }
  }

  getHtmlDetails(cxPath: vscode.Uri) {
    if (this.sastNodes && this.sastNodes.length > 0) {
      return this.getSastDetails(cxPath);
    }
    if (this.scaNode) {
      return this.scaDetails();
    }
    if (this.kicsNode) {
      return this.kicsDetails();
    }

    return "";
  }

  getKicsValues() {
    let r = "";
    if (this.kicsNode?.data) {
      this.kicsNode.data.value
        ? (r += `
			<p>
			<b>Value:</b> ${this.kicsNode?.data.value}
			</p>
		`)
        : (r += "");
      this.kicsNode.data.expectedValue
        ? (r += `
			<p>
			<b>Expected Value:</b> ${this.kicsNode?.data.expectedValue}
			</p>
		`)
        : (r += "");
    }
    return r;
  }

  getSastDetails(cxPath: vscode.Uri) {
    let html = ""; //this.getBflTips(cxPath);
    if (this.sastNodes) {
      this.sastNodes.forEach((node, index) => {
        html += `
          <tr>
          <td style="background:var(--vscode-editor-background)">
            <div class="bfl-container" id=bfl-container-${index}>
              <img class="bfl-logo" src="${cxPath}" alt="CxLogo"/>
            </div>
          <td>
              <div>
                    <div style="display: inline-block">
                      ${index + 1}. \"${node.name.replaceAll('"', "")}\"
                      <a href="#" 
                        class="ast-node"
                        id=${index}
                        data-filename="${node.fileName}" 
                        data-line="${node.line}" 
                        data-column="${node.column}"
                        data-fullName="${node.fullName}" 
                        data-length="${node.length}"
                      >
                        ${this.getShortFilename(node.fileName)} [${node.line}:${node.column}]
                      </a>
                    </div>
                </div>
              </td>
            </tr>`;
      });
    } else {
      html += `
        <p>
          No attack vector information.
        </p>`;
    }
    return html;
  }

  getBflTips(cxPath: vscode.Uri){
    return (`
            <div class="loader" id="loader">
            </div>
            <p class="bfl-tip-loaded" id="bfl-tip-loaded">
              <img class="bfl-logo" src="${cxPath}" alt="CxLogo"/> points to the best fix location in the code - Make remediation much quicker!
            </p> 
            <p class="bfl-tip-loading" id="bfl-tip-loading">
              Loading best fix location 
            </p>
    `
    );
  }
  getShortFilename(filename: string) {
    let r;
    filename.length > 50 ? (r = "..." + filename.slice(-50)) : (r = filename);
    return r;
  }

  getTitle() {
    let r = "";
    if (this.sastNodes && this.sastNodes.length > 0) {
      r = `<h3 class="subtitle">Attack Vector</h3><hr class="division"/>`;
    }
    if (this.scaNode) {
      r = `<h3 class="subtitle">Package Data</h3><hr class="division"/>`;
    }
    if (this.kicsNode) {
      r = `<h3 class="subtitle">Location</h3><hr class="division"/>`;
    }
    return r;
  }

  private scaDetails() {
    let html = "";
    // validar package data
    if (this.scaNode?.packageData) {
      this.scaNode?.packageData.forEach((node, index) => {
        html += `
        <tr>
			    <td>
						${index + 1}. 
						<a href="${node.comment}">
							${node.comment}
						</a>
					</td>
				</tr>`;
      });
    } else {
      html += `
        <p>
          No package data information.
        </p>`;
    }
    return html;
  }

  private kicsDetails() {
    let html = "";
    html += `
        <tr>
          <td>
            <div class="tooltip">
                1. 
                <span class="tooltiptext">
                ${this.kicsNode?.data.filename}
                </span>
            </div>
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
          </td>
        </tr>`;
    return html;
  }
}