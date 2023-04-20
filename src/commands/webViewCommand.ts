import path = require("path");
import * as vscode from "vscode";
import { getCodebashingLink } from "../codebashing/codebashing";
import { Logs } from "../models/logs";
import { AstResult } from "../models/results";
import { getLearnMore } from "../sast/learnMore";
import { triageSubmit } from "../sast/triage";
import { applyScaFix } from "../sca/scaFix";
import { commands } from "../utils/common/commands";
import { getChanges } from "../utils/utils";
import { AstDetailsDetached } from "../views/resultsView/astDetailsView";

export class WebViewCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  detailsPanel: vscode.WebviewPanel | undefined;
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.detailsPanel = undefined;
    this.logs = logs;
  }

  public registerNewDetails(): vscode.Disposable {
    return vscode.commands.registerCommand(
      commands.newDetails,
      async (result: AstResult, type?: string) => {
        const detailsDetachedView = new AstDetailsDetached(
          this.context.extensionUri,
          result,
          this.context,
          false,
          type
        );
        // Need to check if the detailsPanel is positioned in the rigth place
        if (
          this.detailsPanel?.viewColumn === 1 ||
          !this.detailsPanel?.viewColumn
        ) {
          this.detailsPanel?.dispose();
          this.detailsPanel = undefined;
          await vscode.commands.executeCommand(
            "workbench.action.splitEditorRight"
          );
          // Only keep the result details in the split
          await vscode.commands.executeCommand(
            "workbench.action.closeEditorsInGroup"
          );
        }
        this.detailsPanel?.dispose();
        this.detailsPanel = vscode.window.createWebviewPanel(
          "newDetails", // Identifies the type of the webview, internal id
          "(" + result.severity + ") " + result.label.replaceAll("_", " "), // Title of the detailsPanel displayed to the user
          vscode.ViewColumn.Two, // Show the results in a separated column
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.file(path.join(this.context.extensionPath, "media")),
            ],
          }
        );
        // Only allow one detail to be open
        this.detailsPanel.onDidDispose(
          () => {
            this.detailsPanel = undefined;
          },
          null,
          this.context.subscriptions
        );
        // detailsPanel set options
        this.detailsPanel.webview.options = {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(this.context.extensionPath, "media/")),
          ],
        };
        // detailsPanel set html content
        this.detailsPanel.webview.html =
          await detailsDetachedView.getDetailsWebviewContent(
            this.detailsPanel.webview
          );

        // Start to load the changes tab, gets called everytime a new sast details webview is opened
        if (result.type === "sast") {
          await getLearnMore(
            this.logs,
            this.context,
            result,
            this.detailsPanel
          );
        }
        if (result.type === "sast" || result.type === "kics") {
          await getChanges(this.logs, this.context, result, this.detailsPanel);
        }
        // Start to load the bfl, gets called everytime a new details webview is opened in a SAST result
        //result.sastNodes.length>0 && getResultsBfl(logs,context,result,detailsPanel);
        // Comunication between webview and extension
        this.detailsPanel.webview.onDidReceiveMessage(async (data) => {
          switch (data.command) {
            // Catch open file message to open and view the result entry
            case "showFile":
              await detailsDetachedView.loadDecorations(
                data.path,
                data.line,
                data.column,
                data.length
              );
              break;
            // Catch submit message to open and view the result entry
            case "submit":
              if (this.detailsPanel) {
                await triageSubmit(
                  result,
                  this.context,
                  data,
                  this.logs,
                  this.detailsPanel,
                  detailsDetachedView
                );
                await getChanges(
                  this.logs,
                  this.context,
                  result,
                  this.detailsPanel
                );
              }
              break;
            // Catch get codebashing link and open a browser page
            case "codebashing":
              if (result.cweId) {
                await getCodebashingLink(
                  result.cweId,
                  result.language,
                  result.queryName,
                  this.logs
                );
              }
              break;
            case "references":
              vscode.env.openExternal(vscode.Uri.parse(data.link));
              break;
            case "scaFix":
              await applyScaFix(
                data.package,
                data.file,
                data.version,
                this.logs
              );
          }
        });
      }
    );
  }
}
