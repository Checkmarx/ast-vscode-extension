import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
import { constants } from "../utils/common/constants";
import { spawn } from "child_process";
import { isCursorIDE } from "../utils/utils";
import { HoverData } from "../realtimeScanners/common/types";

enum Platform {
    WINDOWS = 'win32',
    MAC = 'darwin',
    LINUX = 'linux'
}

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

            await vscode.commands.executeCommand("composer.closeComposerTab");

            await vscode.env.clipboard.writeText(question);

            await vscode.commands.executeCommand("composer.newAgentChat");
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
        await vscode.commands.executeCommand(constants.copilotNewChatOpenWithQueryCommand);
        await vscode.commands.executeCommand(constants.copilotChatOpenWithQueryCommand, { query: `${question}` })
    }

    public registerCopilotChatCommand() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.openAIChat, async (item: HoverData) => {
                const question = `You are the Checkmarx Security Assistant for npm; target dependency ${item.packageName} @ ${item.version}. Invoke the internal AlternativePackageFinder, which returns JSON objects (action, package, version, reason). \nIf the result contains exactly one object whose action is "upgrade," pin that version in package.json (never touch package-lock.json), \nupdate first-party code as described below, then output a summary formatted as a bullet list (each line starts with "-"): "Upgraded ${item.packageName} to <version> – <reason>", "Files updated: <count>", "Remaining TODOs: <count>", "Build status: <PASS|FAIL>". \nOtherwise, show one interactive prompt that lists every remediation path as a bullet list where each line is "- <Action>: <package>@<version> – <reason>" (Action is "Upgrade" or "Replace"),\nfollowed by the sentence "Please select the option you would like me to apply." and wait for the user's choice. \nAfter a choice, pin the selected version in package.json, scan first-party source code (ignore node_modules), \nupdate every require/import of the old package, adapt API usage, insert clear TODO comments where manual edits are needed, \nrun offline compile or type checks, and silently patch first-party code until the build passes. \nThen print a final summary, formatted as a bullet list: "Fix applied: <chosen fix>", "Files updated: <count>", "Remaining TODOs: <count>", "Build status: <PASS|FAIL>". \nAlways abort and warn if no safe option exists or malicious indicators persist. Every message and summary must explicitly state that it is provided by the Checkmarx Security Assistant.`
                
                try {
                    await this.openChatWithPrompt(question);
                } catch (error) {
                    this.logs.error(`Error opening Chat: ${error}`);
                    vscode.window.showErrorMessage(`Failed to open Chat: ${error}`);
                }
            })
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.viewDetails, async (item: HoverData) => {
                let question = `Show all details about the package ${item.packageName}@${item.version}. Explain why it is flagged, what are the risks, and what remediation steps are recommended. Present the information in a clear, actionable way for a developer.`;
                item.vulnerabilities?.forEach(vuln => {
                    question += `\n\nVulnerability: ${vuln.cve}\nDescription: ${vuln.description}\nSeverity: ${vuln.severity}`;
                });
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
