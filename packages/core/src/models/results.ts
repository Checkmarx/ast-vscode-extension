/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import CxVulnerabilityDetails from "@checkmarx/ast-cli-javascript-wrapper/dist/main/results/CxVulnerabilityDetails";
import path = require("path");
import * as vscode from "vscode";
import {
  StateLevel,
  SeverityLevel,
  constants,
} from "../utils/common/constants";
import { KicsNode } from "./kicsNode";
import { SastNode } from "./sastNode";
import { ScaNode } from "./scaNode";
import { SCSSecretDetectionNode } from "./SCSSecretDetectionNode";
import CxResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import { MediaPathResolver } from "../utils/mediaPathResolver";

export class AstResult extends CxResult {
  label = "";
  type = "";
  id = "";
  typeLabel = "";
  scaType = "";
  fileName = "";
  queryName = "";
  severity = "";
  status = "";
  language = "";
  description = "";
  descriptionHTML = "";
  alternateId = "";
  similarityId = "";
  declare data: any;
  state = "";
  queryId = "";
  sastNodes: SastNode[] = [];
  scaNode: ScaNode | undefined;
  kicsNode: KicsNode | undefined;
  secretDetectionNode: SCSSecretDetectionNode | undefined;
  cweId: string | undefined;
  packageIdentifier: string;
  riskScore: number = 0;
  traits: { [key: string]: string } = {};

  declare vulnerabilityDetails: CxVulnerabilityDetails;

  setSeverity(severity: string) {
    this.severity = severity;
    if (this.kicsNode) {
      this.kicsNode.severity = severity;
    }
  }

  setState(state: string) {
    this.state = state;
  }

  constructor(result?: any) {
    super(
      result.scaType ? constants.sca : result.type,
      result.data.queryName
        ? result.data.queryName
        : result.id
          ? result.id
          : result.vulnerabilityDetails.cveName,
      result.id,
      result.status,
      result.alternateId,
      result.similarityId,
      result.state,
      result.severity,
      result.created,
      result.firstFoundAt,
      result.foundAt,
      result.firstScanId,
      result.description,
      result.data,
      result.comments,
      result.vulnerabilityDetails,
      result.descriptionHTML,
      result.riskScore,
      result.traits
    );
    this.id = result.id;
    this.type = result.scaType ? constants.sca : result.type;
    this.typeLabel = this.determineTypeLabel(result);
    this.scaType = result.scaType;
    this.label = result.data.queryName
      ? result.data.queryName
      : this.formatFilenameLine(result)
        ? this.formatFilenameLine(result)
        : result.id
          ? result.id
          : result.vulnerabilityDetails.cveName;
    this.severity = result.severity;
    this.status = result.status;
    this.language = result.data.languageName;
    this.description = result.description;
    this.descriptionHTML = result.descriptionHTML;
    this.data = result.data;
    this.state = result.state;
    this.similarityId = result.similarityId;
    this.queryName = result.data.queryName;
    this.queryName = result.data.queryName ?? result.data.packageIdentifier ?? result.id;
    this.queryId = result.data.queryId;
    this.vulnerabilityDetails = result.vulnerabilityDetails;
    this.riskScore = result.riskScore;
    this.traits = result.traits;

    this.handleFileNameAndLine(result);

    if (result.type === constants.sca || result.scaType) {
      this.scaNode = result.data;
    }
    if (result.type === constants.kics) {
      this.kicsNode = result;
    }
    if (result.type === constants.scsSecretDetection) {
      this.secretDetectionNode = result;
    }
  }

  formatFilenameLine(result: {
    data?: { line?: number; filename?: string; ruleName?: string };
  }): string {
    const filename = result.data?.filename?.split("/").pop();
    const line = result.data?.line;
    const ruleName = result.data?.ruleName;
    if (ruleName && filename && line !== undefined) {
      return `${ruleName} (/${filename}:${line})`;
    }
  }

  handleFileNameAndLine(result: any): void {
    // Relevant for sast, sca , kicks because , they have the filename inside result.data.nodes
    if (result.data.nodes && result.data.nodes[0]) {
      this.sastNodes = result.data.nodes;

      // Assign a unique ID for accurate tracking and reference of the vulnerability
      const resultLabel = this.label;
      this.sastNodes.forEach((node: SastNode, index: number) => {
        node.uniqueId = `${resultLabel}_${node.fileName}_${node.line}_${node.column}_${index}`;
      });

      this.fileName = result.data.nodes[0].fileName;
      const shortFilename =
        this.fileName && this.fileName.includes("/")
          ? this.fileName.slice(this.fileName.lastIndexOf("/"))
          : "";
      this.label += ` (${shortFilename.length && shortFilename.length > 0
        ? shortFilename
        : this.fileName
        }${result.data.nodes[0].line > 0 ? ":" + result.data.nodes[0].line : ""
        })`;
    } else if (result.data.fileName) {
      //Relevant for scs  , because this engine  have the filename inside result.data
      this.fileName = result.data.fileName;
      const shortFilename =
        this.fileName && this.fileName.includes("/")
          ? this.fileName.slice(this.fileName.lastIndexOf("/"))
          : "";
      this.label += ` (${shortFilename.length && shortFilename.length > 0
        ? shortFilename
        : this.fileName
        }${result.data.line > 0 ? ":" + result.data.line : ""})`;
    }

    this.cweId = result.cweId || result.vulnerabilityDetails?.cweId;
  }

  determineTypeLabel(result: any): string | undefined {
    if (result.label) {
      return result.label;
    }
    if (result.type === constants.scsSecretDetection) {
      return constants.secretDetection;
    }
    return undefined;
  }

  getIcon() {
    switch (this.severity) {
      case constants.criticalSeverity:
        return MediaPathResolver.getMediaFilePath("icons", "critical_untoggle.svg");
      case constants.highSeverity:
        return MediaPathResolver.getMediaFilePath("icons", "high_untoggle.svg");
      case constants.mediumSeverity:
        return MediaPathResolver.getMediaFilePath("icons", "medium_untoggle.svg");
      case constants.infoSeverity:
        return MediaPathResolver.getMediaFilePath("icons", "info_untoggle.svg");
      case constants.lowSeverity:
        return MediaPathResolver.getMediaFilePath("icons", "low_untoggle.svg");
    }
    return "";
  }

  getGptIcon() {
    return MediaPathResolver.getMediaFilePath("icons", "gpt.png");
  }

  getCxIcon() {
    return MediaPathResolver.getMediaFilePath("icon.png");
  }

  getCxScaAtackVector() {
    return MediaPathResolver.getMediaFilePath("icons", "attackVector.png");
  }

  getCxScaComplexity() {
    return MediaPathResolver.getMediaFilePath("icons", "complexity.png");
  }

  getCxAuthentication() {
    return MediaPathResolver.getMediaFilePath("icons", "authentication.png");
  }

  getCxConfidentiality() {
    return MediaPathResolver.getMediaFilePath("icons", "confidentiality.png");
  }

  getCxIntegrity() {
    return MediaPathResolver.getMediaFilePath("icons", "integrity.png");
  }

  getCxAvailability() {
    return MediaPathResolver.getMediaFilePath("icons", "availability.png");
  }

  getCxUpgrade() {
    return MediaPathResolver.getMediaFilePath("icons", "upgrade.png");
  }

  getCxUrl() {
    return MediaPathResolver.getMediaFilePath("icons", "url.png");
  }

  getTreeIcon() {
    const iconPath = this.getIcon();
    const iconUri = vscode.Uri.file(iconPath);
    return {
      light: iconUri,
      dark: iconUri,
    };
  }

  getSeverityCode() {
    switch (this.severity) {
      case constants.criticalSeverity:
        return vscode.DiagnosticSeverity.Error;
      case constants.highSeverity:
        return vscode.DiagnosticSeverity.Error;
      case constants.mediumSeverity:
        return vscode.DiagnosticSeverity.Warning;
      case constants.infoSeverity:
        return vscode.DiagnosticSeverity.Information;
    }
    return vscode.DiagnosticSeverity.Information;
  }

  getSeverity() {
    switch (this.severity) {
      case constants.criticalSeverity:
        return SeverityLevel.critical;
      case constants.highSeverity:
        return SeverityLevel.high;
      case constants.mediumSeverity:
        return SeverityLevel.medium;
      case constants.infoSeverity:
        return SeverityLevel.info;
      case constants.lowSeverity:
        return SeverityLevel.low;
    }
    return SeverityLevel.empty;
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
      default:
        return StateLevel.customStates;
    }
  }

  getResultHash() {
    if (this.sastNodes && this.sastNodes.length > 0) {
      return this.data.resultHash;
    }
    if (this.kicsNode) {
      return this.kicsNode.id;
    }
    if (this.scaNode) {
      return this.id;
    }

    return "";
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
              ${this.getShortFilename(this.kicsNode?.data.filename)} [${this.kicsNode?.data.line
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

  getBflTips(cxPath: vscode.Uri) {
    return `
            <div class="loader" id="loader">
            </div>
            <p class="bfl-tip-loaded" id="bfl-tip-loaded">
              <img class="bfl-logo" src="${cxPath}" alt="CxLogo"/> points to the best fix location in the code - Make remediation much quicker!
            </p> 
            <p class="bfl-tip-loading" id="bfl-tip-loading">
              Loading best fix location 
            </p>
    `;
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
        <p style="font-size:0.9em">
          No package data information.
        </p>`;
    }
    return html;
  }

  public scaLocations(scaUpgrade) {
    let html = "";
    this.scaNode.scaPackageData.dependencyPaths.forEach(
      (pathArray: any, indexDependency: number) => {
        if (indexDependency === 0) {
          html += ` <div class="card-content" style="max-height:134px;overflow:scroll;margin-top:15px" id="locations-table-${indexDependency + 1
            }">
        <table class="details-table" style="margin-left:28px;margin-top:15px;width:100%">
          <tbody>`;
        } else {
          html += ` <div class="card-content" style="display:none;max-height:134px;overflow:scroll;margin-top:15px" id="locations-table-${indexDependency + 1
            }">
        <table class="details-table" style="margin-left:28px;" >
          <tbody>`;
        }
        html += `
                <div>
                    <div style="display: inline-block;margin-left:28px">
                     Package ${pathArray[0].name} is located in:
                    </div>
                </div>
                <div style="margin-left:28px">
               `;
        pathArray.forEach((path: any, index: number) => {
          if (index === 0) {
            if (path.locations) {
              path.locations.forEach((location: any, index: number) => {
                html += `
                    <a href="#" 
                      class="ast-node"
                      id="${index}"
                      data-filename="${location}" 
                      data-line="${0}" 
                      data-column="${0}"
                      data-fullName="${location}" 
                      data-length="${1}"
                    >
                      ${location}
                    </a>
                    ${this.scaNode.recommendedVersion &&
                    this.scaNode.scaPackageData.supportsQuickFix === true &&
                    this.scaNode.scaPackageData.dependencyPaths[0][0].name
                    ? ` <img 
                          alt="icon" 
                          class="upgrade-small-icon" 
                          src="${scaUpgrade}"
                          data-version="${this.scaNode.recommendedVersion}" 
                          data-package="${this.scaNode.scaPackageData.dependencyPaths[0][0].name}" 
                          data-file="${location}"
                        />`
                    : ""
                  }
                    ${index + 1 < path.locations.length ? `&nbsp;| &nbsp;` : ""}
                `;
              });
            } else {
              html += `
                  <div style="display: inline-block">
                    ${path.name} is unresolved
                    <a href="#"
                      class="ast-node"
                      id="${index}"
                    >
                    </a>
                  </div>
                `;
            }
          }
        });
        html += `      </div>
                </tbody>
              </table>	
            </div>`;
      }
    );
    return html;
  }

  public getHtmlAdditionaltrait(result: { traits: Record<string, string> }): string {
    if (Object.keys(result.traits).length > 0) {
      const rows = Object.entries(result.traits)
        .map((value) =>
          `<tr><td><div><div style="display: inline-block">${value[1]}</div></div></td></tr>`
        )
        .join("");

      return `
          <table class="package-table" id="package-table-1">
            <tbody>${rows}</tbody>
          </table>
        `;
    }

    return `
      <div style="margin:15px 15px 15px 28px"><p>
            No additional trait available
      </p></div>
    `;
  }


  public scaReferences() {
    let html = "";
    if (this.scaNode.packageData) {
      this.scaNode.packageData.forEach((data: any) => {
        html += `<a class="references" id="${data.url}">
            ${data.type}
            </a>&nbsp&nbsp`;
      });
    } else {
      html += `<div><p>
            No references available 
          </p></div>`;
    }
    return html;
  }

  public scaRealtimeNodes(result) {
    let html = "";
    this.sastNodes.forEach((node, index) => {
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
            </td>
          </tr>`;
    });
    return html;
  }

  public scaPackages(scaUpgrade) {
    let html = this.scaLocations(scaUpgrade);
    this.scaNode.scaPackageData.dependencyPaths.forEach(
      (dependencyArray: any, index: number) => {
        if (index === 0) {
          html += `<div class="card-content">
            <table class="package-table" id="package-table-${index + 1}">
              <tbody>`;
        } else {
          html += `<div class="card-content">
            <table class="package-table" style="display: none;" id="package-table-${index + 1
            }">
              <tbody>`;
        }
        dependencyArray.forEach((dependency: any) => {
          html += `<tr>
                  <td>
                    <div>
                      <div style="display: inline-block">
                        ${dependency.name}
                      </div>
                    </div>
                  </td>
                </tr>
               `;
        });
        html += `
              </tbody>
                </table>
                  </div>`;
      }
    );
    return html;
  }

  public scaContent(
    result: AstResult,
    scaUpgrade,
    scaUrl,
    scaAtackVector,
    scaComplexity,
    scaAuthentication,
    scaConfidentiality,
    scaIntegrity,
    scaAvailability,
    type
  ) {
    return `
    <div class="left-content">
      <div class="card" style="border-top: none;border-top-style: none;">
        <div class="description">
          ${result.descriptionHTML ? result.descriptionHTML : result.description
      }
        </div>
        ${type === "realtime"
        ? `
        <div class="remediation-links-rows-realtime">
          <img class="remediation-links-rows-image" alt="icon" src="${scaUrl}" />
          <p class="remediation-links-text" id="${result.scaNode.scaPackageData.fixLink}">
            About this vulnerability
          </p>
        </div>`
        : ""
      }
      </div>
      ${result.scaNode.scaPackageData
        ? `
      <div class="card">
      ${!type
          ? `<p class="header-content">
      Remediation
    </p>`
          : ""
        }
    ${!type
          ? `
    <div class="card-content">
        <div class="remediation-container">
          ${result.scaRemediation(result, scaUpgrade, scaUrl, type)}	
        </div>
      </div>
    `
          : ""
        }
    </div>
    <div class="card">
        <div style="display: inline-block;position: relative;">
          <p class="header-content">
          ${!type ? "Vulnerable Package Paths" : "Vulnerable Package"}
          </p>
        </div>
        ${result.scaNode.scaPackageData.dependencyPaths
          ? `
        <div class="package-buttons-container">
          <button 
            class="package-back"
            id="package-back"
            data-current="1" 
            data-total="${result.scaNode.scaPackageData.dependencyPaths.length
          }" 
            data-previous="null"
            disabled
          >
          </button>
          <p id="package-counter" class="package-counter-numbers">1/${result.scaNode.scaPackageData.dependencyPaths.length
          }</p>
          <button 
            class="package-next"
            data-current="1" 
            ${result.scaNode.scaPackageData.dependencyPaths.length === 1
            ? "disabled"
            : ""
          }
            data-total="${result.scaNode.scaPackageData.dependencyPaths.length}"
            id="package-next"
            data-previous="null"
          >  
          </button>
        </div>
      ${result.scaPackages(scaUpgrade)}	
    </div>`
          : !type
            ? `
          <div class="card-content">
            <p style="margin:25px;font-size:0.9em">
              No package path information available
            </p>
          </div>
      </div>
            `
            : `
          <div class="card-content">
            ${result.scaRealtimeNodes(result)}
          </div>
      </div>
            `
        }
    <div class="card" ${result.traits !== undefined ? "" : `style="border:0"`}>
      <p class="header-content">
        References
      </p>
      <div class="card-content" style="margin:15px 15px 15px 28px">
        ${result.scaReferences()}
      </div>
    </div>
    ${result.traits !== undefined ?
          `<div class="card" style="border:0">
          <div style="display: inline-block;position: relative;">
              <p class="header-content">
                Additional Trait
              </p>
          </div>
          <div class="card-content">
                ${result.getHtmlAdditionaltrait(result)}
          </div>
      </div>`
          : ""} 
  </div>
      `
        : `
    <div class="card" style="border:0">
      <p style="margin:25px;font-size:0.9em"> 
        No more information available
      </p>
    </div>
  </div>
    `
      }
  <div class="right-content">
    ${result.vulnerabilityDetails.cvss &&
        result.vulnerabilityDetails.cvss.version
        ? `
      <div class="content">
        <div class="header-content-selected">
          <button class="cvss-button-selected" disabled>
            CVSS ${parseInt(result.vulnerabilityDetails.cvss.version)}
          </button>
        </div>
      </div>
    `
        : `
      <div class="content">
        <div class="header-content-selected">
          <button class="cvss-button-selected" disabled>
            CVSS 3
          </button>
        </div>
      </div>
    `
      }
    <div class="sca-details" style="border-bottom: 1px;border-bottom-style: solid;border-color: rgb(128, 128, 128,0.5);">
      <div class="score-card" style="${result.severity === "HIGH"
        ? "border: 1px solid #D94B48"
        : result.severity === "MEDIUM"
          ? "border: 1px solid #F9AE4D"
          : result.severity === "LOW"
            ? "border: 1px solid #029302"
            : "border: 1px solid #87bed1"
      }">
        <div class="left-${result.severity}">
          <p class="header-text">
            Score
          </p>
          <p>
              ${result.vulnerabilityDetails &&
        result.vulnerabilityDetails.cvssScore
        ? result.vulnerabilityDetails.cvssScore.toFixed(1)
        : "N/A"
      }
          </p>
        </div>
        <div class="right-${result.severity}">
          <p class="header-text-${result.severity}">
            ${result.severity}
          </p>
          <div class="severity-inner-${result.severity}">
            <div class="severity-bar-${result.severity}">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="sca-details">
      <div class="info-cards">
        <div class="info-cards-text">
          <p class="info-cards-description">
            Attack Vector
          </p>
          <p class="info-cards-value">
            ${result.vulnerabilityDetails.cvss &&
        result.vulnerabilityDetails.cvss.attackVector
        ? result.vulnerabilityDetails.cvss.attackVector
        : "No information"
      }
          </p>
        </div>
        <div class="info-cards-icon">
          <img alt="icon" class="info-cards-icons" src="${scaAtackVector}" />
        </div>
      </div>
    </div>
    <div class="sca-details">
      <div class="info-cards">
        <div class="info-cards-text">
          <p class="info-cards-description">
            Attack Complexity
          </p>
          <p class="info-cards-value">
            ${result.vulnerabilityDetails.cvss &&
        result.vulnerabilityDetails.cvss.attackComplexity
        ? result.vulnerabilityDetails.cvss.attackComplexity
        : "No information"
      }
          </p>
        </div>
        <div class="info-cards-icon">
          <img alt="icon" class="info-cards-icons" src="${scaComplexity}" />
        </div>
      </div>
    </div>
    ${result.vulnerabilityDetails.cvss &&
        result.vulnerabilityDetails.cvss.privilegesRequired
        ? `
      <div class="sca-details">
      <div class="info-cards">
        <div class="info-cards-text">
          <p class="info-cards-description">
            Privileges Required
          </p>
          <p class="info-cards-value">
            ${result.vulnerabilityDetails.cvss.privilegesRequired
          ? result.vulnerabilityDetails.cvss.privilegesRequired
          : "No information"
        }
          </p>
        </div>
        <div class="info-cards-icon">
          <img alt="icon" class="info-cards-icons" src="${scaAuthentication}" />
        </div>
      </div>
    </div>`
        : ``
      }
    <div class="sca-details">
      <div class="info-cards">
        <div class="info-cards-text">
          <p class="info-cards-description">
            Confidentiality Impact
          </p>
          <p class="info-cards-value">
            ${result.vulnerabilityDetails.cvss &&
        result.vulnerabilityDetails.cvss.confidentiality
        ? result.vulnerabilityDetails.cvss.confidentiality
        : "No information"
      }
          </p>
        </div>
        <div class="info-cards-icon">
          <img alt="icon" class="info-cards-icons" src="${scaConfidentiality}" />
        </div>
      </div>
    </div>
    ${result.vulnerabilityDetails.cvss &&
        result.vulnerabilityDetails.cvss.integrityImpact
        ? `
      <div class="sca-details">
        <div class="info-cards">
          <div class="info-cards-text">
            <p class="info-cards-description">
              Integrity Impact
            </p>
            <p class="info-cards-value">
              ${result.vulnerabilityDetails.cvss.integrityImpact
          ? result.vulnerabilityDetails.cvss.integrityImpact
          : "No information"
        }
            </p>
          </div>
          <div class="info-cards-icon">
            <img alt="icon" class="info-cards-icons" src="${scaIntegrity}" />
          </div>
        </div>
      </div>`
        : ``
      }
    <div class="sca-details">
      <div class="info-cards">
        <div class="info-cards-text">
          <p class="info-cards-description">
            Availability Impact
          </p>
          <p class="info-cards-value">
            ${result.vulnerabilityDetails.cvss &&
        result.vulnerabilityDetails.cvss.availability
        ? result.vulnerabilityDetails.cvss.availability
        : "No information"
      }
          </p>
        </div>
        <div class="info-cards-icon">
          <img alt="icon" class="info-cards-icons" src="${scaAvailability}" />
        </div>
      </div>
    </div>
  </div>`;
  }

  private scaRemediation(result, scaUpgrade, scaUrl, type?) {
    return `
            ${!type
        ? `<div 
              class=${result.scaNode.recommendedVersion &&
          result.scaNode.scaPackageData.supportsQuickFix === true
          ? "remediation-icon"
          : "remediation-icon-disabled"
        }
              data-version="${result.scaNode.recommendedVersion &&
          result.scaNode.scaPackageData.supportsQuickFix === true
          ? result.scaNode.recommendedVersion
          : ""
        }" 
              data-package="${result.scaNode.scaPackageData.dependencyPaths &&
          result.scaNode.scaPackageData.dependencyPaths[0][0].name
          ? result.scaNode.scaPackageData.dependencyPaths[0][0].name
          : ""
        }" 
              data-file="${result.scaNode.scaPackageData.dependencyPaths &&
          result.scaNode.scaPackageData.dependencyPaths[0][0].locations
          ? result.scaNode.scaPackageData.dependencyPaths[0][0]
            .locations
          : ""
        }"
              >
                <img 
                  data-version="${result.scaNode.recommendedVersion
          ? result.scaNode.recommendedVersion
          : ""
        }" 
                  data-package="${result.scaNode.scaPackageData.dependencyPaths &&
          result.scaNode.scaPackageData.dependencyPaths[0][0].name
          ? result.scaNode.scaPackageData.dependencyPaths[0][0].name
          : ""
        }" 
                  data-file="${result.scaNode.scaPackageData.dependencyPaths &&
          result.scaNode.scaPackageData.dependencyPaths[0][0]
            .locations
          ? result.scaNode.scaPackageData.dependencyPaths[0][0]
            .locations
          : ""
        }" 
                  alt="icon" src="${scaUpgrade}" 
                  class="remediation-upgrade" />
              </div>
            <div 
            class=${result.scaNode.recommendedVersion &&
          result.scaNode.scaPackageData.supportsQuickFix === true
          ? "remediation-version"
          : "remediation-version-disabled"
        }
            data-version="${result.scaNode.recommendedVersion &&
          result.scaNode.scaPackageData.supportsQuickFix === true
          ? result.scaNode.recommendedVersion
          : ""
        }" 
            data-package="${result.scaNode.scaPackageData.dependencyPaths &&
          result.scaNode.scaPackageData.dependencyPaths[0][0].name
          ? result.scaNode.scaPackageData.dependencyPaths[0][0].name
          : ""
        }" 
            data-file="${result.scaNode.scaPackageData.dependencyPaths &&
          result.scaNode.scaPackageData.dependencyPaths[0][0].locations
          ? result.scaNode.scaPackageData.dependencyPaths[0][0].locations
          : ""
        }"
            >
            
              <div class="remediation-version-container">
                <p class="remediation-description">
                  Upgrade To Version
                </p>
                <p
                  class=${result.scaNode.recommendedVersion &&
          result.scaNode.scaPackageData.supportsQuickFix === true
          ? "version"
          : "version-disabled"
        }
                  data-version="${result.scaNode.recommendedVersion
          ? result.scaNode.recommendedVersion
          : ""
        }" 
                data-package="${result.scaNode.scaPackageData.dependencyPaths &&
          result.scaNode.scaPackageData.dependencyPaths[0][0].name
          ? result.scaNode.scaPackageData.dependencyPaths[0][0].name
          : ""
        }" 
                data-file="${result.scaNode.scaPackageData.dependencyPaths &&
          result.scaNode.scaPackageData.dependencyPaths[0][0].locations
          ? result.scaNode.scaPackageData.dependencyPaths[0][0]
            .locations
          : ""
        }">
                  ${result.scaNode.recommendedVersion
          ? result.scaNode.recommendedVersion
          : "Not available"
        }
                </p>
              </div>
            </div>
            <div class="remediation-links-container">
              <div class="remediation-links-about">
                <div class="remediation-links-rows">
                  <img class="remediation-links-rows-image" alt="icon" src="${scaUrl}" />
                  ${result.scaNode.scaPackageData.fixLink &&
          result.scaNode.scaPackageData.fixLink !== ""
          ? `
                  <p class="remediation-links-text" id="${result.scaNode.scaPackageData.fixLink}">
                    About this vulnerability
                  </p>
                `
          : ` <p class="remediation-links-text-disabled" id="${result.scaNode.scaPackageData.fixLink}">
                      About this vulnerability
                    </p>`
        }
                 
                </div>
              </div>
            </div>
            `
        : ``
      }`;
  }
}
