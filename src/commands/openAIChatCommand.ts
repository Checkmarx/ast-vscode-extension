import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
import { constants } from "../utils/common/constants";
import { AstResult } from "../models/results";
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

    // private pressEnterLinux() {
    //     spawn('xdotool', ['key', 'Return']);
    // }



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
            await vscode.env.clipboard.writeText(question);

            await vscode.commands.executeCommand("composer.closeComposerTab");

            await vscode.commands.executeCommand("composer.newAgentChat");
            await vscode.commands.executeCommand("aichat.newfollowupaction");
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
                await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
                this.pressEnter();
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

    public registerCopilotChatCommand() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.openAIChat, async (item: HoverData) => {
                try {
                    const question = `I found a suspicious or malicious package in my code: ${item.packageName}@${item.version}.
Please:
Search online for a secure and reliable replacement for this package.
Replace the package in the codebase accordingly (including package.json, import statements, etc.).
Refactor any affected code so that everything works with the new package.
Fix any compilation or runtime issues that result from this change.`

                    if (isCursorIDE()) {
                        await this.handleCursorIDE(question);
                        return;
                    }
                    const copilotChatExtension = vscode.extensions.getExtension(constants.copilotChatExtensionId);

                    if (!copilotChatExtension) {//??
                        // Copilot Chat not installed - show installation message
                        const installOption = "Install Copilot Chat";
                        const choice = await vscode.window.showErrorMessage(
                            "GitHub Copilot Chat extension is not installed. Install it to use this feature.",
                            installOption
                        );

                        if (choice === installOption) {
                            // Open the extension in marketplace
                            await vscode.commands.executeCommand('workbench.extensions.search', `@id:${constants.copilotChatExtensionId}`);
                        }
                        return;
                    }

                    await vscode.commands.executeCommand(constants.copilotNewChatOpenWithQueryCommand);
                    await vscode.commands.executeCommand(constants.copilotChatOpenWithQueryCommand,
                        { query: `${question}` }
                    );
                } catch (error) {
                    this.logs.error(`Error opening Chat: ${error}`);
                    vscode.window.showErrorMessage(`Failed to open Chat: ${error}`);
                }
            })
        );
    }
}
