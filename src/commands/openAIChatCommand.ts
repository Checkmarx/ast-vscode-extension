import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
import { constants, Platform } from "../utils/common/constants";
import { spawn } from "child_process";
import { isCursorIDE, isSecretsHoverData, getWorkspaceFolder, getInitializedIgnoreManager, findAndIgnoreMatchingPackages, rescanFiles } from "../utils/utils";
import { HoverData, SecretsHoverData, IScannerService } from "../realtimeScanners/common/types";
import {
    SCA_EXPLANATION_PROMPT,
    SCA_REMEDIATION_PROMPT,
    SECRET_REMEDIATION_PROMPT,
    SECRETS_EXPLANATION_PROMPT
} from "../realtimeScanners/scanners/prompts";
import { IgnoreFileManager } from "../realtimeScanners/common/ignoreFileManager";
import { OssScannerService } from "../realtimeScanners/scanners/oss/ossScannerService";

export class CopilotChatCommand {
    context: vscode.ExtensionContext;
    logs: Logs;
    scannerService: IScannerService;

    constructor(context: vscode.ExtensionContext, logs: Logs, scannerService: IScannerService) {
        this.context = context;
        this.logs = logs;
        this.scannerService = scannerService;
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
        await vscode.commands.executeCommand(constants.copilotNewChatOpen);
        await vscode.commands.executeCommand(constants.copilotChatOpenWithQueryCommand, { query: `${question}` });
    }




    public registerCopilotChatCommand() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.openAIChat, async (item: HoverData | SecretsHoverData) => {
                let question = '';
                if (isSecretsHoverData(item)) {
                    question = SECRET_REMEDIATION_PROMPT(item.title, item.description, item.severity);
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
            vscode.commands.registerCommand(commands.viewDetails, async (item: HoverData) => {
                let question = '';

                if (isSecretsHoverData(item)) {
                    question = SECRETS_EXPLANATION_PROMPT(item.title, item.description, item.severity);
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

        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.ignorePackage, async (item: HoverData) => {
                try {
                    const workspaceFolder = getWorkspaceFolder(item.filePath);
                    if (!workspaceFolder) {
                        vscode.window.showErrorMessage("No workspace folder found.");
                        return;
                    }

                    const ignoreManager = IgnoreFileManager.getInstance();
                    ignoreManager.initialize(workspaceFolder);
                    ignoreManager.addIgnoredEntry({
                        packageManager: item.packageManager,
                        packageName: item.packageName,
                        packageVersion: item.version,
                        filePath: item.filePath
                    });

                    vscode.window.showInformationMessage(`Package ${item.packageName}@${item.version} ignored successfully.`);
                } catch (err) {
                    this.logs.error(`Failed to ignore package: ${err}`);
                    vscode.window.showErrorMessage(`Failed to ignore package: ${err}`);
                }

                const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === item.filePath)
                    ?? await vscode.workspace.openTextDocument(item.filePath);
                const scanner = this.scannerService as OssScannerService;
                if (scanner.shouldScanFile(document)) {
                    await scanner.scan(document, this.logs);
                }
            })
        );



        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.IgnoreAll, async (item: HoverData) => {
                try {
                    const workspaceFolder = getWorkspaceFolder(item.filePath);
                    const ignoreManager = getInitializedIgnoreManager(workspaceFolder);
                    const scanner = this.scannerService as OssScannerService;

                    const affectedFiles = findAndIgnoreMatchingPackages(item, scanner, ignoreManager);
                    await rescanFiles(affectedFiles, scanner, this.logs);

                    vscode.window.showInformationMessage(
                        `Ignored ${item.packageName}@${item.version} in ${affectedFiles.size} files.`
                    );
                } catch (err) {
                    this.logs.error(`Failed to ignore all: ${err}`);
                    vscode.window.showErrorMessage(`Failed to ignore all: ${err}`);
                }
            })
        );

    }
}
