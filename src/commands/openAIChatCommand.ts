import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
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
import { RemediationFileManager, RemediationEntry } from "../realtimeScanners/common/remediationFileManager";
import { OssScannerService } from "../realtimeScanners/scanners/oss/ossScannerService";
import { SecretsScannerService } from "../realtimeScanners/scanners/secrets/secretsScannerService";
import { IacScannerService } from "../realtimeScanners/scanners/iac/iacScannerService";
import { AscaScannerService } from "../realtimeScanners/scanners/asca/ascaScannerService";
import { ContainersScannerService } from '../realtimeScanners/scanners/containers/containersScannerService';
import { cx } from "../cx";

interface PendingRemediation {
    item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData;
    originalCode: string;
    filePath: string;
    startLine: number;
    endLine: number;
    timestamp: number;
}


export class CopilotChatCommand {
    context: vscode.ExtensionContext;
    logs: Logs;
    private ossScanner: OssScannerService;
    private secretsScanner: SecretsScannerService;
    private iacScanner: IacScannerService;
    private ascaScanner: AscaScannerService;
    private containersScanner: ContainersScannerService;
    private pendingRemediations: Map<string, PendingRemediation> = new Map();

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

        // Set up document save listener for remediation tracking
        this.setupDocumentSaveListener();
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

    private async openChatWithPrompt(question: string): Promise<void> {

        if (isIDE(constants.cursorAgent)) {
            await this.handleCursorIDE(question);
            return;
        }

        if (isIDE(constants.windsurfAgent)) {
            await this.handleWindsurfIDE(question);
            return;
        }

        if (
            isIDE(constants.kiroAgent)) {
            await this.handleKiroIDE(question);
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
        try {
            await vscode.commands.executeCommand(constants.newCopilotChatOpenWithQueryCommand, { query: `${question}` });
        } catch (error) {
            if (error.message.includes(`command '${constants.newCopilotChatOpenWithQueryCommand}' not found`)) {
                await vscode.commands.executeCommand(constants.copilotChatOpenWithQueryCommand, { query: `${question}` });
            }

        }
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

                // Capture original code BEFORE opening AI chat for remediation tracking
                const captureResult = this.captureVulnerableCode(item);
                const key = `${item.filePath}:${captureResult.startLine}`;

                this.logs.info(`[Remediation] Capturing original code for: ${item.filePath}`);
                this.logs.info(`[Remediation] Lines: ${captureResult.startLine}-${captureResult.endLine}`);
                this.logs.info(`[Remediation] Code length: ${captureResult.code.length}`);

                this.pendingRemediations.set(key, {
                    item,
                    originalCode: captureResult.code,
                    filePath: item.filePath,
                    startLine: captureResult.startLine,
                    endLine: captureResult.endLine,
                    timestamp: Date.now()
                });

                this.logs.info(`[Remediation] Pending remediations now: ${this.pendingRemediations.size}`);

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
                        const line = isAscaHoverData(item) || isContainersHoverData(item) || isIacHoverData(item) || isSecretsHoverData(item) ? item.location.line : item.line;
                        question = `In ${item.filePath} line ${line} \n${question}`;
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

    /**
     * Set up listener for document saves to detect when fixes are applied
     */
    private setupDocumentSaveListener(): void {
        this.context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                const filePath = document.uri.fsPath;

                this.logs.info(`[Remediation] Document saved: ${filePath}`);
                this.logs.info(`[Remediation] Pending remediations count: ${this.pendingRemediations.size}`);

                // Check if we have pending remediations for this file
                for (const [key, pending] of this.pendingRemediations.entries()) {
                    this.logs.info(`[Remediation] Checking pending: ${pending.filePath} vs ${filePath}`);

                    // Normalize paths for comparison (handle Windows/Unix differences)
                    const normalizedPendingPath = pending.filePath.replace(/\\/g, '/').toLowerCase();
                    const normalizedFilePath = filePath.replace(/\\/g, '/').toLowerCase();

                    if (normalizedPendingPath === normalizedFilePath) {
                        this.logs.info(`[Remediation] Match found! Capturing fixed code...`);

                        // Capture fixed code
                        const fixedRange = new vscode.Range(pending.startLine, 0, pending.endLine, document.lineAt(pending.endLine).text.length);
                        const fixedCode = document.getText(fixedRange);

                        this.logs.info(`[Remediation] Original code length: ${pending.originalCode.length}, Fixed code length: ${fixedCode.length}`);

                        // Check if code actually changed
                        if (fixedCode !== pending.originalCode) {
                            this.logs.info(`[Remediation] Code changed! Tracking remediation...`);

                            // Track the remediation
                            await this.trackRemediation(pending.item, pending.originalCode, fixedCode);

                            // Remove from pending
                            this.pendingRemediations.delete(key);

                            this.logs.info(`[Remediation] Remediation tracked successfully!`);
                        } else {
                            this.logs.info(`[Remediation] Code unchanged, skipping...`);
                        }
                    }
                }
            })
        );
    }

    /**
     * Capture vulnerable code before fix
     */
    private captureVulnerableCode(item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData): { code: string, startLine: number, endLine: number } {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return { code: '', startLine: 0, endLine: 0 };
        }

        let startLine: number;
        let endLine: number;

        if (isSecretsHoverData(item) || isAscaHoverData(item) || isContainersHoverData(item) || isIacHoverData(item)) {
            startLine = item.location.line;
            endLine = item.location.line;
        } else {
            startLine = item.line;
            endLine = item.line;
        }

        // Capture a few lines of context
        const contextStart = Math.max(0, startLine - 2);
        const contextEnd = Math.min(editor.document.lineCount - 1, endLine + 2);

        const range = new vscode.Range(contextStart, 0, contextEnd, editor.document.lineAt(contextEnd).text.length);
        const code = editor.document.getText(range);

        return { code, startLine: contextStart, endLine: contextEnd };
    }

    /**
     * Track remediation in JSON file
     */
    private async trackRemediation(
        item: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData,
        originalCode: string,
        fixedCode: string
    ): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const remediationManager = RemediationFileManager.getInstance();
            remediationManager.initialize(workspaceFolder);

            // Determine vulnerability type
            let vulnerabilityType: 'oss' | 'secrets' | 'containers' | 'iac' | 'asca';
            let title: string;
            let severity: string;
            let description: string;
            let filePath: string;
            let startLine: number;
            let endLine: number;

            if (isSecretsHoverData(item)) {
                vulnerabilityType = 'secrets';
                title = item.title;
                severity = item.severity;
                description = item.description;
                filePath = item.filePath;
                startLine = item.location.line;
                endLine = item.location.line;
            } else if (isAscaHoverData(item)) {
                vulnerabilityType = 'asca';
                title = item.ruleName;
                severity = item.severity;
                description = item.description;
                filePath = item.filePath;
                startLine = item.location.line;
                endLine = item.location.line;
            } else if (isContainersHoverData(item)) {
                vulnerabilityType = 'containers';
                title = `${item.imageName}:${item.imageTag}`;
                severity = item.status;
                description = item.fileType;
                filePath = item.filePath;
                startLine = item.location.line;
                endLine = item.location.line;
            } else if (isIacHoverData(item)) {
                vulnerabilityType = 'iac';
                title = item.title;
                severity = item.severity;
                description = item.description;
                filePath = item.filePath;
                startLine = item.location.line;
                endLine = item.location.line;
            } else {
                vulnerabilityType = 'oss';
                title = `${item.packageName}@${item.version}`;
                severity = item.status;
                description = item.vulnerabilities?.[0]?.description || '';
                filePath = item.filePath;
                startLine = item.line;
                endLine = item.line;
            }

            // Detect AI method
            const fixMethod = this.detectAIMethod();

            // Create remediation entry
            const entry: RemediationEntry = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                vulnerabilityType,
                title,
                severity,
                description,
                filePath,
                startLine,
                endLine,
                originalCode,
                fixedCode,
                fixMethod,
                fixStrategy: 'ai-assisted',
                linesChanged: this.countChangedLines(originalCode, fixedCode),
                dateAdded: new Date().toISOString()
            };

            // Save to file
            this.logs.info(`[Remediation] Saving remediation entry: ${entry.id}`);
            this.logs.info(`[Remediation] Title: ${title}`);
            this.logs.info(`[Remediation] File: ${filePath}`);
            this.logs.info(`[Remediation] Type: ${vulnerabilityType}`);

            remediationManager.addRemediation(entry);

            this.logs.info(`[Remediation] ✅ Remediation tracked successfully: ${title} in ${filePath}`);

            // Trigger status bar refresh
            vscode.commands.executeCommand(commands.refreshRemediationStatusBar);
        } catch (error) {
            this.logs.error(`Failed to track remediation: ${error}`);
        }
    }

    /**
     * Detect which AI method is being used
     */
    private detectAIMethod(): 'copilot' | 'cursor' | 'windsurf' | 'kiro' | 'manual' {
        if (isIDE(constants.cursorAgent)) {
            return 'cursor';
        } else if (isIDE(constants.windsurfAgent)) {
            return 'windsurf';
        } else if (isIDE(constants.kiroAgent)) {
            return 'kiro';
        } else {
            return 'copilot';
        }
    }

    /**
     * Count changed lines between original and fixed code
     */
    private countChangedLines(original: string, fixed: string): number {
        const originalLines = original.split('\n');
        const fixedLines = fixed.split('\n');
        return Math.max(originalLines.length, fixedLines.length);
    }
}
