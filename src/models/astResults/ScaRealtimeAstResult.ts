import { ScaAstResult } from "./ScaAstResult";
import { MultipleSastNode } from "../nodes/MultipleSastNode";
import { SastNode } from "../nodes/SastNode";
import * as vscode from "vscode";

export class ScaRealtimeAstResult extends ScaAstResult {
  multipleSastNode: MultipleSastNode;

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
  }

  public scaContent(
    result: any,
    scaUpgrade: string,
    scaUrl: string,
    scaAtackVector: string,
    scaComplexity: string,
    scaAuthentication: string,
    scaConfidentiality: string,
    scaIntegrity: string,
    scaAvailability: string
  ): string {
    return `
      <div class="left-content">
        <div class="card" style="border-top: 1px solid rgba(128, 128, 128, 0.5);">
          <div class="description">
            ${
              result.descriptionHTML
                ? result.descriptionHTML
                : result.description
            }
          </div>
          <div class="remediation-links-rows-realtime">
            <img class="remediation-links-rows-image" alt="icon" src="${scaUrl}" />
            <p class="remediation-links-text" id="${
              this.scaNode.scaPackageData.fixLink
            }">
              About this vulnerability
            </p>
          </div>
        </div>
        <div class="card-content">
          ${this.scaRealtimeNodes(result)}
        </div>
        <div class="card" style="border:0">
          <p class="header-content">References</p>
          <div class="card-content" style="margin:15px;">
            ${this.scaReferences()}
          </div>
        </div>
      </div>`;
  }

  public scaRealtimeNodes(result?: any): string {
    let html = "";
    this.multipleSastNode.getNodes().forEach((node, index) => {
      html += `
        <tr>
          <div>
            <div style="display: inline-block;margin:31px;">
              "${result.data.packageIdentifier}" :
              <a href="#"
                class="ast-node"
                id=${index}
                data-filename="${node.fileName}"
                data-line="${node.line}"
                data-column="${node.column}"
                data-fullName="${node.fullName}"
                data-length="${node.length}"
              >
                ${node.fileName}
              </a>
            </div>
          </div>
        </tr>`;
    });
    return html;
  }
}
