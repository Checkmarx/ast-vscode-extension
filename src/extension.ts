import * as vscode from "vscode";
import {AstResultsProvider} from "./resultsView/ast_results_provider";
import {AstResult} from "./models/results";
import {getError} from "./utils/common/globalState";
import {
    CONFIRMED_FILTER,
    EXTENSION_FULL_NAME,
    EXTENSION_NAME,
    FILE_GROUP,
    HIGH_FILTER,
    IGNORED_FILTER,
    INFO_FILTER,
    IssueFilter,
    IssueLevel,
    LANGUAGE_GROUP,
    LOW_FILTER,
    MEDIUM_FILTER,
    NOT_EXPLOITABLE_FILTER,
    NOT_IGNORED_FILTER,
    PROPOSED_FILTER,
    QUERY_NAME_GROUP,
    SEVERITY_GROUP,
    STATE_GROUP,
    StateLevel,
    STATUS_GROUP,
    TO_VERIFY_FILTER,
    URGENT_FILTER,
    DEPENDENCY_GROUP
} from "./utils/common/constants";
import {Logs} from "./models/logs";
import * as path from "path";
import {multiStepInput} from "./resultsView/ast_multi_step_input";
import {AstDetailsDetached} from "./resultsView/ast_details_view";
import {branchPicker, projectPicker, scanInput, scanPicker} from "./resultsView/pickers";
import {filter, filterState, initializeFilters} from "./utils/filters";
import {group} from "./utils/group";
import {addOpenFolderListener, addRealTimeSaveListener, getBranchListener, WorkspaceListener} from "./utils/listeners";
import {getCodebashingLink} from "./utils/codebashing/codebashing";
import {triageSubmit} from "./utils/sast/triage";
import {REFRESH_SCA_TREE, REFRESH_TREE} from "./utils/common/commands";
import {getChanges} from "./utils/utils";
import {KicsProvider} from "./utils/kics/kics_provider";
import {applyScaFix} from "./utils/scaFix";
import {getLearnMore} from "./utils/sast/learnMore";
import {getAstConfiguration, isScanEnabled, isSCAScanEnabled} from "./utils/ast/ast";
import {cancelScan, createScan, pollForScanResult} from "./resultsView/create_scan_provider";
import { SCAResultsProvider } from "./scaView/sca_results_provider";
import { createSCAScan } from "./scaView/sca_create_scan_provider";

export async function activate(context: vscode.ExtensionContext) {
    // Create logs channel and make it visible
    const output = vscode.window.createOutputChannel(EXTENSION_FULL_NAME);
    const logs = new Logs(output);
    logs.show();
    logs.info("Checkmarx plugin is running");

    // Status bars for scans from IDE and SCA auto scanning
    const runScanStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    const runSCAScanStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    runSCAScanStatusBar.text = "$(check) Checkmarx sca";
    runSCAScanStatusBar.show();
    // Scans from IDE scanning commands
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.createScan`, async () => {
        await createScan(context, runScanStatusBar, logs);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.cancelScan`, async () => {
        await cancelScan(context, runScanStatusBar, logs);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.pollForScan`, async () => {
        await pollForScanResult(context, runScanStatusBar, logs);
    }));
    vscode.commands.executeCommand(`${EXTENSION_NAME}.pollForScan`);
    
    // SCA auto scanning commands
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.createSCAScan`, async () => {
        await createSCAScan(context, runSCAScanStatusBar, logs,scaResultsProvider);
    }));
    
    const kicsDiagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_NAME);
    const kicsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    const kicsProvider = new KicsProvider(context, logs, kicsStatusBarItem, kicsDiagnosticCollection, [], []);
    // kics auto scan  command
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.kicsRealtime`, async () => await kicsProvider.runKics()));

    const diagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_NAME);
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    
    // Cx One main results view
    // Create listener for file saves for real time feedback
    addRealTimeSaveListener(context, logs, kicsStatusBarItem);

    const astResultsProvider = new AstResultsProvider(
        context,
        logs,
        statusBarItem,
        kicsStatusBarItem,
        diagnosticCollection
    );

    // Syncing with AST everytime the extension gets opened
    astResultsProvider.openRefreshData().then(r => logs.info("Data refreshed and synced with AST platform"));
    // Initialize filters state
    initializeFilters(logs, context, astResultsProvider).then(() => logs.info("Filters initialized"));

    const workspaceListener: WorkspaceListener = new WorkspaceListener();
    setInterval(() => workspaceListener.listener(context, astResultsProvider), 500);

    // Results side tree creation
    vscode.window.registerTreeDataProvider(`astResults`, astResultsProvider);
    const tree = vscode.window.createTreeView("astResults", {treeDataProvider: astResultsProvider});

    tree.onDidChangeSelection((item) => {
        if (item.selection.length > 0) {
            if (!item.selection[0].contextValue && !item.selection[0].children) {
                // Open new details
                vscode.commands.executeCommand(
                    "ast-results.newDetails",
                    item.selection[0].result
                );
            }
        }
    });


    // Webview detailsPanel needs to be global in order to check if there was one open or not
    let detailsPanel: vscode.WebviewPanel | undefined = undefined;
    const newDetails = vscode.commands.registerCommand(
        `${EXTENSION_NAME}.newDetails`,
        async (result: AstResult,type?:string) => {
            var detailsDetachedView = new AstDetailsDetached(
                context.extensionUri,
                result,
                context,
                false,
                type
            );
            // Need to check if the detailsPanel is positioned in the rigth place
            if (detailsPanel?.viewColumn === 1 || !detailsPanel?.viewColumn) {
                detailsPanel?.dispose();
                detailsPanel = undefined;
                await vscode.commands.executeCommand(
                    "workbench.action.splitEditorRight"
                );
                // Only keep the result details in the split
                await vscode.commands.executeCommand(
                    "workbench.action.closeEditorsInGroup"
                );
            }
            detailsPanel?.dispose();
            detailsPanel = vscode.window.createWebviewPanel(
                "newDetails", // Identifies the type of the webview, internal id
                "(" + result.severity + ") " + result.label.replaceAll("_", " "), // Title of the detailsPanel displayed to the user
                vscode.ViewColumn.Two, // Show the results in a separated column
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, "media")
                        )
                    ],
                }
            );
            // Only allow one detail to be open
            detailsPanel.onDidDispose(
                () => {
                    detailsPanel = undefined;
                },
                null,
                context.subscriptions
            );
            // detailsPanel set options
            detailsPanel.webview.options = {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, "media/")),
                ],
            };
            // detailsPanel set html content
            detailsPanel.webview.html = await detailsDetachedView.getDetailsWebviewContent(
                detailsPanel.webview,
            );

            // Start to load the changes tab, gets called everytime a new sast details webview is opened
            if (result.type === "sast") {
                await getLearnMore(logs, context, result, detailsPanel);
            }
            if (result.type === "sast" || result.type === "kics") {
                await getChanges(logs, context, result, detailsPanel);
            }
            // Start to load the bfl, gets called everytime a new details webview is opened in a SAST result
            //result.sastNodes.length>0 && getResultsBfl(logs,context,result,detailsPanel);
            // Comunication between webview and extension
            detailsPanel.webview.onDidReceiveMessage(async data => {
                switch (data.command) {
                    // Catch open file message to open and view the result entry
                    case 'showFile':
                        await detailsDetachedView.loadDecorations(data.path, data.line, data.column, data.length);
                        break;
                    // Catch submit message to open and view the result entry
                    case 'submit':
                        await triageSubmit(result, context, data, logs, detailsPanel!, detailsDetachedView);
                        await getChanges(logs, context, result, detailsPanel!);
                        break;
                    // Catch get codebashing link and open a browser page
                    case 'codebashing':
                        await getCodebashingLink(result.cweId!, result.language, result.queryName, logs);
                        break;
                    case 'references':
                        vscode.env.openExternal(vscode.Uri.parse(data.link));
                        break;
                    case 'scaFix':
                        await applyScaFix(data.package, data.file, data.version, logs);
                }
            });
        }
    );
    context.subscriptions.push(newDetails);

    // Branch Listener
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension) {
        await gitExtension.activate();
        if (gitExtension && gitExtension.exports.enabled) {
            logs.info("Git Extension - Add branch.");
            context.subscriptions.push(await getBranchListener(context, logs));
        } else {
            logs.warn("Git Extension - Could not find active git extension in workspace.");
        }
    } else {
        logs.warn("Git extension - Could not find vscode.git installed.");
    }
    
    // SCA Auto Scanning view
    addOpenFolderListener(context, logs, kicsStatusBarItem);
    const scaResultsProvider = new SCAResultsProvider(
        logs,
        statusBarItem,
        diagnosticCollection,
    );
    scaResultsProvider.scaResults=[];
    vscode.window.registerTreeDataProvider(`scaAutoScan`, scaResultsProvider);
    const scaTree = vscode.window.createTreeView("scaAutoScan", {treeDataProvider: scaResultsProvider});
    scaTree.onDidChangeSelection((item) => {
        if (item.selection.length > 0) {
            if (!item.selection[0].contextValue && !item.selection[0].children) {
                // Open new details
                vscode.commands.executeCommand(
                    "ast-results.newDetails",
                    item.selection[0].result,
                    "realtime"
                );
            }
        }
    });
    scaResultsProvider.refreshData();
    // Settings
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.viewSettings`, () => {
            vscode.commands.executeCommand(
                "workbench.action.openSettings",
                `@ext:checkmarx.ast-results`
            );
        }
    ));

    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.viewKicsSaveSettings`, () => {
            vscode.commands.executeCommand(
                "workbench.action.openSettings",
                `Checkmarx KICS`,
            );
        }
    ));

    // Listening to settings changes
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isValidCredentials`, getAstConfiguration() ? true : false);
    // Scan from IDE enablement
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isScanEnabled`, await isScanEnabled(logs));
    // SCA auto scanning enablement
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isSCAScanEnabled`, await isSCAScanEnabled(logs));
    
    vscode.workspace.onDidChangeConfiguration(async (event) => {
        vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isValidCredentials`, getAstConfiguration() ? true : false);
        vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isScanEnabled`, await isScanEnabled(logs));
        const onSave = vscode.workspace.getConfiguration("CheckmarxKICS").get("Activate KICS Auto Scanning") as boolean;
        kicsStatusBarItem.text = onSave === true ? "$(check) Checkmarx kics" : "$(debug-disconnect) Checkmarx kics";
        await vscode.commands.executeCommand(REFRESH_TREE);
    });

    // Refresh Tree Commmand
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.refreshTree`, async () => await astResultsProvider.refreshData()));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.refreshSCATree`, async () => await scaResultsProvider.refreshData()));

    // Clear Command
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.clear`, async () => await astResultsProvider.clean()));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.clearSca`, async () => await scaResultsProvider.clean()));

    // Group Commands for UI
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByFile`, async () => await group(logs, context, astResultsProvider, IssueFilter.fileName, FILE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByLanguage`, async () => await group(logs, context, astResultsProvider, IssueFilter.language, LANGUAGE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupBySeverity`, async () => await group(logs, context, astResultsProvider, IssueFilter.severity, SEVERITY_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStatus`, async () => await group(logs, context, astResultsProvider, IssueFilter.status, STATUS_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByState`, async () => await group(logs, context, astResultsProvider, IssueFilter.state, STATE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByQueryName`, async () => await group(logs, context, astResultsProvider, IssueFilter.queryName, QUERY_NAME_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByFileActive`, async () => await group(logs, context, astResultsProvider, IssueFilter.fileName, FILE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByLanguageActive`, async () => await group(logs, context, astResultsProvider, IssueFilter.language, LANGUAGE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupBySeverityActive`, async () => await group(logs, context, astResultsProvider, IssueFilter.severity, SEVERITY_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStatusActive`, async () => await group(logs, context, astResultsProvider, IssueFilter.status, STATUS_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStateActive`, async () => await group(logs, context, astResultsProvider, IssueFilter.state, STATE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByQueryNameActive`, async () => await group(logs, context, astResultsProvider, IssueFilter.queryName, QUERY_NAME_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByDirectDependency`, async () => await group(logs, context, astResultsProvider, IssueFilter.directDependency, DEPENDENCY_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByDirectDependencyActive`, async () => await group(logs, context, astResultsProvider, IssueFilter.directDependency, DEPENDENCY_GROUP)));

    // Group Commands for command list
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByFiles`, async () => await group(logs, context, astResultsProvider, IssueFilter.fileName, FILE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByLanguages`, async () => await group(logs, context, astResultsProvider, IssueFilter.language, LANGUAGE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupBySeverities`, async () => await group(logs, context, astResultsProvider, IssueFilter.severity, SEVERITY_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStatuses`, async () => await group(logs, context, astResultsProvider, IssueFilter.status, STATUS_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStates`, async () => await group(logs, context, astResultsProvider, IssueFilter.state, STATE_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByQueryNames`, async () => await group(logs, context, astResultsProvider, IssueFilter.queryName, QUERY_NAME_GROUP)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByDirectDependencies`, async () => await group(logs, context, astResultsProvider, IssueFilter.directDependency, DEPENDENCY_GROUP)));

    // Severity Filters Command
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterHigh_toggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.high, HIGH_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterHigh_untoggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.high, HIGH_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterMedium_toggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.medium, MEDIUM_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterMedium_untoggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.medium, MEDIUM_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterLow_toggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.low, LOW_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterLow_untoggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.low, LOW_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterInfo_untoggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.info, INFO_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterInfo_toggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.info, INFO_FILTER)));

    // Severity Filters Command for command list
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterHigh`, async () => await filter(logs, context, astResultsProvider, IssueLevel.high, HIGH_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterMedium`, async () => await filter(logs, context, astResultsProvider, IssueLevel.medium, MEDIUM_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterLow`, async () => await filter(logs, context, astResultsProvider, IssueLevel.low, LOW_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterInfo`, async () => await filter(logs, context, astResultsProvider, IssueLevel.info, INFO_FILTER)));

    // State Filters Command for UI
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotExploitable`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notExploitable, NOT_EXPLOITABLE_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotExploitableActive`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notExploitable, NOT_EXPLOITABLE_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterProposed`, async () => await filterState(logs, context, astResultsProvider, StateLevel.proposed, PROPOSED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterProposedActive`, async () => await filterState(logs, context, astResultsProvider, StateLevel.proposed, PROPOSED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterConfirmed`, async () => await filterState(logs, context, astResultsProvider, StateLevel.confirmed, CONFIRMED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterConfirmedActive`, async () => await filterState(logs, context, astResultsProvider, StateLevel.confirmed, CONFIRMED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterToVerify`, async () => await filterState(logs, context, astResultsProvider, StateLevel.toVerify, TO_VERIFY_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterToVerifyActive`, async () => await filterState(logs, context, astResultsProvider, StateLevel.toVerify, TO_VERIFY_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterUrgent`, async () => await filterState(logs, context, astResultsProvider, StateLevel.urgent, URGENT_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterUrgentActive`, async () => await filterState(logs, context, astResultsProvider, StateLevel.urgent, URGENT_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotIgnored`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notIgnored, NOT_IGNORED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotIgnoredActive`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notIgnored, NOT_IGNORED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterIgnored`, async () => await filterState(logs, context, astResultsProvider, StateLevel.ignored, IGNORED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterIgnoredActive`, async () => await filterState(logs, context, astResultsProvider, StateLevel.ignored, IGNORED_FILTER)));

    // State Filters Command for command list
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotExploitables`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notExploitable, NOT_EXPLOITABLE_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterProposeds`, async () => await filterState(logs, context, astResultsProvider, StateLevel.proposed, PROPOSED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterConfirmeds`, async () => await filterState(logs, context, astResultsProvider, StateLevel.confirmed, CONFIRMED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterToVerifies`, async () => await filterState(logs, context, astResultsProvider, StateLevel.toVerify, TO_VERIFY_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterUrgents`, async () => await filterState(logs, context, astResultsProvider, StateLevel.urgent, URGENT_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterIgnoreds`, async () => await filterState(logs, context, astResultsProvider, StateLevel.ignored, IGNORED_FILTER)));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotIgnoreds`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notIgnored, NOT_IGNORED_FILTER)));

    // Pickers command
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.generalPick`, async () => {
        await multiStepInput(logs, context);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.projectPick`, async () => {
        await projectPicker(context, logs);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.branchPick`, async () => {
        await branchPicker(context, logs);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.scanPick`, async () => {
        await scanPicker(context, logs);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.scanInput`, async () => {
        await scanInput(context, logs);
    }));

    // Visual feedback on wrapper errors
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.showError`, () => {
        vscode.window.showErrorMessage(getError(context)!);
    }));

    // Kics remediation command
    context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.kicsRemediation`, async (fixedResults, kicsResults, file, diagnosticCollection, fixAll, fixLine) => {
        await kicsProvider.kicsRemediation(fixedResults, kicsResults, file, diagnosticCollection, fixAll, fixLine, logs);
    }));
}

export function deactivate() {
}