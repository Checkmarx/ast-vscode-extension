import path = require("path");
import * as vscode from "vscode";
import { getCodebashingLink } from "../codebashing/codebashing";
import { Logs } from "../models/logs";
import { AstResult } from "../models/results";
import { getLearnMore } from "../sast/learnMore";
import { getChanges, triageSubmit } from "../utils/triage";
import { applyScaFix } from "../sca/scaFix";
import { commands } from "../utils/common/commands";
import { AstDetailsDetached } from "../views/resultsView/astDetailsView";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { messages } from "../utils/common/messages";
import { constants } from "../utils/common/constants";
import { GptView } from "../views/gptView/gptView";
import { Gpt } from "../gpt/gpt";
import * as os from 'os';
import { GptResult } from "../models/gptResult";

export class WebViewCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  detailsPanel: vscode.WebviewPanel | undefined;
  gptPanel: vscode.WebviewPanel | undefined;
  resultsProvider: AstResultsProvider;
  gpt: Gpt;
  constructor(context: vscode.ExtensionContext, logs: Logs, resultsProvider: AstResultsProvider) {
    this.context = context;
    this.detailsPanel = undefined;
    this.logs = logs;
    this.resultsProvider = resultsProvider;
  }

  public registerNewDetails() {
    const newDetails = vscode.commands.registerCommand(
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
            messages.splitEditorRight
          );
          // Only keep the result details in the split
          await vscode.commands.executeCommand(
            messages.closeEditorGroup
          );
        }
        this.detailsPanel?.dispose();
        this.detailsPanel = vscode.window.createWebviewPanel(
          constants.webviewName, // Identifies the type of the webview, internal id
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
        await this.loadAsyncTabsContent(result);
        // Start to load the bfl, gets called everytime a new details webview is opened in a SAST result
        //result.sastNodes.length>0 && getResultsBfl(logs,context,result,detailsPanel);
        // Comunication between webview and extension
        await this.handleMessages(result, detailsDetachedView);
      }
    );
    this.context.subscriptions.push(newDetails);
  }

  public registerGpt() {
    const gpt = vscode.commands.registerCommand(
      commands.gpt,
      async (result: GptResult, type?: string) => {
        const gptDetachedView = new GptView(
          this.context.extensionUri,
          result,
          this.context,
          false,
          type
        );
        // Need to check if the detailsPanel is positioned in the rigth place
        if (
          this.gptPanel?.viewColumn === 1 ||
          this.gptPanel?.viewColumn === 2 ||
          !this.gptPanel?.viewColumn
        ) {
          this.gptPanel?.dispose();
          this.gptPanel = undefined;
          await vscode.commands.executeCommand(
            messages.splitEditorRight
          );
          // Only keep the result details in the split
          await vscode.commands.executeCommand(
            messages.closeEditorGroup
          );
        }
        this.gptPanel?.dispose();
        this.gptPanel = vscode.window.createWebviewPanel(
          constants.gptWebviewName, // Identifies the type of the webview, internal id
          "AI Guided Remediation",
          vscode.ViewColumn.Three, // Show the results in a separated column
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.file(path.join(this.context.extensionPath, "media")),
            ],
          }
        );
        // Only allow one detail to be open
        this.gptPanel.onDidDispose(
          () => {
            this.gptPanel = undefined;
          },
          null,
          this.context.subscriptions
        );
        // gptPanel set options
        this.gptPanel.webview.options = {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(this.context.extensionPath, "media/")),
          ],
        };
        // gptPanel set html content
        this.gptPanel.webview.html =
          await gptDetachedView.getDetailsWebviewContent(
            this.gptPanel.webview
          );

        this.gpt = new Gpt(this.context, this.logs, this.gptPanel, gptDetachedView);
        await this.handleGptMessages();
      }
    );
    this.context.subscriptions.push(gpt);
  }

  private async loadAsyncTabsContent(result: AstResult) {
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
  }

  private async handleMessages(result: AstResult, detailsDetachedView: AstDetailsDetached) {
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
              detailsDetachedView,
              this.resultsProvider
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
          break;
        case "gpt":
          this.logs.info("Opening AI Guided Remediation");
          vscode.commands.executeCommand(
            commands.gpt,
            new GptResult(result, undefined),
            constants.realtime
          );
      }
    });
  }

  private async handleGptMessages() {
    // Get the user information
    const userInfo = os.userInfo();
    // Access the username
    const username = userInfo.username;
    // handle messages from webview
    this.gptPanel.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        //Catch open file message to open and view the result entry
        case "explainFile":
          this.logs.info("AI Guided Remediation : Can you explain this IaC file?");
          await this.gpt.runGpt("Can you explain this IaC file?", username);
          break;
        case "explainResults":
          this.logs.info("AI Guided Remediation : Can you explain these results?");
          await this.gpt.runGpt("Can you explain these results?", username);
          break;
        case "explainRemediations":
          this.logs.info("AI Guided Remediation : Can you offer a remediation suggestion?");
          await this.gpt.runGpt("Can you offer a remediation suggestion?", username);
          break;
        case "userQuestion":
          this.logs.info("AI Guided Remediation : " + data.question);
          this.gptPanel?.webview.postMessage({
            command: "clearQuestion",
          });
          await this.gpt.runGpt(data.question, username);
          break;
        case "openSettings":
          vscode.commands.executeCommand(
            messages.openSettings,
            constants.gptSettings
          );
      }
    });
  }
}
