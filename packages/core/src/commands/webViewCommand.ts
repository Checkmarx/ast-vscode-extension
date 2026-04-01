import path = require("path");
import * as vscode from "vscode";
import { getCodebashingLink } from "../codebashing/codebashing";
import { Logs } from "../models/logs";
import { AstResult } from "../models/results";
import { getLearnMore } from "../sast/learnMore";
import { getChanges, triageSubmit } from "../utils/triage";
import { applyScaFix } from "../sca/scaFix";
import { commands } from "../utils/common/commandBuilder";
import { AstDetailsDetached } from "../views/resultsView/astDetailsView";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { messages } from "../utils/common/messages";
import { constants } from "../utils/common/constants";
import { GptView } from "../views/gptView/gptView";
import { Gpt } from "../gpt/gpt";
import * as os from "os";
import { GptResult } from "../models/gptResult";
import { cx } from "../cx";
import { MediaPathResolver } from "../utils/mediaPathResolver";

export class WebViewCommand {
  private thinkID: number;
  context: vscode.ExtensionContext;
  logs: Logs;
  detailsPanel: vscode.WebviewPanel | undefined;
  gptPanel: vscode.WebviewPanel | undefined;
  resultsProvider: AstResultsProvider;
  gpt: Gpt;
  conversationId: string;

  constructor(
    context: vscode.ExtensionContext,
    logs: Logs,
    resultsProvider: AstResultsProvider
  ) {
    this.context = context;
    this.detailsPanel = undefined;
    this.logs = logs;
    this.resultsProvider = resultsProvider;
    this.thinkID = 0;
    this.conversationId = "";
  }

  public removedetailsPanel() {
    if (this.detailsPanel) {
      this.detailsPanel?.dispose();
      this.detailsPanel = undefined;
    }
  }

  public registerNewDetails() {
    const newDetails = vscode.commands.registerCommand(
      commands.newDetails,
      async (result: AstResult, type?: string) => {
        const detailsDetachedView = new AstDetailsDetached(
          result,
          this.context,
          false,
          this.logs,
          type
        );
        // Need to check if the detailsPanel is positioned in the right place
        if (
          this.detailsPanel?.viewColumn === 1 ||
          !this.detailsPanel?.viewColumn
        ) {
          this.detailsPanel?.dispose();
          this.detailsPanel = undefined;
          await vscode.commands.executeCommand(messages.splitEditorRight);
          // Only keep the result details in the split
          await vscode.commands.executeCommand(messages.closeEditorGroup);
        }
        this.detailsPanel?.dispose();
        this.detailsPanel = vscode.window.createWebviewPanel(
          constants.webviewName, // Identifies the type of the webview, internal id
          "(" + result.severity + ") " + result.label.replaceAll("_", " "), // Title of the detailsPanel displayed to the user
          vscode.ViewColumn.Two, // Show the results in a separated column
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.joinPath(this.context.extensionUri, 'media'),
              vscode.Uri.file(MediaPathResolver.getCoreMediaPath()),
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
            vscode.Uri.joinPath(this.context.extensionUri, 'media'),
            vscode.Uri.file(MediaPathResolver.getCoreMediaPath()),
          ],
        };
        // detailsPanel set html content
        this.detailsPanel.webview.html =
          await detailsDetachedView.getDetailsWebviewContent(
            this.detailsPanel.webview,
            type
          );

        // Setup theme change listener for the webview
        detailsDetachedView.setupThemeChangeListener(this.detailsPanel.webview);
        // Dispose theme listener when panel is disposed
        this.detailsPanel.onDidDispose(() => {
          detailsDetachedView.disposeThemeListener();
        });

        // Start to load the changes tab, gets called everytime a new sast details webview is opened
        await this.loadAsyncTabsContent(result, detailsDetachedView);

        // The event is intended for loading data to the results of SAST, when returning to the plugin tab from another tab
        this.detailsPanel.onDidChangeViewState(async (e) => {
          if (e.webviewPanel.visible) {
            await this.loadAsyncTabsContent(result, detailsDetachedView);
          }
        });

        // Start to load the bfl, gets called everytime a new details webview is opened in a SAST result
        //result.sastNodes.length>0 && getResultsBfl(logs,context,result,detailsPanel);
        // Communication between webview and extension
        await this.handleMessages(result, detailsDetachedView);
      }
    );
    this.context.subscriptions.push(newDetails);
  }

  public registerGpt() {
    const gpt = vscode.commands.registerCommand(
      commands.gpt,
      async (result: GptResult, type?: string) => {
        let masked = undefined;
        try {
          masked = await cx.mask(result.filename);
          this.logs.info(
            `Masked Secrets by ${constants.aiSecurityChampion}: ` +
            (masked && masked.maskedSecrets
              ? masked.maskedSecrets.length
              : "0")
          );
        } catch (error) {
          this.logs.info(error);
        }

        const gptDetachedView = new GptView(
          result,
          this.context,
          false,
          type,
          masked
        );
        // Need to check if the detailsPanel is positioned in the right place
        if (
          this.gptPanel?.viewColumn === 1 ||
          this.gptPanel?.viewColumn === 2 ||
          !this.gptPanel?.viewColumn
        ) {
          this.gptPanel?.dispose();
          this.gptPanel = undefined;
          await vscode.commands.executeCommand(messages.splitEditorRight);
          // Only keep the result details in the split
          await vscode.commands.executeCommand(messages.closeEditorGroup);
        }
        this.gptPanel?.dispose();
        this.gptPanel = vscode.window.createWebviewPanel(
          constants.gptWebviewName, // Identifies the type of the webview, internal id
          `${constants.aiSecurityChampion}`,
          vscode.ViewColumn.Three, // Show the results in a separated column
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.joinPath(this.context.extensionUri, 'media'),
              vscode.Uri.file(MediaPathResolver.getCoreMediaPath()),
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
            vscode.Uri.joinPath(this.context.extensionUri, 'media'),
            vscode.Uri.file(MediaPathResolver.getCoreMediaPath()),
          ],
        };
        // gptPanel set html content
        this.gptPanel.webview.html =
          await gptDetachedView.getDetailsWebviewContent(this.gptPanel.webview);

        this.gpt = new Gpt(
          this.context,
          this.logs,
          this.gptPanel,
          gptDetachedView
        );
        await this.handleGptMessages();
      }
    );
    this.context.subscriptions.push(gpt);
  }

  private async loadAsyncTabsContent(result: AstResult, detailsDetachedView?: AstDetailsDetached) {
    if (result.type === constants.sast) {
      await getLearnMore(this.logs, this.context, result, this.detailsPanel);
    }
    if (result.type === constants.sast || result.type === constants.kics || result.type === constants.sca) {
      await getChanges(this.logs, this.context, result, this.detailsPanel, detailsDetachedView, this.resultsProvider);
    }
  }

  private async handleMessages(
    result: AstResult,
    detailsDetachedView: AstDetailsDetached
  ) {
    // Get the user information
    const userInfo = os.userInfo();
    // Access the username
    const username = userInfo.username;
    const gptResult = new GptResult(result, undefined);
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
              this.detailsPanel,
              detailsDetachedView,
              this.resultsProvider
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
          await applyScaFix(data.package, data.file, data.version, this.logs);
          break;
        case "gpt":
          this.logs.info(`Opening ${constants.aiSecurityChampion}`);
          vscode.commands.executeCommand(
            commands.gpt,
            new GptResult(result, undefined),
            constants.realtime
          );
          break;
        case "explainFile":
          this.logs.info(
            `${constants.aiSecurityChampion} : Can you explain this IaC file?`
          );
          await this.runGpt(
            "Can you explain this IaC file?",
            username,
            detailsDetachedView.getAskKicsUserIcon(),
            detailsDetachedView.getAskKicsIcon(),
            gptResult
          );
          break;
        case "explainResults":
          this.logs.info(
            `${constants.aiSecurityChampion} : Can you explain these results?`
          );
          await this.runGpt(
            "Can you explain these results?",
            username,
            detailsDetachedView.getAskKicsUserIcon(),
            detailsDetachedView.getAskKicsIcon(),
            gptResult
          );
          break;
        case "explainRemediations":
          this.logs.info(
            `${constants.aiSecurityChampion} : Can you offer a remediation suggestion?`
          );
          await this.runGpt(
            "Can you offer a remediation suggestion?",
            username,
            detailsDetachedView.getAskKicsUserIcon(),
            detailsDetachedView.getAskKicsIcon(),
            gptResult
          );
          break;
        case "userQuestion":
          this.logs.info(`${constants.aiSecurityChampion} : ` + data.question);
          this.detailsPanel.webview?.postMessage({
            command: "clearQuestion",
          });
          if (gptResult.resultID !== "") {
            await this.runGptSast(
              data.question,
              username,
              detailsDetachedView.getAskKicsUserIcon(),
              detailsDetachedView.getAskKicsIcon(),
              gptResult
            );
          } else {
            await this.runGpt(
              data.question,
              username,
              detailsDetachedView.getAskKicsUserIcon(),
              detailsDetachedView.getAskKicsIcon(),
              gptResult
            );
          }

          break;
        case "startSastChat":
          this.logs.info(`${constants.aiSecurityChampion} : Start Chat`);
          await this.startSastGpt(
            "Start chat",
            username,
            detailsDetachedView.getAskKicsIcon(),
            gptResult
          );
          break;
        case "openSettings":
          vscode.commands.executeCommand(
            messages.openSettings,
            constants.gptSettings
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
          this.logs.info(
            `${constants.aiSecurityChampion} : Can you explain this IaC file?`
          );
          await this.gpt.runGpt("Can you explain this IaC file?", username);
          break;
        case "explainResults":
          this.logs.info(
            `${constants.aiSecurityChampion} : Can you explain these results?`
          );
          await this.gpt.runGpt("Can you explain these results?", username);
          break;
        case "explainRemediations":
          this.logs.info(
            `${constants.aiSecurityChampion} : Can you offer a remediation suggestion?`
          );
          await this.gpt.runGpt(
            "Can you offer a remediation suggestion?",
            username
          );
          break;
        case "userQuestion":
          this.logs.info(`${constants.aiSecurityChampion} : ` + data.question);
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

  async runGpt(
    userMessage: string,
    user: string,
    userKicsIcon,
    kicsIcon,
    result
  ) {
    // TO DO: needs to be moved to gpt or make it generic
    // Update webview to show the user message
    this.detailsPanel.webview.postMessage({
      command: "userMessage",
      message: { message: userMessage, user: user },
      icon: userKicsIcon,
    });
    // disable all the buttons and inputs
    this.detailsPanel.webview.postMessage({
      command: "disable",
    });
    await this.sleep(1000);
    // Update webview to show gpt thinking
    this.detailsPanel.webview.postMessage({
      command: "thinking",
      thinkID: this.thinkID,
      icon: kicsIcon,
    });
    // Get response from gpt and show the response in the webview

    cx.runGpt(
      userMessage,
      result.filename,
      result.line,
      result.severity,
      result.vulnerabilityName
    )
      .then((messages) => {

        this.handleSystemNotFindPathError(messages[0].responses[0]);
        this.conversationId = messages[0].conversationId;
        // enable all the buttons and inputs
        this.detailsPanel?.webview.postMessage({
          command: "enable",
        });
        // send response message
        this.detailsPanel?.webview.postMessage({
          command: "response",
          message: {
            message: messages[0].responses,
            user: `${constants.aiSecurityChampion}`,
          },
          thinkID: this.thinkID,
          icon: kicsIcon,
        });
        this.thinkID += 1;
      })
      .catch((e: Error) => {
        // enable all the buttons and inputs
        this.detailsPanel?.webview.postMessage({
          command: "response",
          message: {
            message: e.message,
            user: `${constants.aiSecurityChampion}`,
          },
          thinkID: this.thinkID,
          icon: kicsIcon,
        });
      });
  }

  async runGptSast(
    userMessage: string,
    user: string,
    userKicsIcon,
    kicsIcon,
    result: GptResult
  ) {
    // Update webview to show the user message
    this.detailsPanel.webview.postMessage({
      command: "userMessage",
      message: { message: userMessage, user: user, thinkID: this.thinkID },
      icon: userKicsIcon,
    });
    // disable all the buttons and inputs
    this.detailsPanel.webview.postMessage({
      command: "disableSast",
    });
    await this.sleep(1000);
    // Update webview to show gpt thinking
    this.detailsPanel.webview.postMessage({
      command: "thinking",
      thinkID: this.thinkID,
      icon: "https://" + kicsIcon.authority + kicsIcon.path,
    });
    // Get response from gpt and show the response in the webview
    cx.runSastGpt(
      userMessage,
      result.filename,
      result.resultID,
      this.conversationId
    )
      .then((messages) => {
        this.handleSystemNotFindPathError(messages[0].responses[0]);

        this.conversationId = messages[0].conversationId;
        // enable all the buttons and inputs
        this.detailsPanel?.webview.postMessage({
          command: "enableSast",
        });
        // send response message
        this.detailsPanel?.webview.postMessage({
          command: "response",
          message: {
            message: messages[0].responses,
            user: `${constants.aiSecurityChampion}`,
          },
          thinkID: this.thinkID,
          icon: "https://" + kicsIcon.authority + kicsIcon.path,
        });
        this.thinkID += 1;
      })
      .catch((e: Error) => {
        // enable all the buttons and inputs
        this.detailsPanel?.webview.postMessage({
          command: "response",
          message: {
            message: e.message,
            user: `${constants.aiSecurityChampion}`,
          },
          thinkID: this.thinkID,
          icon: "https://" + kicsIcon.authority + kicsIcon.path,
        });
      });
  }

  async startSastGpt(
    userMessage: string,
    user: string,
    kicsIcon,
    result: GptResult
  ) {
    // TO DO: needs to be moved to gpt or make it generic
    // Update webview to show the input box, and gpt thinking
    this.detailsPanel.webview.postMessage({
      command: "showGptPanel",
      kicsIcon: "https://" + kicsIcon.authority + kicsIcon.path,
      username: user,
    });

    // disable all the buttons and inputs
    this.detailsPanel.webview.postMessage({
      command: "disableSast",
    });

    // Update webview to show gpt thinking
    this.detailsPanel.webview.postMessage({
      command: "thinking",
      thinkID: this.thinkID,
      icon: "https://" + kicsIcon.authority + kicsIcon.path,
    });

    // Get response from gpt and show the response in the webview

    cx.runSastGpt(userMessage, result.filename, result.resultID, "")
      .then((messages) => {
        this.handleSystemNotFindPathError(messages[0].responses[0]);
        this.conversationId = messages[0].conversationId;
        // enable all the buttons and inputs
        this.detailsPanel?.webview.postMessage({
          command: "enableSast",
        });
        // send response message
        this.detailsPanel?.webview.postMessage({
          command: "response",
          message: {
            message: messages[0].responses,
            user: `${constants.aiSecurityChampion}`,
          },
          thinkID: this.thinkID,
          icon: "https://" + kicsIcon.authority + kicsIcon.path,
        });
        this.thinkID += 1;
      })
      .catch((e: Error) => {
        // enable all the buttons and inputs
        this.detailsPanel?.webview.postMessage({
          command: "response",
          message: {
            message: e.message,
            user: `${constants.aiSecurityChampion}`,
          },
          thinkID: this.thinkID,
          icon: "https://" + kicsIcon.authority + kicsIcon.path,
        });
      });
  }

  handleSystemNotFindPathError(response: string): void {
    if (response.includes(constants.systemNotFindPathError)) {
      throw new Error(constants.gptFileNotInWorkspaceError);
    }
    else if (response.includes(constants.systemNotFindLineError)) {
      throw new Error(constants.gptFileChangedError);
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
