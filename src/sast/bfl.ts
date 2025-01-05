import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { SastNode } from "../models/sastNode";
import { messages } from "../utils/common/messages";
import path = require("path");
import { AstResult } from "../models/astResults/AstResult";
import { SastAstResult } from "../models/astResults/SastAstResult";
import { constants } from "../utils/common/constants";
import { getFromState } from "../utils/common/globalState";

export async function getBfl(
  scanId: string,
  queryId: string,
  resultNodes: SastNode[] | any,
  logs: Logs
) {
  try {
    logs.log("INFO", messages.bflFetchResults);
    console.log("bfl");
    const bflIndex = await this.getResultsBfl(scanId, queryId, resultNodes);
    if (bflIndex < 0) {
      logs.log("INFO", messages.bflNoLocation);
    }
    return bflIndex;
  } catch (err) {
    const error = String(err);
    vscode.window.showErrorMessage(error);
    logs.error(error);
  }
}

export async function getResultsBfl(
  logs: Logs,
  context: vscode.ExtensionContext,
  result: AstResult,
  detailsPanel: vscode.WebviewPanel
) {
  const scanId = getFromState(context, constants.scanIdKey)?.id;
  const cxPath = vscode.Uri.joinPath(
    context.extensionUri,
    path.join("media", "icon.png")
  );
  if (scanId) {
    if (AstResult.checkType(result) === constants.sast) {
      const sastObj = result as SastAstResult;
      getBfl(scanId, sastObj.queryId, sastObj.multipleSastNode.getNodes(), logs)
        .then((index) => {
          detailsPanel?.webview.postMessage({
            command: "loadBfl",
            index: { index: index, logo: cxPath },
          });
        })
        .catch(() => {
          detailsPanel?.webview.postMessage({
            command: "loadBfl",
            index: { index: -1, logo: cxPath },
          });
        });
    }
  } else {
    logs.error(messages.scanIdUndefined);
  }
}
