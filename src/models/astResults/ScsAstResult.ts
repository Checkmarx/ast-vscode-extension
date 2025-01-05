import { SCSSecretDetectionNode } from "../nodes/SCSSecretDetectionNode";
import { AstResult } from "./AstResult";
import { constants } from "../../utils/common/constants";
import * as vscode from "vscode";

export class ScsAstResult extends AstResult {
  secretDetectionNode: SCSSecretDetectionNode;
  typeLabel = "";
  fileName = "";
  cweId = "";

  constructor(result: any) {
    super(result);

    this.secretDetectionNode = new SCSSecretDetectionNode(
      result.id,
      result.description,
      result.severity,
      result.type,
      result.status,
      result.state,
      result.data.ruleName,
      result.data.filename,
      result.data.line,
      result.data.ruleDescription,
      result.data.remediation,
      result.data.remediationAdditional
    );
    this.typeLabel = constants.secretDetection;
    this.label = this.formatFilenameLine
      ? this.formatFilenameLine(result)
      : result.id;
    this.handleFileNameAndLine(result);
  }

  handleFileNameAndLine(result: any): void {
    this.fileName = result.data.fileName;
    const shortFilename =
      this.fileName && this.fileName.includes("/")
        ? this.fileName.slice(this.fileName.lastIndexOf("/"))
        : "";
    this.label += ` (${
      shortFilename.length && shortFilename.length > 0
        ? shortFilename
        : this.fileName
    }${result.data.line > 0 ? ":" + result.data.line : ""})`;

    this.cweId = result.cweId || result.vulnerabilityDetails?.cweId;
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

  getResultHash(): string {
    return "";
  }

  getHtmlDetails(cxPath: vscode.Uri): string {
    return "";
  }

  getTitle(): string {
    return "";
  }
}
