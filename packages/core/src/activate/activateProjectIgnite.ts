import * as vscode from 'vscode';
import { Logs } from '../models/logs';
import { constants } from '../utils/common/constants';
import { commands } from '../utils/common/commandBuilder';
import { cx } from '../cx';
import { CxOneAssistProvider } from '../views/cxOneAssistView/cxOneAssistProvider';
import { IgnoredView } from '../views/ignoredView/ignoredView';
import { ScannerRegistry } from '../realtimeScanners/scanners/scannerRegistry';
import { ConfigurationManager } from '../realtimeScanners/configuration/configurationManager';
import { CopilotChatCommand } from '../commands/openAIChatCommand';
import { CommonCommand } from '../commands/commonCommand';
import { CxCodeActionProvider } from '../realtimeScanners/scanners/CxCodeActionProvider';
import { DOC_LINKS } from '../constants/documentation';
import { IgnoreFileManager } from '../realtimeScanners/common/ignoreFileManager';
import { OssScannerCommand } from '../realtimeScanners/scanners/oss/ossScannerCommand';
import { SecretsScannerCommand } from '../realtimeScanners/scanners/secrets/secretsScannerCommand';
import { IacScannerCommand } from '../realtimeScanners/scanners/iac/iacScannerCommand';
import { AscaScannerCommand } from '../realtimeScanners/scanners/asca/ascaScannerCommand';
import { ContainersScannerCommand } from '../realtimeScanners/scanners/containers/containersScannerCommand';
import { WebViewCommand } from '../commands/webViewCommand';
import { AISuggestionTracker } from '../aiTracking/AISuggestionTracker';

/**
 * Activate Checkmarx Developer Assist specific features
 *
 * Features:
 * - ASCA (AI Secure Coding Assistant) - AI-powered code analysis
 * - OSS Realtime - Real-time open source scanning
 * - Secrets Detection - Real-time secrets scanning
 * - IaC Scanning - Infrastructure as Code scanning
 * - Containers Scanning - Container security scanning
 * - Checkmarx One Assist - AI-powered security assistance
 */
export async function activateProjectIgnite(context: vscode.ExtensionContext, logs: Logs) {
    console.log('[CHECKMARX-DEVELOPER-ASSIST] Activating Checkmarx Developer Assist features...');

    const ignoredStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    context.subscriptions.push(ignoredStatusBarItem);

    const { ignoreFileManager, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner } =
        await setupRealtimeScanners(context, logs);

    const webViewCommand = new WebViewCommand(context, logs, null as any);
    registerAuthenticationLauncher(context, webViewCommand, logs);

    const commonCommand = new CommonCommand(context, logs);
    commonCommand.registerSettings();

    commonCommand.executeCheckSettings();

    await commonCommand.executeCheckStandaloneEnabled();
    await commonCommand.executeCheckCxOneAssistEnabled();

    const cxOneAssistProvider = registerAssistView(context, ignoreFileManager, logs);
    registerAssistRelatedCommands(context, cxOneAssistProvider);

    const copilotChatCommand = new CopilotChatCommand(
        context,
        logs,
        ossScanner,
        secretScanner,
        iacScanner,
        ascaScanner,
        containersScanner,
    );
    copilotChatCommand.registerCopilotChatCommand();

    const ignoredView = new IgnoredView(context);
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.openIgnoredView, () => {
            ignoredView.show();
        }),
    );

    setupIgnoredStatusBar(context, logs, ignoreFileManager, ignoredStatusBarItem, cxOneAssistProvider);

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file' },
            new CxCodeActionProvider(),
            {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
            },
        ),
    );
}

// --- Helper functions ---

/**
 * Setup realtime scanners
 * [CHECKMARX-DEVELOPER-ASSIST]
 */
async function setupRealtimeScanners(context: vscode.ExtensionContext, logs: Logs) {
    const configManager = new ConfigurationManager();
    const scannerRegistry = new ScannerRegistry(context, logs, configManager);
    await scannerRegistry.activateAllScanners();

    const configListener = configManager.registerConfigChangeListener((section) => {
        const ossEffected = section(`${constants.getOssRealtimeScanner()}.${constants.activateOssRealtimeScanner}`);
        if (ossEffected) {
            scannerRegistry.getScanner(constants.ossRealtimeScannerEngineName)?.register();
            return;
        }
        const secretsEffected = section(`${constants.getSecretsScanner()}.${constants.activateSecretsScanner}`);
        if (secretsEffected) {
            scannerRegistry.getScanner(constants.secretsScannerEngineName)?.register();
            return;
        }
        const iacEffected = section(`${constants.getIacRealtimeScanner()}.${constants.activateIacRealtimeScanner}`);
        if (iacEffected) {
            scannerRegistry.getScanner(constants.iacRealtimeScannerEngineName)?.register();
            return;
        }
        const ascaEffected = section(`${constants.getAscaRealtimeScanner()}.${constants.activateAscaRealtimeScanner}`);
        if (ascaEffected) {
            scannerRegistry.getScanner(constants.ascaRealtimeScannerEngineName)?.register();
            return;
        }
        const containersEffected = section(`${constants.getContainersRealtimeScanner()}.${constants.activateContainersRealtimeScanner}`);
        if (containersEffected) {
            scannerRegistry.getScanner(constants.containersRealtimeScannerEngineName)?.register();
            return;
        }
    });

    context.subscriptions.push(configListener);

    const ignoreFileManager = IgnoreFileManager.getInstance();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        ignoreFileManager.initialize(workspaceFolder);
    }

    const ossCommand = scannerRegistry.getScanner(constants.ossRealtimeScannerEngineName) as OssScannerCommand;
    const ossScanner = ossCommand.getScannerService();

    const secretCommand = scannerRegistry.getScanner(
        constants.secretsScannerEngineName,
    ) as SecretsScannerCommand;
    const secretScanner = secretCommand.getScannerService();

    const iacCommand = scannerRegistry.getScanner(constants.iacRealtimeScannerEngineName) as IacScannerCommand;
    const iacScanner = iacCommand.getScannerService();

    const ascaCommand = scannerRegistry.getScanner(constants.ascaRealtimeScannerEngineName) as AscaScannerCommand;
    const ascaScanner = ascaCommand.getScannerService();
 
    const containersCommand = scannerRegistry.getScanner(
        constants.containersRealtimeScannerEngineName,
    ) as ContainersScannerCommand;
    const containersScanner = containersCommand.getScannerService();

    ignoreFileManager.setOssScannerService(ossScanner);
    ignoreFileManager.setSecretsScannerService(secretScanner);
    ignoreFileManager.setIacScannerService(iacScanner);
    ignoreFileManager.setAscaScannerService(ascaScanner);
    ignoreFileManager.setContainersScannerService(containersScanner);

    const aiTracker = AISuggestionTracker.getInstance(context, logs);
    aiTracker.setAscaScanner(ascaScanner);
    aiTracker.setSecretsScanner(secretScanner);
    aiTracker.setIacScanner(iacScanner);
    aiTracker.setOssScanner(ossScanner);
    aiTracker.setContainersScanner(containersScanner);
    context.subscriptions.push({ dispose: () => ignoreFileManager.dispose() });

    return { ignoreFileManager, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner };
}

/**
 * Register Checkmarx Developer Assist view
 * [CHECKMARX-DEVELOPER-ASSIST]
 */
function registerAssistView(context: vscode.ExtensionContext, ignoreFileManager: IgnoreFileManager, logs: Logs) {
    const cxOneAssistProvider = new CxOneAssistProvider(context, ignoreFileManager, logs);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(commands.astCxDevAssist, cxOneAssistProvider),
    );
    return cxOneAssistProvider;
}

/**
 * Register assist related commands
 * [CHECKMARX-DEVELOPER-ASSIST]
 */
function registerAssistRelatedCommands(
    context: vscode.ExtensionContext,
    cxOneAssistProvider: CxOneAssistProvider,
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.updateCxOneAssist, async () => {
            await cxOneAssistProvider.onAuthenticationChanged();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(commands.authentication, () => {
            vscode.commands.executeCommand(commands.showAuth);
        }),
    );

    // Register assistDocumentation command
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.assistDocumentation, () => {
            vscode.env.openExternal(vscode.Uri.parse(DOC_LINKS.devAssist));
        }),
    );
}

/**
 * Setup ignored status bar
 * [CHECKMARX-DEVELOPER-ASSIST]
 */
function setupIgnoredStatusBar(
    context: vscode.ExtensionContext,
    logs: Logs,
    ignoreFileManager: IgnoreFileManager,
    ignoredStatusBarItem: vscode.StatusBarItem,
    cxOneAssistProvider: CxOneAssistProvider,
) {
    async function updateIgnoredStatusBar() {
        if (
            (await cx.isValidConfiguration()) &&
            ((await cx.isCxOneAssistEnabled(logs)) || (await cx.isStandaloneEnabled(logs)))
        ) {
            const count = ignoreFileManager.getIgnoredPackagesCount();
            const hasIgnoreFile = ignoreFileManager.hasIgnoreFile();
            if (hasIgnoreFile) {
                ignoredStatusBarItem.text = `$(circle-slash) ${count}`;
                ignoredStatusBarItem.tooltip =
                    count > 0
                        ? `${count} ignored vulnerabilities - Click to view`
                        : `No ignored vulnerabilities - Click to view`;
                ignoredStatusBarItem.command = commands.openIgnoredView;
                ignoredStatusBarItem.show();
            } else {
                ignoredStatusBarItem.hide();
            }
            cxOneAssistProvider.updateWebviewContent();
        } else {
            ignoredStatusBarItem.hide();
        }
    }

    context.subscriptions.push(
        vscode.commands.registerCommand(commands.refreshIgnoredStatusBar, async () => {
            await updateIgnoredStatusBar();
        }),
    );

    ignoreFileManager.setStatusBarUpdateCallback(updateIgnoredStatusBar);
    updateIgnoredStatusBar();

    return { updateIgnoredStatusBar };
}

/**
 * Register authentication launcher webview
 * [CHECKMARX-DEVELOPER-ASSIST]
 */
function registerAuthenticationLauncher(
    context: vscode.ExtensionContext,
    webViewCommand: WebViewCommand,
    logs: Logs,
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.showAuth, async () => {
            try {
                const projectIgniteExtPath = context.extensionPath;
                const authWebviewPath = `${projectIgniteExtPath}/out/webview/authenticationWebview`;
                const { AuthenticationWebview } = await import(authWebviewPath);
                AuthenticationWebview.show(context, webViewCommand, logs);
            } catch (error) {
                logs?.error?.(`Failed to load authentication webview: ${error}`);
                vscode.window.showErrorMessage('Failed to load authentication page. Please try again.');
            }
        }),
    );
}

