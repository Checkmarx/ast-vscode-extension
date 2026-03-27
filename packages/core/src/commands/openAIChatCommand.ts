import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commandBuilder";
import { constants, Platform } from "../utils/common/constants";
import { spawn } from "child_process";
import {
    isIDE,
    isSecretsHoverData,
    getWorkspaceFolder,
    getInitializedIgnoreManager,
    findAndIgnoreMatchingPackages,
    rescanFiles,
    isContainersHoverData,
    isAscaHoverData,
    isIacHoverData,
    findAndIgnoreMatchingContainersInWorkspace,
    rescanContainerFiles
} from "../utils/utils";
import { HoverData, SecretsHoverData, AscaHoverData, ContainersHoverData, IacHoverData } from "../realtimeScanners/common/types";
import {
    SCA_EXPLANATION_PROMPT,
    SCA_REMEDIATION_PROMPT,
    SECRET_REMEDIATION_PROMPT,
    SECRETS_EXPLANATION_PROMPT,
    ASCA_REMEDIATION_PROMPT,
    ASCA_EXPLANATION_PROMPT,
    CONTAINERS_REMEDIATION_PROMPT,
    CONTAINERS_EXPLANATION_PROMPT,
    IAC_REMEDIATION_PROMPT,
    IAC_EXPLANATION_PROMPT
} from "../realtimeScanners/scanners/prompts";
import { IgnoreFileManager } from "../realtimeScanners/common/ignoreFileManager";
import { OssScannerService } from "../realtimeScanners/scanners/oss/ossScannerService";
import { SecretsScannerService } from "../realtimeScanners/scanners/secrets/secretsScannerService";
import { IacScannerService } from "../realtimeScanners/scanners/iac/iacScannerService";
import { AscaScannerService } from "../realtimeScanners/scanners/asca/ascaScannerService";
import { ContainersScannerService } from '../realtimeScanners/scanners/containers/containersScannerService';
import { cx } from "../cx";


export class CopilotChatCommand {
    context: vscode.ExtensionContext;
    logs: Logs;
    private ossScanner: OssScannerService;
    private secretsScanner: SecretsScannerService;
    private iacScanner: IacScannerService;
    private ascaScanner: AscaScannerService;
    private containersScanner: ContainersScannerService;
    private selectedAIAssistant: string = 'unknown';
    private selectedChatExtensionId: string = '';
    private selectedNewChatOpen: string = '';
    private selectedChatOpenWithQueryCommand: string = '';
    private newSelectedChatOpenWithQueryCommand: string = '';
    private selectedChatclipboardPasteActionCommand: string = '';
    private claudeExtensionActivated: boolean = false;


    constructor(
        context: vscode.ExtensionContext,
        logs: Logs,
        ossScanner: OssScannerService,
        secretsScanner: SecretsScannerService,
        iacScanner: IacScannerService,
        ascaScanner: AscaScannerService,
        containersScanner: ContainersScannerService
    ) {
        this.context = context;
        this.logs = logs;
        this.ossScanner = ossScanner;
        this.secretsScanner = secretsScanner;
        this.iacScanner = iacScanner;
        this.ascaScanner = ascaScanner;
        this.containersScanner = containersScanner;
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


    private pasteCmdWindows() {
        const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        `;

        spawn('powershell', ['-Command', script], { windowsHide: true });
    }

    private pasteCmdMac() {
        const script = `tell application "System Events" to keystroke "v" using command down`;
        spawn('osascript', ['-e', script]);
    }

    private async pasteCmd(): Promise<void> {
        const platform = process.platform as Platform;

        try {
            switch (platform) {
                case Platform.WINDOWS:
                    await this.pasteCmdWindows();
                    break;
                case Platform.MAC:
                    await this.pasteCmdMac();
                    break;
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
        } catch (error) {
            this.logs.error(`Failed to paste on platform ${platform}: ${error}`);
            throw error;
        }
    }

    private async restoreClipboard(originalClipboard: string, question: string): Promise<void> {
        try {
            const currentClipboard = await vscode.env.clipboard.readText();
            if (currentClipboard !== question) {
                await vscode.env.clipboard.writeText(originalClipboard);
            }
        } catch (clipboardError) {
            this.logs.error('Error restoring clipboard:' + clipboardError);
        }
    }

    private async executeWithClipboard(
        question: string,
        executeFunction: () => Promise<void>
    ): Promise<void> {
        try {
            const originalClipboard = await vscode.env.clipboard.readText();
            await vscode.env.clipboard.writeText(question);

            try {
                await executeFunction();
                await vscode.env.clipboard.writeText(originalClipboard);
            } catch (pasteErr) {
                this.logs.error(`Failed to programmatically paste: ${pasteErr}`);
                await this.restoreClipboard(originalClipboard, question);
            }
        } catch (err) {
            this.logs.error(`Error in IDE integration: ${err}`);
            vscode.window.showInformationMessage("Failed to open Chat.");
        }
    }

    private async handleCursorIDE(question: string): Promise<void> {
        const executeFunction = async () => {
            await vscode.commands.executeCommand("composer.closeComposerTab");
            await vscode.commands.executeCommand("composer.newAgentChat");
            await vscode.commands.executeCommand("aichat.newfollowupaction");
            await new Promise(resolve => setTimeout(resolve, 100));
            await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
            await this.pressEnter();
        };

        await this.executeWithClipboard(question, executeFunction);
    }

    private async handleWindsurfIDE(question: string): Promise<void> {
        const executeFunction = async () => {
            await vscode.commands.executeCommand("windsurf.prioritized.chat.openNewConversation");
            await new Promise(resolve => setTimeout(resolve, 300));
            await this.pasteCmd();
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.pressEnter();
            await new Promise(resolve => setTimeout(resolve, 1500));
        };

        await this.executeWithClipboard(question, executeFunction);
    }

    private async handleKiroIDE(question: string) {
        const executeFunction = async () => {
            await vscode.commands.executeCommand("kiroAgent.focusContinueInputWithoutClear");
            await new Promise(resolve => setTimeout(resolve, 100));
            await vscode.commands.executeCommand("kiroAgent.newSession");
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.pasteCmd();
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.pressEnter();
            await new Promise(resolve => setTimeout(resolve, 1500));
        };

        await this.executeWithClipboard(question, executeFunction);
    }

    private setSelectedAIAssistant(userPreferenceAIAssistant: string, copilotAvailable: boolean, claudeAvailable: boolean): string | null {
        let assistantType: string | null = null;
        this.logs.debug(`setSelectedAIAssistant - copilotAvailable: ${copilotAvailable}, claudeAvailable: ${claudeAvailable}`);

        const unavailableMap: Record<string, { extensionName: string; extensionId: string }> = {
            'Copilot': { extensionName: 'GitHub Copilot Chat', extensionId: constants.copilotChatExtensionId },
            'Claude': { extensionName: 'Claude Code Extension', extensionId: constants.claudeChatExtensionId },
        };

        const availabilityMap: Record<string, boolean> = {
            'Copilot': copilotAvailable,
            'Claude': claudeAvailable,
        };

        if (unavailableMap[userPreferenceAIAssistant] && availabilityMap[userPreferenceAIAssistant] === false) {
            const { extensionName, extensionId } = unavailableMap[userPreferenceAIAssistant];

            vscode.window.showErrorMessage(
                `${extensionName} is not installed. To use ${userPreferenceAIAssistant} for AI assistance, please install it and reload your IDE.`,
                `Install ${extensionName}`
            ).then(selection => {
                if (selection === `Install ${extensionName}`) {
                    vscode.commands.executeCommand('workbench.extensions.search', extensionId);
                }
            });
            this.logs.error(`[DEBUG] ${extensionName} (${extensionId}) not found. User cannot use ${userPreferenceAIAssistant}.`);
            return null;
        } else {
            this.logs.debug(`User preference from settings: ${userPreferenceAIAssistant}`);
            if (userPreferenceAIAssistant === 'Copilot' && copilotAvailable) {
                assistantType = constants.copilotAssistantName;
                this.selectedChatExtensionId = constants.copilotChatExtensionId;
                this.selectedNewChatOpen = constants.copilotNewChatOpen;
                this.selectedChatOpenWithQueryCommand = constants.copilotChatOpenWithQueryCommand;
                this.newSelectedChatOpenWithQueryCommand = constants.newCopilotChatOpenWithQueryCommand;
                this.logs.debug(`Selected Copilot (user preference)`);
            } else if (userPreferenceAIAssistant === 'Claude' && claudeAvailable) {
                assistantType = constants.claudeAssistantName;
                this.selectedChatExtensionId = constants.claudeChatExtensionId;
                this.selectedNewChatOpen = constants.claudeNewChatOpen;
                this.selectedChatOpenWithQueryCommand = constants.claudeChatOpenWithQueryCommand;
                this.newSelectedChatOpenWithQueryCommand = constants.newclaudeChatOpenWithQueryCommand;
                this.selectedChatclipboardPasteActionCommand = constants.claudeChatclipboardPasteActionCommand;
                this.logs.debug(`Selected Claude (user preference)`);
            }
        }

        this.logs.debug(`Final assistant type: ${assistantType}`);
        this.logs.debug(`Extension ID: ${this.selectedChatExtensionId}`);
        this.logs.debug(`New Chat Command: ${this.selectedNewChatOpen}`);
        this.logs.debug(`Chat Open With Query Command: ${this.selectedChatOpenWithQueryCommand}`);
        this.logs.debug(`New Chat Open With Query Command: ${this.newSelectedChatOpenWithQueryCommand}`);

        return assistantType;
    }

    private async openChatWithPrompt(question: string): Promise<void> {

        const isNonVsCodeIde = isIDE(constants.cursorAgent)
            || isIDE(constants.windsurfAgent)
            || isIDE(constants.windsurfNextAgent)
            || isIDE(constants.kiroAgent);

        if (isNonVsCodeIde) {
            const config = vscode.workspace.getConfiguration(constants.getAiAssistantConfigSection());
            const preferNative = config.get<boolean>('Prefer Native AI Assistant', true);

            if (preferNative) {
                // Prefer Native AI Assistant is enabled: use native IDE AI directly, ignore dropdown
                if (isIDE(constants.cursorAgent)) {
                    await this.handleCursorIDE(question);
                    return;
                }
                if (isIDE(constants.windsurfAgent) || isIDE(constants.windsurfNextAgent)) {
                    await this.handleWindsurfIDE(question);
                    return;
                }
                if (isIDE(constants.kiroAgent)) {
                    await this.handleKiroIDE(question);
                    return;
                }
            }

            // Prefer Native AI Assistant is unchecked: use dropdown value
            const userPreference = config.get<string>('AI Assistant', 'Copilot');
            const claudeExtension = vscode.extensions.getExtension(constants.claudeChatExtensionId);

            if (userPreference === 'Claude' && claudeExtension !== undefined) {
                this.selectedChatExtensionId = constants.claudeChatExtensionId;
                this.selectedNewChatOpen = constants.claudeNewChatOpen;
                this.selectedChatOpenWithQueryCommand = constants.claudeChatOpenWithQueryCommand;
                this.newSelectedChatOpenWithQueryCommand = constants.newclaudeChatOpenWithQueryCommand;
                this.selectedChatclipboardPasteActionCommand = constants.claudeChatclipboardPasteActionCommand;
                await this.sendPromptToChatUseCopyPass(question);
                return;
            }

            // Fallback: use native IDE AI
            if (isIDE(constants.cursorAgent)) {
                await this.handleCursorIDE(question);
                return;
            }
            if (isIDE(constants.windsurfAgent) || isIDE(constants.windsurfNextAgent)) {
                await this.handleWindsurfIDE(question);
                return;
            }
            if (isIDE(constants.kiroAgent)) {
                await this.handleKiroIDE(question);
                return;
            }
        }
        const copilotChatExtension = vscode.extensions.getExtension(constants.copilotChatExtensionId);
        const claudeChatExtension = vscode.extensions.getExtension(constants.claudeChatExtensionId);

        this.logs.debug(`Copilot Extension ID: ${constants.copilotChatExtensionId} - Found: ${copilotChatExtension}`);
        this.logs.debug(`Claude Extension ID: ${constants.claudeChatExtensionId} - Found: ${claudeChatExtension}`);

        const config = vscode.workspace.getConfiguration(constants.getAiAssistantConfigSection());

        const userPreferenceAIAssistant = config.get<string>('AI Assistant', 'Copilot');

        const selectedAssistant = this.setSelectedAIAssistant(
            userPreferenceAIAssistant,
            copilotChatExtension !== undefined,
            claudeChatExtension !== undefined
        );

        if (!selectedAssistant) {
            this.logs.error('No AI assistant could be selected');
            return;
        }
        try {
            if (selectedAssistant === constants.claudeAssistantName) {
                await this.sendPromptToChatUseCopyPass(question);
            } else {
                await vscode.commands.executeCommand(this.selectedNewChatOpen);
                await vscode.commands.executeCommand(this.newSelectedChatOpenWithQueryCommand, { query: `${question}` });
                this.logs.debug(`Successfully sent query with ${this.newSelectedChatOpenWithQueryCommand}`);
            }
        } catch (error) {
            if (error.message.includes(`command '${this.newSelectedChatOpenWithQueryCommand}' not found`)) {
                await vscode.commands.executeCommand(this.newSelectedChatOpenWithQueryCommand, { query: `${question}` });
            }
        }
    }

    //Send prompt via clipboard paste
    private async sendPromptToChatUseCopyPass(question: string) {
        const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

        const claudeExtension = vscode.extensions.getExtension(constants.claudeChatExtensionId);
        if (!claudeExtension.isActive) {
            await claudeExtension.activate();
            this.claudeExtensionActivated = false;
        }

        // Always open the sidebar (safe if already open, ensures it's visible when closed).
        // The sidebar webview needs time to initialize — use a longer delay on first activation.
        // Always use a consistent 800ms delay since the sidebar may have been closed between calls.
        await vscode.commands.executeCommand(constants.claudeSidebarOpen);
        await sleep(this.claudeExtensionActivated ? 600 : 900);
        this.claudeExtensionActivated = true;
        // Always start a new conversation so previous context is not reused
        await vscode.commands.executeCommand(constants.claudeNewChatOpen);
        await sleep(400);
        await vscode.env.clipboard.writeText(question);
        await sleep(200);
        await vscode.commands.executeCommand(this.selectedChatclipboardPasteActionCommand);
        await this.pressEnter();
    }

    private logUserEvent(EventType: string, subType: string, item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData): void {
        const isSecrets = isSecretsHoverData(item);
        const isIac = isIacHoverData(item);
        const isAsca = isAscaHoverData(item);
        const isContainers = isContainersHoverData(item);
        const engine = isSecrets ? constants.secretsScannerEngineName :
            isIac ? constants.iacRealtimeScannerEngineName :
                isAsca ? constants.ascaRealtimeScannerEngineName :
                    isContainers ? constants.containersRealtimeScannerEngineName :
                        constants.ossRealtimeScannerEngineName;
        let problemSeverity: string | undefined;
        if (isSecrets) {
            problemSeverity = item.severity;
        } else if (isAsca) {
            problemSeverity = item.severity;
        } else if (isIac) {
            problemSeverity = item.severity;
        } else {
            problemSeverity = (item as HoverData | ContainersHoverData).status;
        }
        cx.setUserEventDataForLogs(EventType, subType, engine, problemSeverity);
    }



    public registerCopilotChatCommand() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.openAIChat, async (item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData) => {
                this.logUserEvent("click", constants.openAIChat, item);

                const isSecrets = isSecretsHoverData(item);
                let question = '';
                if (isSecrets) {
                    question = SECRET_REMEDIATION_PROMPT(item.title, item.description, item.severity);
                } else if (isAscaHoverData(item)) {
                    question = ASCA_REMEDIATION_PROMPT(item.ruleName, item.description, item.severity, item.remediationAdvise, item.location.line);
                } else if (isContainersHoverData(item)) {
                    question = CONTAINERS_REMEDIATION_PROMPT(item.fileType, item.imageName, item.imageTag, item.status);
                } else if (isIacHoverData(item)) {
                    question = IAC_REMEDIATION_PROMPT(item.title, item.description, item.severity, item.fileType, item.expectedValue, item.actualValue, item.location.line);
                } else {
                    question = SCA_REMEDIATION_PROMPT(item.packageName, item.version, item.packageManager, item.status);
                }
                try {
                    if (isIDE(constants.kiroAgent)) {
                        let line = isAscaHoverData(item) || isContainersHoverData(item) || isIacHoverData(item) || isSecretsHoverData(item) ? item.location.line : item.line;
                        question = `In ${item.filePath} line ${line} \n${question}`
                    }
                    await this.openChatWithPrompt(question);
                } catch (error) {
                    this.logs.error(`Error opening Chat: ${error}`);
                    vscode.window.showErrorMessage(`Failed to open Chat: ${error}`);
                }
            })
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.viewDetails, async (item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData) => {
                this.logUserEvent("click", constants.viewDetails, item);

                const isSecrets = isSecretsHoverData(item);
                let question = '';

                if (isSecrets) {
                    question = SECRETS_EXPLANATION_PROMPT(item.title, item.description, item.severity);
                } else if (isAscaHoverData(item)) {
                    question = ASCA_EXPLANATION_PROMPT(item.ruleName, item.description, item.severity);
                } else if (isContainersHoverData(item)) {
                    question = CONTAINERS_EXPLANATION_PROMPT(item.fileType, item.imageName, item.imageTag, item.status);
                } else if (isIacHoverData(item)) {
                    question = IAC_EXPLANATION_PROMPT(item.title, item.description, item.severity, item.fileType, item.expectedValue, item.actualValue);
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
            vscode.commands.registerCommand(commands.ignorePackage, async (item: HoverData | SecretsHoverData | IacHoverData | AscaHoverData | ContainersHoverData) => {
                this.logUserEvent("click", constants.ignorePackage, item);


                try {
                    let workspaceFolder: vscode.WorkspaceFolder;

                    if (isIacHoverData(item)) {
                        const iacItem = item as IacHoverData & { originalFilePath?: string };
                        workspaceFolder = getWorkspaceFolder(iacItem.originalFilePath);
                    } else if (isContainersHoverData(item)) {
                        workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (!workspaceFolder) {
                            vscode.window.showErrorMessage("No workspace folder found.");
                            return;
                        }
                    } else {
                        workspaceFolder = getWorkspaceFolder(item.filePath);
                    }
                    if (!workspaceFolder) {
                        vscode.window.showErrorMessage("No workspace folder found.");
                        return;
                    }

                    const ignoreManager = IgnoreFileManager.getInstance();
                    ignoreManager.initialize(workspaceFolder);

                    if (isIacHoverData(item)) {
                        ignoreManager.addIgnoredEntryIac({
                            title: item.title || "",
                            similarityId: item.similarityId || "",
                            filePath: item.originalFilePath,
                            line: (item.location?.line || 0),
                            severity: item.severity,
                            description: item.description,
                            dateAdded: new Date().toISOString()
                        });
                        vscode.window.showInformationMessage(`IaC finding '${item.title}' ignored successfully.`);
                        const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === item.originalFilePath)
                            ?? await vscode.workspace.openTextDocument(item.originalFilePath);
                        if (this.iacScanner && this.iacScanner.scan) {
                            await this.iacScanner.scan(document, this.logs);
                        }
                        this.containersScanner.recomputeGutterForLine(document.uri, item.location?.line || 0);

                    }
                    else if (isSecretsHoverData(item)) {
                        ignoreManager.addIgnoredEntrySecrets({
                            title: item.title || "",
                            filePath: item.filePath,
                            line: (item.location?.line || 0) + 1,
                            severity: item.severity,
                            description: item.description,
                            dateAdded: new Date().toISOString(),
                            secretValue: item.secretValue
                        });

                        vscode.window.showInformationMessage(`Secret '${item.title}' ignored successfully.`);

                        const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === item.filePath)
                            ?? await vscode.workspace.openTextDocument(item.filePath);
                        const secretsScannerForScan = this.secretsScanner as SecretsScannerService;
                        await secretsScannerForScan.scan(document, this.logs);
                    }
                    else if (isAscaHoverData(item)) {
                        ignoreManager.addIgnoredEntryAsca({
                            ruleName: item.ruleName,
                            ruleId: item.ruleId!,
                            filePath: item.filePath || '',
                            line: (item.location?.line || 0),
                            severity: item.severity,
                            description: item.description,
                            dateAdded: new Date().toISOString()
                        });

                        vscode.window.showInformationMessage(`ASCA rule '${item.ruleName}' ignored successfully.`);

                        const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === (item.filePath || ''))
                            ?? await vscode.workspace.openTextDocument(item.filePath || '');
                        if (this.ascaScanner && this.ascaScanner.scan) {
                            await this.ascaScanner.scan(document, this.logs);
                        }
                    }
                    else if (isContainersHoverData(item)) {
                        ignoreManager.addIgnoredEntryContainers({
                            imageName: item.imageName,
                            imageTag: item.imageTag,
                            filePath: vscode.window.activeTextEditor?.document.uri.fsPath || '',
                            line: (item.location?.line || 0) + 1,
                            severity: item.status,
                            description: item.vulnerabilities && item.vulnerabilities.length > 0 ?
                                item.vulnerabilities.map(v => `${v.cve}: ${v.severity}`).join(', ') :
                                undefined,
                            dateAdded: new Date().toISOString()
                        });

                        vscode.window.showInformationMessage(`Container ${item.imageName}:${item.imageTag} ignored successfully.`);

                        const document = vscode.window.activeTextEditor?.document;
                        if (document && this.containersScanner && this.containersScanner.shouldScanFile(document)) {
                            await this.containersScanner.scan(document, this.logs);
                        }
                        if (document) {
                            this.iacScanner.recomputeGutterForLine(document.uri, item.location?.line || 0);
                        }

                    }
                    else {
                        ignoreManager.addIgnoredEntry({
                            packageManager: item.packageManager,
                            packageName: item.packageName,
                            packageVersion: item.version,
                            filePath: item.filePath,
                            line: item.line,
                            severity: item.status,
                            description: item.vulnerabilities ?
                                item.vulnerabilities.map(v => `${v.cve}: ${v.description}`).join(', ') :
                                undefined,
                            dateAdded: new Date().toISOString()
                        });
                        vscode.window.showInformationMessage(`Package ${item.packageName}@${item.version} ignored successfully.`);

                        const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === item.filePath)
                            ?? await vscode.workspace.openTextDocument(item.filePath);
                        const scanner = this.ossScanner as OssScannerService;
                        if (scanner.shouldScanFile(document)) {
                            await scanner.scan(document, this.logs);
                        }
                    }
                } catch (err) {
                    this.logs.error(`Failed to ignore: ${err}`);
                    vscode.window.showErrorMessage(`Failed to ignore: ${err}`);
                }
            })
        );



        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.ignoreAll, async (item: HoverData | ContainersHoverData) => {
                this.logUserEvent("click", constants.ignoreAll, item);
                try {
                    if (isContainersHoverData(item)) {
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (!workspaceFolder) {
                            vscode.window.showErrorMessage("No workspace folder found.");
                            return;
                        }

                        const ignoreManager = getInitializedIgnoreManager(workspaceFolder);
                        const scanner = this.containersScanner as ContainersScannerService;

                        const affectedFiles = await findAndIgnoreMatchingContainersInWorkspace(item, scanner, ignoreManager, this.logs);
                        await rescanContainerFiles(affectedFiles, scanner, this.logs);

                        vscode.window.showInformationMessage(
                            `Ignored ${item.imageName}@${item.imageTag} in ${affectedFiles.size} files.`
                        );
                    } else {
                        const ossItem = item as HoverData;
                        const workspaceFolder = getWorkspaceFolder(ossItem.filePath);
                        const ignoreManager = getInitializedIgnoreManager(workspaceFolder);
                        const scanner = this.ossScanner as OssScannerService;

                        const affectedFiles = findAndIgnoreMatchingPackages(ossItem, scanner, ignoreManager);
                        await rescanFiles(affectedFiles, scanner, this.logs);

                        vscode.window.showInformationMessage(
                            `Ignored ${ossItem.packageName}@${ossItem.version} in ${affectedFiles.size} files.`
                        );
                    }
                } catch (err) {
                    this.logs.error(`Failed to ignore all: ${err}`);
                    vscode.window.showErrorMessage(`Failed to ignore all: ${err}`);
                }
            })
        );

    }
}
