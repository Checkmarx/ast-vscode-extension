/**
 * DevConnect Activation Logic
 * [PROJECT-IGNITE] Standalone/Realtime scanning features
 */

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
import { IgnoreFileManager } from '../realtimeScanners/common/ignoreFileManager';
import { OssScannerCommand } from '../realtimeScanners/scanners/oss/ossScannerCommand';
import { SecretsScannerCommand } from '../realtimeScanners/scanners/secrets/secretsScannerCommand';
import { IacScannerCommand } from '../realtimeScanners/scanners/iac/iacScannerCommand';
import { AscaScannerCommand } from '../realtimeScanners/scanners/asca/ascaScannerCommand';
import { ContainersScannerCommand } from '../realtimeScanners/scanners/containers/containersScannerCommand';
import { AuthenticationWebview } from '../webview/authenticationWebview';
import { WebViewCommand } from '../commands/webViewCommand';

/**
 * Activate DevConnect specific features
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
    console.log('[PROJECT-IGNITE] Activating DevConnect features...');

    // [PROJECT-IGNITE] Setup status bars
    const ignoredStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    context.subscriptions.push(ignoredStatusBarItem);

    // [PROJECT-IGNITE] Setup realtime scanners
    const { ignoreFileManager, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner } =
        await setupRealtimeScanners(context, logs);

    // [PROJECT-IGNITE] Authentication launcher webview
    const webViewCommand = new WebViewCommand(context, logs, null as any);
    registerAuthenticationLauncher(context, webViewCommand, logs);

    // [PROJECT-IGNITE] Register Settings
    const commonCommand = new CommonCommand(context, logs);
    commonCommand.registerSettings();

    // [PROJECT-IGNITE] Listening to settings changes
    commonCommand.executeCheckSettings();

    // [PROJECT-IGNITE] Standalone and Assist enablement
    await commonCommand.executeCheckStandaloneEnabled();
    await commonCommand.executeCheckCxOneAssistEnabled();

    // [PROJECT-IGNITE] Checkmarx One Assist view & its commands
    const cxOneAssistProvider = registerAssistView(context, ignoreFileManager, logs);
    registerAssistRelatedCommands(context, cxOneAssistProvider);

    // [PROJECT-IGNITE] Copilot Chat Command for AI-powered fixes
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

    // [PROJECT-IGNITE] Ignored View for managing ignored vulnerabilities
    const ignoredView = new IgnoredView(context);
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.openIgnoredView, () => {
            ignoredView.show();
        }),
    );

    // [PROJECT-IGNITE] Setup ignored status bar
    setupIgnoredStatusBar(context, logs, ignoreFileManager, ignoredStatusBarItem, cxOneAssistProvider);

    // [PROJECT-IGNITE] Register Code Actions Provider for quick fixes
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file' },
            new CxCodeActionProvider(),
            {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
            },
        ),
    );

    console.log('[PROJECT-IGNITE] DevConnect activation complete');
}

// --- Helper functions ---

/**
 * Setup realtime scanners
 * [PROJECT-IGNITE]
 */
async function setupRealtimeScanners(context: vscode.ExtensionContext, logs: Logs) {
    const configManager = new ConfigurationManager();
    const scannerRegistry = new ScannerRegistry(context, logs, configManager);
    await scannerRegistry.activateAllScanners();

    const configListener = configManager.registerConfigChangeListener((section) => {
        const ossEffected = section(`${constants.ossRealtimeScanner}.${constants.activateOssRealtimeScanner}`);
        if (ossEffected) {
            scannerRegistry.getScanner(constants.ossRealtimeScannerEngineName)?.register();
            return;
        }
        const secretsEffected = section(`${constants.secretsScanner}.${constants.activateSecretsScanner}`);
        if (secretsEffected) {
            scannerRegistry.getScanner(constants.secretsScannerEngineName)?.register();
            return;
        }
        const iacEffected = section(`${constants.iacRealtimeScanner}.${constants.activateIacRealtimeScanner}`);
        if (iacEffected) {
            scannerRegistry.getScanner(constants.iacRealtimeScannerEngineName)?.register();
            return;
        }
        const ascaEffected = section(`${constants.ascaRealtimeScanner}.${constants.activateAscaRealtimeScanner}`);
        if (ascaEffected) {
            scannerRegistry.getScanner(constants.ascaRealtimeScannerEngineName)?.register();
            return;
        }
        const containersEffected = section(`${constants.containersRealtimeScanner}.${constants.activateContainersRealtimeScanner}`);
        if (containersEffected) {
            scannerRegistry.getScanner(constants.containersRealtimeScannerEngineName)?.register();
            return;
        }
    });

    context.subscriptions.push(configListener);

    const ignoreFileManager = IgnoreFileManager.getInstance();

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

    return { ignoreFileManager, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner };
}

/**
 * Register Checkmarx One Assist view
 * [PROJECT-IGNITE]
 */
function registerAssistView(context: vscode.ExtensionContext, ignoreFileManager: IgnoreFileManager, logs: Logs) {
    const cxOneAssistProvider = new CxOneAssistProvider(context, ignoreFileManager, logs);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(commands.astCxOneAssist, cxOneAssistProvider),
    );
    return cxOneAssistProvider;
}

/**
 * Register assist related commands
 * [PROJECT-IGNITE]
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
}

/**
 * Setup ignored status bar
 * [PROJECT-IGNITE]
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
 * [PROJECT-IGNITE]
 */
function registerAuthenticationLauncher(
    context: vscode.ExtensionContext,
    webViewCommand: WebViewCommand,
    logs: Logs,
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.showAuth, () => {
            AuthenticationWebview.show(context, webViewCommand, logs);
        }),
    );
}

