import { AstResult } from "./AstResult";
import { MultipleSastNode } from "../nodes/MultipleSastNode";
import { SastNode } from "../nodes/SastNode";
import * as vscode from "vscode";

export class SastAstResult extends AstResult {
  multipleSastNode: MultipleSastNode;
  fileName: string = "";
  cweId: string = "";
  typeLabel = "";
  queryId: string = "";

  constructor(result: any) {
    super(result);

    const sastNodes = result.data?.nodes || [];
    this.multipleSastNode = new MultipleSastNode(
      sastNodes.map(
        (node: any) =>
          new SastNode(
            node.id,
            node.column,
            node.fileName,
            node.fullName,
            node.length,
            node.line,
            node.methodLine,
            node.name,
            node.domType,
            node.method,
            node.nodeID,
            node.definitions,
            node.nodeSystemId,
            node.nodeHash
          )
      )
    );
    this.typeLabel = result.label;
    this.handleFileNameAndLine(result);
    this.queryId = result.data.queryId;
  }

  handleFileNameAndLine(result: any): void {
    if (this.multipleSastNode.getNodes().length > 0) {
      const firstNode = this.multipleSastNode.getNodes()[0];
      this.fileName = firstNode.fileName;

      const shortFilename =
        this.fileName && this.fileName.includes("/")
          ? this.fileName.slice(this.fileName.lastIndexOf("/"))
          : "";
      this.label += ` (${
        shortFilename.length && shortFilename.length > 0
          ? shortFilename
          : this.fileName
      }${
        this.multipleSastNode.getNodes()[0].line > 0
          ? ":" + this.multipleSastNode.getNodes()[0].line
          : ""
      })`;
    }

    this.cweId = result.cweId || result.vulnerabilityDetails?.cweId;
  }

  getResultHash(): string {
    if (this.multipleSastNode.getNodes().length > 0) {
      return this.data.resultHash;
    }
    return "";
  }

  getHtmlDetails(cxPath: vscode.Uri): string {
    return this.getSastDetails(cxPath);
  }

  getSastDetails(cxPath: vscode.Uri): string {
    let html = "";
    const nodes = this.multipleSastNode.getNodes();

    if (nodes.length > 0) {
      nodes.forEach((node, index) => {
        html += `
          <tr>
          <td style="background:var(--vscode-editor-background)">
            <div class="bfl-container" id=bfl-container-${index}>
              <img class="bfl-logo" src="${cxPath}" alt="CxLogo"/>
            </div>
          <td>
              <div>
                    <div style="display: inline-block;">
                      ${index + 1}. "${node.name.replaceAll('"', "")}"
                      <a href="#" 
                        class="ast-node"
                        id=${index}
                        data-filename="${node.fileName}" 
                        data-line="${node.line}" 
                        data-column="${node.column}"
                        data-fullName="${node.fullName}" 
                        data-length="${node.length}"
                      >
                        ${this.getShortFilename(node.fileName)}
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

  getTitle(): string {
    let r = "";
    if (this.multipleSastNode.getNodes().length > 0) {
      r = `<h3 class="subtitle">Attack Vector</h3><hr class="division"/>`;
    }
    return r;
  }
}
