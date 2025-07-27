import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
import { constants, Platform } from "../utils/common/constants";
import { spawn } from "child_process";
import { isCursorIDE, isSecretsHoverData, isAscaHoverData, isContainersHoverData } from "../utils/utils";
import { HoverData, SecretsHoverData, AscaHoverData, ContainersHoverData } from "../realtimeScanners/common/types";
import {
    SCA_EXPLANATION_PROMPT,
    SCA_REMEDIATION_PROMPT,
    SECRET_REMEDIATION_PROMPT,
    SECRETS_EXPLANATION_PROMPT,
    ASCA_REMEDIATION_PROMPT,
    ASCA_EXPLANATION_PROMPT,
    CONTAINERS_REMEDIATION_PROMPT,
    CONTAINERS_EXPLANATION_PROMPT
} from "../realtimeScanners/scanners/prompts";
import { cx } from "../cx";


export class CopilotChatCommand {
    context: vscode.ExtensionContext;
    logs: Logs;

    constructor(context: vscode.ExtensionContext, logs: Logs) {
        this.context = context;
        this.logs = logs;
    }

    private pressEnterWindows() {
        const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        `;

        spawn('powershell', ['-Command', script], { windowsHide: true });
    }

    private pressEnterMac() {
        const script = `tell application "System Events" to key code 36`;
        spawn('osascript', ['-e', script]);
    }

    private async pressEnter(): Promise<void> {
        const platform = process.platform as Platform;

        try {
            switch (platform) {
                case Platform.WINDOWS:
                    await this.pressEnterWindows();
                    break;
                case Platform.MAC:
                    await this.pressEnterMac();
                    break;
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
        } catch (error) {
            this.logs.error(`Failed to press Enter on platform ${platform}: ${error}`);
            throw error;
        }
    }

    private async handleCursorIDE(question: string): Promise<void> {
        try {
            const originalClipboard = await vscode.env.clipboard.readText();

            // Closes any open Cursor composer tab to start a fresh new chat
            await vscode.commands.executeCommand("composer.closeComposerTab");

            await vscode.env.clipboard.writeText(question);
            // Opens a new chat tab with the Cursor AI agent
            await vscode.commands.executeCommand("composer.newAgentChat");
            // Triggers a new follow-up action inside the Cursor AI chat interface
            await vscode.commands.executeCommand("aichat.newfollowupaction");
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
                await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
                await this.pressEnter();

                await vscode.env.clipboard.writeText(originalClipboard);
            } catch (pasteErr) {
                this.logs.error(`Failed to programmatically paste: ${pasteErr}`);
                try {
                    const originalClipboard = await vscode.env.clipboard.readText();
                    if (originalClipboard !== question) {
                        await vscode.env.clipboard.writeText(originalClipboard);
                    }
                } catch (clipboardError) {
                    this.logs.error('Error restoring clipboard:' + clipboardError);
                }
            }
        } catch (err) {
            this.logs.error(`Error in Cursor IDE integration: ${err}`);
            vscode.window.showInformationMessage("Failed to open Cursor Chat.");
        }
    }

    private async openChatWithPrompt(question: string): Promise<void> {

        if (isCursorIDE()) {
            await this.handleCursorIDE(question);
            return;
        }
        const copilotChatExtension = vscode.extensions.getExtension(constants.copilotChatExtensionId);
        if (!copilotChatExtension) {
            const installOption = "Install Copilot Chat";
            const choice = await vscode.window.showErrorMessage(
                "GitHub Copilot Chat extension is not installed. Install it to use this feature.",
                installOption
            );
            if (choice === installOption) {
                await vscode.commands.executeCommand('workbench.extensions.search', `@id:${constants.copilotChatExtensionId}`);
            }
            return;
        }
        await vscode.commands.executeCommand(constants.copilotNewChatOpen);
        await vscode.commands.executeCommand(constants.copilotChatOpenWithQueryCommand, { query: `${question}` });
    }

    private logUserEvent(EventType: string, subType: string, item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData): void {
        const isSecrets = isSecretsHoverData(item);
        const engine = isSecrets ? constants.secretsScannerEngineName : constants.ossRealtimeScannerEngineName;
        let problemSeverity: string | undefined;
        if (isSecrets) {
            problemSeverity = item.severity;
        } else if (isAscaHoverData(item)) {
            problemSeverity = item.severity;
        } else {
            problemSeverity = (item as HoverData | ContainersHoverData).status;
        }
        cx.setUserEventDataForLogs(EventType, subType, engine, problemSeverity);
    }

    public registerCopilotChatCommand() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.openAIChat, async (item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData) => {
                this.logUserEvent("click", constants.openAIChat, item);

                const isSecrets = isSecretsHoverData(item);
                let question = '';
                if (isSecrets) {
                    question = SECRET_REMEDIATION_PROMPT(item.title, item.description, item.severity);
                } else if (isAscaHoverData(item)) {
                    question = ASCA_REMEDIATION_PROMPT(item.ruleName, item.description, item.severity, item.remediationAdvise);
                } else if (isContainersHoverData(item)) {
                    question = CONTAINERS_REMEDIATION_PROMPT(item.fileType, item.imageName, item.imageTag, item.status);
                } else {
                    question = SCA_REMEDIATION_PROMPT(item.packageName, item.version, item.packageManager, item.status);
                }
                try {
                    await this.openChatWithPrompt(question);
                } catch (error) {
                    this.logs.error(`Error opening Chat: ${error}`);
                    vscode.window.showErrorMessage(`Failed to open Chat: ${error}`);
                }
            })
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.viewDetails, async (item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData) => {
                this.logUserEvent("click", constants.viewDetails, item);

                const isSecrets = isSecretsHoverData(item);
                let question = '';

                if (isSecrets) {
                    question = SECRETS_EXPLANATION_PROMPT(item.title, item.description, item.severity);
                } else if (isAscaHoverData(item)) {
                    question = ASCA_EXPLANATION_PROMPT(item.ruleName, item.description, item.severity);
                } else if (isContainersHoverData(item)) {
                    question = CONTAINERS_EXPLANATION_PROMPT(item.fileType, item.imageName, item.imageTag, item.status);
                } else {
                    question = SCA_EXPLANATION_PROMPT(item.packageName, item.version, item.status, item.vulnerabilities);
                }
                try {
                    await this.openChatWithPrompt(question);
                } catch (error) {
                    this.logs.error(`Error opening Chat: ${error}`);
                    vscode.window.showErrorMessage(`Failed to open Chat: ${error}`);
                }
            })
        );
    }
}
