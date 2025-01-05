import * as vscode from "vscode";
import * as path from "path";
import {
  StateLevel,
  SeverityLevel,
  constants,
} from "../../utils/common/constants";

// import { KicsAstResult } from "./KicsAstResult";
// import { SastAstResult } from "./SastAstResult";
// import { ScaAstResult } from "./ScaAstResult";
// import { ScsAstResult } from "./ScsAstResult";
// import { ScaRealtimeAstResult } from "./ScaRealtimeAstResult";

export abstract class AstResult {
  queryId: string;
  queryName: string;
  language: string;
  cweId: string;
  fileName: string;
  typeLabel: string;
  type: string;
  label: string;
  id: string;
  similarityId: string;
  status: string;
  state: string;
  severity: string;
  created: string;
  firstFoundAt: string;
  foundAt: string;
  firstScanId: string;
  description: string;
  descriptionHTML: string;
  comments: any;
  declare data: any;
  declare vulnerabilityDetails: any;

  constructor(result: any) {
    this.type = result.type; // common
    this.label = result.data.queryName // vi  // common
      ? result.data.queryName
      : result.id
      ? result.id
      : result.vulnerabilityDetails.cveName;
    this.id = result.id; // vi  // common
    this.similarityId = result.similarityId; // vi  // common
    this.status = result.status; // vi  // common
    this.state = result.state || "";
    this.severity = result.severity; // common
    this.created = result.created; // common
    this.firstFoundAt = result.firstFoundAt; // common
    this.foundAt = result.foundAt; // common
    this.firstScanId = result.firstScanId; // common
    this.description = result.description; // common
    this.descriptionHTML = result.descriptionHTML; // common
    this.comments = result.comments; // common;
    this.data = result.data; // common
    this.vulnerabilityDetails = result.vulnerabilityDetails; // common
    this.queryId = result.data?.queryId;
    this.typeLabel = this.determineTypeLabel(result);
  }

  getKicsValues(): string {
    return ""; // Default implementation for non-Kics types
  }

  public getqueryId(): string {
    return this.queryId;
  }
  static checkType(result: any): string {
    return result.type;
  }

  setSeverity(severity: string): void {
    this.severity = severity;
  }

  // Common setter for state
  setState(state: string): void {
    this.state = state;
  }

  // Abstract methods to be implemented by subclasses
  abstract getResultHash(): string;
  determineTypeLabel(result: any): string | undefined {
    if (result.label) {
      return result.label;
    }
    if (result.type === "scs-secret-detection") {
      return "Secret Detection";
    }
    return undefined;
  }
  abstract getHtmlDetails(cxPath: vscode.Uri): string;
  abstract getTitle(): string;

  //  handleFileNameAndLine(result: any): void; // Abstract method

  // Common utility to shorten filenames
  getShortFilename(filename: string): string {
    return filename.length > 50 ? "..." + filename.slice(-50) : filename;
  }

  getIcon() {
    switch (this.severity) {
      case constants.criticalSeverity:
        return path.join("media", "icons", "critical_untoggle.svg");
      case constants.highSeverity:
        return path.join("media", "icons", "high_untoggle.svg");
      case constants.mediumSeverity:
        return path.join("media", "icons", "medium_untoggle.svg");
      case constants.infoSeverity:
        return path.join("media", "icons", "info_untoggle.svg");
      case constants.lowSeverity:
        return path.join("media", "icons", "low_untoggle.svg");
    }
    return "";
  }

  getGptIcon() {
    return path.join("media", "icons", "gpt.png");
  }

  getCxIcon() {
    return path.join("media", "icon.png");
  }

  getCxScaAtackVector() {
    return path.join("media", "icons", "attackVector.png");
  }

  getCxScaComplexity() {
    return path.join("media", "icons", "complexity.png");
  }

  getCxAuthentication() {
    return path.join("media", "icons", "authentication.png");
  }

  getCxConfidentiality() {
    return path.join("media", "icons", "confidentiality.png");
  }

  getCxIntegrity() {
    return path.join("media", "icons", "integrity.png");
  }

  getCxAvailability() {
    return path.join("media", "icons", "availability.png");
  }

  getCxUpgrade() {
    return path.join("media", "icons", "upgrade.png");
  }

  getCxUrl() {
    return path.join("media", "icons", "url.png");
  }

  getTreeIcon() {
    return {
      light: path.join(__filename, "..", "..", this.getIcon()),
      dark: path.join(__filename, "..", "..", this.getIcon()),
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
    }
  }
}
