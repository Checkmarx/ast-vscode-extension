import { KicsRealtime } from "./kicsRealtime";
import { AstResult } from "./astResults/AstResult";
import { KicsAstResult } from "./astResults/KicsAstResult";
import { constants } from "../utils/common/constants";
import * as vscode from "vscode";
import path = require("path");

export class GptResult {
  filename = "";
  line = 0;
  severity = "";
  vulnerabilityName = "";
  resultID = "";

  constructor(astResult: AstResult, kicsResult: KicsRealtime) {
    const resultType = AstResult.checkType(astResult);
    if (kicsResult !== undefined) {
      this.filename = kicsResult.files[0].file_name.toString();
      this.line = kicsResult.files[0].line;
      this.severity = kicsResult.severity;
      this.vulnerabilityName = kicsResult.query_name;
    }
    if (astResult !== undefined) {
      const workspacePath = vscode.workspace.workspaceFolders;
      if (astResult.type === "sast") {
        this.filename = workspacePath
          ? workspacePath[0].uri.fsPath
          : astResult.fileName;
        this.resultID = astResult.id;
      } else {
        if (AstResult.checkType(astResult) === constants.kics) {
          const kicsObj = astResult as KicsAstResult;

          try {
            this.filename = workspacePath
              ? path.join(
                  workspacePath[0].uri.fsPath,
                  kicsObj.kicsNode?.data.filename ?? ""
                )
              : kicsObj.kicsNode?.data.filename;
          } catch (e) {
            console.log("Could not produce filename. error: ", e);
          }
        }
      }
      if (AstResult.checkType(astResult) === constants.kics) {
        const kicsObj = astResult as KicsAstResult;
        this.line = kicsObj.kicsNode?.data.line;
      }

      this.severity = astResult.severity;
      this.vulnerabilityName = astResult.label.replaceAll("_", " ");
    }
  }
}
