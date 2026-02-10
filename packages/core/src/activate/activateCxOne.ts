/**
 * Checkmarx One Activation Logic
 * [CHECKMARX-ONE] Cloud-based scanning features
 */

import * as vscode from 'vscode';
import { AstResultsProvider } from '../views/resultsView/astResultsProvider';
import { AstResultsPromoProvider } from '../views/resultsView/astResultsPromoProvider';
import { constants } from '../utils/common/constants';
import { Logs } from '../models/logs';
import {
    addRealTimeSaveListener,
    executeCheckSettingsChange,
    gitExtensionListener,
    setScanButtonDefaultIfScanIsNotRunning,
} from '../utils/listener/listeners';
import { KicsProvider } from '../kics/kicsRealtimeProvider';
import { SCAResultsProvider } from '../views/scaView/scaResultsProvider';
import { ScanCommand } from '../commands/scanCommand';
import { ScanSCACommand } from '../commands/scanSCACommand';
import { KICSRealtimeCommand } from '../commands/kicsRealtimeCommand';
import { TreeCommand } from '../commands/treeCommand';
import { PickerCommand } from '../commands/pickerCommand';
import { CommonCommand } from '../commands/commonCommand';
import { GroupByCommand } from '../commands/groupByCommand';
import { FilterCommand } from '../commands/filterCommand';
import { WebViewCommand } from '../commands/webViewCommand';
import { WorkspaceListener } from '../utils/listener/workspaceListener';
import { DocAndFeedbackView } from '../views/docsAndFeedbackView/docAndFeedbackView';
import { DastResultsProvider } from '../views/dastView/dastResultsProvider';
import { isFeatureEnabled, DAST_ENABLED } from '../utils/common/featureFlags';
import { CxOneAssistProvider } from '../views/cxOneAssistView/cxOneAssistProvider';
import { messages } from '../utils/common/messages';
import { commands } from '../utils/common/commandBuilder';
import { IgnoredView } from '../views/ignoredView/ignoredView';
import { AuthService } from '../services/authService';
import { ScannerRegistry } from '../realtimeScanners/scanners/scannerRegistry';
import { ConfigurationManager } from '../realtimeScanners/configuration/configurationManager';
import { CopilotChatCommand } from '../commands/openAIChatCommand';
import { CxCodeActionProvider } from '../realtimeScanners/scanners/CxCodeActionProvider';
import { OssScannerCommand } from '../realtimeScanners/scanners/oss/ossScannerCommand';
import { SecretsScannerCommand } from '../realtimeScanners/scanners/secrets/secretsScannerCommand';
import { IgnoreFileManager } from '../realtimeScanners/common/ignoreFileManager';
import { IacScannerCommand } from '../realtimeScanners/scanners/iac/iacScannerCommand';
import { AscaScannerCommand } from '../realtimeScanners/scanners/asca/ascaScannerCommand';
import { ContainersScannerCommand } from '../realtimeScanners/scanners/containers/containersScannerCommand';
import { DiagnosticCommand } from '../commands/diagnosticCommand';
import { DOC_LINKS } from '../constants/documentation';
import { cx } from '../cx';

/**
 * Activate Checkmarx One specific features
 *
 * This function mirrors the legacy monolithic extension.ts activate() logic,
 * but assumes core/shared initialization (cx, logs, auth, MCP injector) has
 * already been performed by activateCore().
 */
export async function activateCxOne(context: vscode.ExtensionContext, logs: Logs) {
    // Register docs & promo webviews
    registerAssistDocumentation(context);
    registerPromoResultsWebview(context, logs);
    registerScaPromoWebview(context, logs);

    // --- Setup grouped UI elements ---
    const {
        runScanStatusBar,
        runSCAScanStatusBar,
        kicsStatusBarItem,
        statusBarItem,
        ignoredStatusBarItem,
    } = await setupStatusBars(context, logs);

    const { ignoreFileManager, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner } =
        await setupRealtimeScanners(context, logs);

    await setScanButtonDefaultIfScanIsNotRunning(context);

    // Scans from IDE scanning commands
    const scanCommand = new ScanCommand(context, runScanStatusBar, logs);
    scanCommand.registerIdeScans();
    scanCommand.executePollScan();

    const kicsDiagnosticCollection = vscode.languages.createDiagnosticCollection(constants.extensionName);

    // Command to allow other components (e.g., auth webview) to clear KICS remediation diagnostics
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.clearKicsDiagnostics, async () => {
            if (await cx.isStandaloneEnabled(logs)) {
                kicsDiagnosticCollection.clear();
            }
        }),
    );

    const { kicsScanCommand } = setupKicsRealtime(context, logs, kicsStatusBarItem, kicsDiagnosticCollection);

    const diagnosticCollection = vscode.languages.createDiagnosticCollection(constants.extensionName);

    // Create listener for file saves for real time feedback
    addRealTimeSaveListener(context, logs);

    const filterCommand = new FilterCommand(context, logs);
    const groupByCommand = new GroupByCommand(context, logs);
    const astResultsProvider = new AstResultsProvider(
        context,
        logs,
        statusBarItem,
        diagnosticCollection,
        filterCommand,
        groupByCommand,
    );

    // Initialize filters state
    filterCommand
        .initializeFilters()
        .then(() => logs.info(messages.filtersInitialized));

    // Initialize group by state
    groupByCommand
        .initializeFilters()
        .then(() => logs.info(messages.groupByInitialized));

    // Workspace listener
    const workspaceListener: WorkspaceListener = new WorkspaceListener();
    setInterval(() => workspaceListener.listener(context, astResultsProvider), 500);

    // Results side tree creation
    vscode.window.registerTreeDataProvider(constants.treeName, astResultsProvider);

    const tree = vscode.window.createTreeView(constants.treeName, {
        treeDataProvider: astResultsProvider,
    });

    // Tree listener to open a webview in a new panel with results details
    tree.onDidChangeSelection((item) => {
        if (item.selection.length > 0) {
            if (!item.selection[0].contextValue && !item.selection[0].children) {
                // Open new details
                vscode.commands.executeCommand(commands.newDetails, item.selection[0].result);
            }
        }
    });

    // Hover provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            { scheme: 'file' },
            {
                provideHover() {
                    return undefined;
                },
            },
        ),
    );

    // Webview details panel to show result details on the side
    const webViewCommand = new WebViewCommand(context, logs, astResultsProvider);
    webViewCommand.registerGpt();
    webViewCommand.registerNewDetails();

    // Branch change listener
    await gitExtensionListener(context, logs);

    // SCA Auto Scanning view
    const scaResultsProvider = new SCAResultsProvider(context, logs, statusBarItem, diagnosticCollection);

    // Documentation & Feedback view
    const docAndFeedback = new DocAndFeedbackView();

    const docAndFeedbackTree = vscode.window.createTreeView(commands.docAndFeedback, {
        treeDataProvider: docAndFeedback,
    });

    docAndFeedbackTree.onDidChangeSelection((event) => {
        const selectedItem = event.selection[0];
        if (selectedItem) {
            const url = docAndFeedback.getUrl(selectedItem);
            if (url) {
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        }
    });

    // DAST Results view (feature flag controlled)
    const isDastEnabled = isFeatureEnabled(DAST_ENABLED);
    vscode.commands.executeCommand(commands.setContext, commands.isDastEnabled, isDastEnabled);

    if (isDastEnabled) {
        const dastResultsProvider = new DastResultsProvider();
        vscode.window.registerTreeDataProvider(constants.dastTreeName, dastResultsProvider);
        vscode.window.createTreeView(constants.dastTreeName, {
            treeDataProvider: dastResultsProvider,
        });
    }

    // SCA auto scanning commands register
    const scaScanCommand = new ScanSCACommand(context, runSCAScanStatusBar, scaResultsProvider, logs);
    scaScanCommand.registerScaScans();
    vscode.window.registerTreeDataProvider(constants.scaTreeName, scaResultsProvider);

    const scaTree = vscode.window.createTreeView(constants.scaTreeName, {
        treeDataProvider: scaResultsProvider,
    });

    scaTree.onDidChangeSelection(async (item) => {
        // NOTE: This mirrors the legacy implementation which used this.logs
        // inside the callback. We keep the behavior consistent.
        if (await cx.isStandaloneEnabled((scaScanCommand as any).logs)) {
            return;
        }
        if (item.selection.length > 0) {
            if (!item.selection[0].contextValue && !item.selection[0].children) {
                // Open new details
                vscode.commands.executeCommand(
                    commands.newDetails,
                    item.selection[0].result,
                    constants.realtime,
                );
            }
        }
    });

    // Problems panel link handler for open relevant info for SAST and SCA
    const diagnosticCommand = new DiagnosticCommand(
        context,
        logs,
        astResultsProvider,
        scaResultsProvider,
        tree,
        scaTree,
    );
    diagnosticCommand.registerOpenDetailsFromDiagnostic();

    // Register Settings
    const commonCommand = new CommonCommand(context, logs);
    commonCommand.registerSettings();
    kicsScanCommand.registerSettings();

    // Listening to settings changes
    commonCommand.executeCheckSettings();

    // Scan from IDE enablement
    await commonCommand.executeCheckScanEnabled();
    await commonCommand.executeCheckStandaloneEnabled();
    await commonCommand.executeCheckCxOneAssistEnabled();

    // SCA auto scanning enablement
    await commonCommand.executeCheckScaScanEnabled();

    // Execute command to listen to settings change
    await executeCheckSettingsChange(context, kicsStatusBarItem, logs);

    const treeCommand = new TreeCommand(context, astResultsProvider, scaResultsProvider, logs);

    // Register refresh sca and results Tree Command
    treeCommand.registerRefreshCommands();

    // Register clear sca and results tree Command
    treeCommand.registerClearCommands();

    // Register group Commands for UI and for command list
    groupByCommand.registerGroupBy();

    // Register Severity and state Filters Command for UI and for command list
    filterCommand.registerFilters();

    // Register pickers command
    const pickerCommand = new PickerCommand(context, logs, astResultsProvider);
    pickerCommand.registerPickerCommands();

    // Visual feedback on wrapper errors
    commonCommand.registerErrors();

    // Register Kics remediation command
    kicsScanCommand.registerKicsRemediation();

    // Refresh sca tree with start scan message
    scaResultsProvider.refreshData(constants.scaStartScan);

    // Authentication launcher
    registerAuthenticationLauncher(context, webViewCommand, logs);

    // Checkmarx One Assist view & its commands
    const cxOneAssistProvider = registerAssistView(context, ignoreFileManager, logs);
    registerAssistRelatedCommands(context, cxOneAssistProvider);

    // Initialize AI Suggestion Tracker for fix outcome monitoring
    const aiTrackingModule = await import("../aiTracking/AISuggestionTracker");
    aiTrackingModule.AISuggestionTracker.initialize(context, logs);

    const copilotChatCommand = new CopilotChatCommand(
        context,
        logs,
        ossScanner,
        secretScanner,
        iacScanner,
        ascaScanner,
        containersScanner,
    );

    // MCP settings injector is handled in activateCore; no need to register again here
    copilotChatCommand.registerCopilotChatCommand();

    const ignoredView = new IgnoredView(context);

    context.subscriptions.push(
        vscode.commands.registerCommand(commands.openIgnoredView, () => {
            ignoredView.show();
        }),
    );

    setupIgnoredStatusBar(context, logs, ignoreFileManager, ignoredStatusBarItem, cxOneAssistProvider);

    // Development/testing command - not exposed in package.json
    vscode.commands.registerCommand(commands.mockTokenTest, async () => {
        const authService = AuthService.getInstance(context);
        await authService.saveToken(context, 'FAKE_TOKEN_FROM_TEST');
        console.log('>> Mock token has been saved to secrets');
        await authService.validateAndUpdateState();
    });

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

// --- Helper functions (ported from legacy extension.ts) ---

async function setupStatusBars(context: vscode.ExtensionContext, logs: Logs) {
    const runScanStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    const runSCAScanStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    runSCAScanStatusBar.text = messages.scaStatusBarConnect;

    async function updateScaStatusBar() {
        const isStandalone = await cx.isStandaloneEnabled(logs);
        if (!isStandalone) {
            runSCAScanStatusBar.show();
        } else {
            runSCAScanStatusBar.hide();
        }
    }

    await updateScaStatusBar();

    context.subscriptions.push(
        vscode.commands.registerCommand(commands.refreshScaStatusBar, async () => {
            await updateScaStatusBar();
        }),
    );

    const kicsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    const ignoredStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);

    // Central refresh command for KICS status bar
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.refreshKicsStatusBar, async () => {
            const standalone = await cx.isStandaloneEnabled(logs);
            if (!standalone) {
                kicsStatusBarItem.show();
            } else {
                kicsStatusBarItem.hide();
            }
        }),
    );

    // Initial KICS status bar visibility
    await vscode.commands.executeCommand(commands.refreshKicsStatusBar);

    return {
        runScanStatusBar,
        runSCAScanStatusBar,
        kicsStatusBarItem,
        statusBarItem,
        ignoredStatusBarItem,
    };
}

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

        const ascaEffected = section(`${constants.getAscaRealtimeScanner()}.${constants.activateAscaRealtimeScanner}`);
        if (ascaEffected) {
            scannerRegistry.getScanner(constants.ascaRealtimeScannerEngineName)?.register();
            return;
        }

        const containersEffected = section(
            `${constants.getContainersRealtimeScanner()}.${constants.activateContainersRealtimeScanner}`,
        );
        if (containersEffected) {
            scannerRegistry.getScanner(constants.containersRealtimeScannerEngineName)?.register();
            return;
        }

        const iacEffected = section(`${constants.getIacRealtimeScanner()}.${constants.activateIacRealtimeScanner}`);
        if (iacEffected) {
            scannerRegistry.getScanner(constants.iacRealtimeScannerEngineName)?.register();
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

    context.subscriptions.push({ dispose: () => ignoreFileManager.dispose() });

    return { scannerRegistry, ignoreFileManager, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner };
}

function setupKicsRealtime(
    context: vscode.ExtensionContext,
    logs: Logs,
    kicsStatusBarItem: vscode.StatusBarItem,
    kicsDiagnosticCollection: vscode.DiagnosticCollection,
) {
    const kicsProvider = new KicsProvider(context, logs, kicsStatusBarItem, kicsDiagnosticCollection, [], []);
    const kicsScanCommand = new KICSRealtimeCommand(context, kicsProvider, logs);
    kicsScanCommand.registerKicsScans();
    return { kicsProvider, kicsScanCommand };
}

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

function registerAssistDocumentation(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.assistDocumentation, () => {
            vscode.env.openExternal(vscode.Uri.parse(DOC_LINKS.checkmarxOne));
        }),
    );
}

function registerPromoResultsWebview(context: vscode.ExtensionContext, logs: Logs) {
    const promoProvider = new AstResultsPromoProvider(context, logs);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(commands.astResultsPromo, promoProvider),
    );
    return promoProvider;
}

function registerScaPromoWebview(context: vscode.ExtensionContext, logs: Logs) {
    const promoProvider = new AstResultsPromoProvider(context, logs, true);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(commands.scaAutoScanPromo, promoProvider),
    );
    return promoProvider;
}

function registerAssistView(
    context: vscode.ExtensionContext,
    ignoreFileManager: IgnoreFileManager,
    logs: Logs,
) {
    const cxOneAssistProvider = new CxOneAssistProvider(context, ignoreFileManager, logs);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(commands.astCxOneAssist, cxOneAssistProvider),
    );
    return cxOneAssistProvider;
}

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

function registerAuthenticationLauncher(
    context: vscode.ExtensionContext,
    webViewCommand: WebViewCommand,
    logs: Logs,
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(commands.showAuth, async () => {
            // Dynamically import the Checkmarx-specific authentication webview
            // This avoids circular dependency issues since the checkmarx package depends on core
            try {
                // The authentication webview is now in the checkmarx extension package
                // We need to load it from the compiled output
                const checkmarxExtPath = context.extensionPath;
                const authWebviewPath = `${checkmarxExtPath}/out/webview/authenticationWebview`;
                const { AuthenticationWebview } = await import(authWebviewPath);
                AuthenticationWebview.show(context, webViewCommand, logs);
            } catch (error) {
                logs?.error?.(`Failed to load authentication webview: ${error}`);
                vscode.window.showErrorMessage('Failed to load authentication page. Please try again.');
            }
        }),
    );
}
