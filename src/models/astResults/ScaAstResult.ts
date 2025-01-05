import { AstResult } from "./AstResult";
import { ScaNode } from "../nodes/ScaNode";
import * as vscode from "vscode";

export class ScaAstResult extends AstResult {
  scaNode: ScaNode;
  typeLabel = "";
  fileName = "";
  scaType = "";
  cweId: string;

  constructor(result: any) {
    super(result);

    if (result.data) {
      this.scaNode = new ScaNode(
        result.id,
        result.description,
        result.severity,
        result.data.packageIdentifier,
        result.data.recommendedVersion,
        result.data.scaPackageData || {},
        result.data.packageData || []
        // result.data.packageId || [] // ??
      );
    }
    this.scaType = result.scaType;
    this.type = result.scaType ? "sca" : result.type;

    this.label = result.id ? result.id : result.vulnerabilityDetails.cveName;
    this.typeLabel = result.label;
    this.cweId = result.vulnerabilityDetails?.cweId;
  }

  getResultHash(): string {
    return this.scaNode.id;
  }

  getHtmlDetails(cxPath: vscode.Uri): string {
    if (this.scaNode) {
      return this.scaDetails();
    }
    return "";
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

  getTitle(): string {
    let r = "";
    if (this.scaNode) {
      r = `<h3 class="subtitle">Package Data</h3><hr class="division"/>`;
    }
    return r;
  }

  public scaLocations(scaUpgrade) {
    let html = "";
    this.scaNode.scaPackageData.dependencyPaths.forEach(
      (pathArray: any, indexDependency: number) => {
        if (indexDependency === 0) {
          html += ` <div class="card-content" style="max-height:134px;overflow:scroll;margin-top:15px" id="locations-table-${
            indexDependency + 1
          }">
        <table class="details-table" style="margin-left:28px;margin-top:15px;width:100%">
          <tbody>`;
        } else {
          html += ` <div class="card-content" style="display:none;max-height:134px;overflow:scroll;margin-top:15px" id="locations-table-${
            indexDependency + 1
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
                    ${
                      this.scaNode.recommendedVersion &&
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

  public scaReferences() {
    let html = "";
    if (this.scaNode.packageData) {
      this.scaNode.packageData.forEach((data: any) => {
        html += `<a class="references" id="${data.url}">
            ${data.type}
            </a>&nbsp&nbsp`;
      });
    } else {
      html += `<p style="margin:25px;font-size:0.9em">
            No references available
          </p>`;
    }
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
            <table class="package-table" style="display: none;" id="package-table-${
              index + 1
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
    scaUpgrade: string,
    scaUrl: vscode.Uri | string,
    scaAtackVector: string,
    scaComplexity: string,
    scaAuthentication: string,
    scaConfidentiality: string,
    scaIntegrity: string,
    scaAvailability: string
  ): string {
    // Non-real-time logic only
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
        </div>
        ${
          this.scaNode.scaPackageData
            ? `
          <div class="card">
            <p class="header-content">Remediation</p>
            <div class="card-content">
              <div class="remediation-container">
                ${this.scaRemediation(
                  result,
                  scaUpgrade,
                  scaUrl,
                  "non-realtime"
                )}
              </div>
            </div>
          </div>
          <div class="card">
            <div style="display: inline-block;position: relative;">
              <p class="header-content">Vulnerable Package Paths</p>
            </div>
            ${this.scaPackages(scaUpgrade)}
          </div>`
            : `
          <div class="card-content">
            <p style="margin:25px;font-size:0.9em">
              No package path information available
            </p>
          </div>`
        }
        <div class="card" style="border:0">
          <p class="header-content">References</p>
          <div class="card-content" style="margin:15px;">
            ${this.scaReferences()}
          </div>
        </div>
      </div>`;
  }

  private scaRemediation(result, scaUpgrade, scaUrl, type?) {
    return `
            ${
              !type
                ? `<div
              class=${
                result.scaNode.recommendedVersion &&
                result.scaNode.scaPackageData.supportsQuickFix === true
                  ? "remediation-icon"
                  : "remediation-icon-disabled"
              }
              data-version="${
                result.scaNode.recommendedVersion &&
                result.scaNode.scaPackageData.supportsQuickFix === true
                  ? result.scaNode.recommendedVersion
                  : ""
              }"
              data-package="${
                result.scaNode.scaPackageData.dependencyPaths &&
                result.scaNode.scaPackageData.dependencyPaths[0][0].name
                  ? result.scaNode.scaPackageData.dependencyPaths[0][0].name
                  : ""
              }"
              data-file="${
                result.scaNode.scaPackageData.dependencyPaths &&
                result.scaNode.scaPackageData.dependencyPaths[0][0].locations
                  ? result.scaNode.scaPackageData.dependencyPaths[0][0]
                      .locations
                  : ""
              }"
              >
                <img
                  data-version="${
                    result.scaNode.recommendedVersion
                      ? result.scaNode.recommendedVersion
                      : ""
                  }"
                  data-package="${
                    result.scaNode.scaPackageData.dependencyPaths &&
                    result.scaNode.scaPackageData.dependencyPaths[0][0].name
                      ? result.scaNode.scaPackageData.dependencyPaths[0][0].name
                      : ""
                  }"
                  data-file="${
                    result.scaNode.scaPackageData.dependencyPaths &&
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
            class=${
              result.scaNode.recommendedVersion &&
              result.scaNode.scaPackageData.supportsQuickFix === true
                ? "remediation-version"
                : "remediation-version-disabled"
            }
            data-version="${
              result.scaNode.recommendedVersion &&
              result.scaNode.scaPackageData.supportsQuickFix === true
                ? result.scaNode.recommendedVersion
                : ""
            }"
            data-package="${
              result.scaNode.scaPackageData.dependencyPaths &&
              result.scaNode.scaPackageData.dependencyPaths[0][0].name
                ? result.scaNode.scaPackageData.dependencyPaths[0][0].name
                : ""
            }"
            data-file="${
              result.scaNode.scaPackageData.dependencyPaths &&
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
                  class=${
                    result.scaNode.recommendedVersion &&
                    result.scaNode.scaPackageData.supportsQuickFix === true
                      ? "version"
                      : "version-disabled"
                  }
                  data-version="${
                    result.scaNode.recommendedVersion
                      ? result.scaNode.recommendedVersion
                      : ""
                  }"
                data-package="${
                  result.scaNode.scaPackageData.dependencyPaths &&
                  result.scaNode.scaPackageData.dependencyPaths[0][0].name
                    ? result.scaNode.scaPackageData.dependencyPaths[0][0].name
                    : ""
                }"
                data-file="${
                  result.scaNode.scaPackageData.dependencyPaths &&
                  result.scaNode.scaPackageData.dependencyPaths[0][0].locations
                    ? result.scaNode.scaPackageData.dependencyPaths[0][0]
                        .locations
                    : ""
                }">
                  ${
                    result.scaNode.recommendedVersion
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
                  ${
                    result.scaNode.scaPackageData.fixLink &&
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
