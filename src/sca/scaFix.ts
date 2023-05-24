import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { cx } from "../cx";
import * as path from "path";
import { messages } from "../utils/common/messages";

// Applying sca Fix to a specific package
export async function applyScaFix(
  packages: string,
  packageFile: string,
  version: string,
  logs: Logs
) {
  if (packageFile.length === 0 || version.length === 0) {
    logs.info(messages.scaNoUpgrade + packages);
  } else {
    try {
      logs.info(messages.scaUpgrading(packages, version));
      const filePackageObjectList = vscode.workspace.workspaceFolders;
      if (filePackageObjectList.length > 0) {
        await cx.scaRemediation(
          path.join(filePackageObjectList[0].uri.fsPath, packageFile),
          packages,
          version
        );
        logs.info(
          messages.scaUpgradingSuccess(packages, version)
        );
        vscode.window.showInformationMessage(
          messages.scaUpgradingSuccess(packages, version)
        );
      } else {
        logs.error(
          messages.scaNoFolder
        );
        vscode.window.showErrorMessage(
          messages.scaNoFolder
        );
      }
    } catch (error) {
      logs.error(error);
    }
  }
}
