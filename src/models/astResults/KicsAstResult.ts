import { AstResult } from "./AstResult";
import { KicsNode, KicsSummary } from "../nodes/KicsNode";
import * as vscode from "vscode";

export class KicsAstResult extends AstResult {
  kicsNode: KicsNode;
  typeLabel = "";
  cweId = "";
  queryId = "";

  constructor(result: any) {
    super(result);
    this.kicsNode = new KicsNode(
      result.id,
      result.description,
      result.severity,
      result.data.queryId,
      result.data.queryName,
      result.data.group,
      result.data
    );
    this.typeLabel = result.label;
    this.handleFileNameAndLine(result);
    this.queryId = result.data.queryId;
  }

  handleFileNameAndLine(result: any): void {
    this.cweId = result.vulnerabilityDetails?.cweId;
  }
  setSeverity(severity: string) {
    if (this.kicsNode) {
      this.kicsNode.severity = severity;
    }
  }

  getResultHash(): string {
    if (this.kicsNode) {
      return this.kicsNode.id;
    }
  }

  getHtmlDetails(cxPath: vscode.Uri): string {
    if (this.kicsNode) {
      return this.kicsDetails();
    }
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
				  ${this.getShortFilename(this.kicsNode?.data.filename)} [${
      this.kicsNode?.data.line
    }:${0}]
				</a>
			  </td>
			</tr>
			`;
    return html;
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

  getTitle(): string {
    let r = "";
    if (this.kicsNode) {
      r = `<h3 class="subtitle">Location</h3><hr class="division"/>`;
    }
    return r;
  }
}
