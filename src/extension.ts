import * as vscode from "vscode";
import { AstResultsProvider } from "./ast_results_provider";
import { AstResult } from "./models/results";
import { getError} from "./utils/common/globalState";
import {
  EXTENSION_NAME,
  HIGH_FILTER,
  MEDIUM_FILTER,
  LOW_FILTER,
  INFO_FILTER,
  IssueLevel,
  IssueFilter,
  StateLevel,
  NOT_EXPLOITABLE_FILTER,
  PROPOSED_FILTER,
  CONFIRMED_FILTER,
  TO_VERIFY_FILTER,
  URGENT_FILTER,
  NOT_IGNORED_FILTER,
  IGNORED_FILTER,
  FILE_GROUP,
  LANGUAGE_GROUP,
  SEVERITY_GROUP,
  STATUS_GROUP,
  STATE_GROUP,
  QUERY_NAME_GROUP,
  EXTENSION_FULL_NAME, SCAN_CREATE, SCAN_CANCEL
} from "./utils/common/constants";
import { Logs } from "./models/logs";
import * as path from "path";
import { multiStepInput } from "./ast_multi_step_input";
import { AstDetailsDetached } from "./ast_details_view";
import { branchPicker, projectPicker, scanInput, scanPicker } from "./pickers";
import { filter, filterState, initializeFilters } from "./utils/filters";
import { group } from "./utils/group";
import { addRealTimeSaveListener, getBranchListener } from "./utils/listeners";
import { getCodebashingLink } from "./utils/codebashing/codebashing";
import { triageSubmit} from "./utils/sast/triage";
import { REFRESH_TREE } from "./utils/common/commands";
import {disableButton, enableButton, getChanges} from "./utils/utils";
import { KicsProvider } from "./utils/kics/kics_provider";
import { applyScaFix } from "./utils/scaFix";
import { GitExtension } from "./types/git";
import { getLearnMore } from "./utils/sast/learnMore";
import {getAstConfiguration, isCreateScanEligible, isScanRunning, pollForScan, updateStatusBarItem} from "./utils/ast/ast";
import {cancelScan, createScan} from "./create_scan_provider";

export async function activate(context: vscode.ExtensionContext) {
  // Create logs channel and make it visible
  const output = vscode.window.createOutputChannel(EXTENSION_FULL_NAME);
  const logs = new Logs(output);
  logs.show();
  logs.info("Checkmarx plugin is running");

  
  const kicsDiagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_NAME);
  const kicsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

  const createScanStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.createScan`, async () => {
    const scanRunning = await isScanRunning(context, createScanStatusBarItem);
    if(!scanRunning) {
      updateStatusBarItem(SCAN_CREATE, true, createScanStatusBarItem);
      await disableButton(`${EXTENSION_NAME}.createScanButton`);
      await enableButton(`${EXTENSION_NAME}.cancelScanButton`);
      await createScan(context, logs);
      updateStatusBarItem(SCAN_CREATE, false, createScanStatusBarItem);
    }
    await vscode.commands.executeCommand(`ast-results.pollForScan`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.cancelScan`, async () => {
    const scanRunning = await isScanRunning(context, createScanStatusBarItem);
    if(scanRunning) {
      updateStatusBarItem(SCAN_CANCEL, true, createScanStatusBarItem);
      await disableButton(`${EXTENSION_NAME}.cancelScanButton`);
      await enableButton(`${EXTENSION_NAME}.createScanButton`);
      await cancelScan(context, logs);
      updateStatusBarItem(SCAN_CANCEL, false, createScanStatusBarItem);
    }
    await vscode.commands.executeCommand(`ast-results.pollForScan`);
  }));

  vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isCreateScanEligible`, await isCreateScanEligible(logs));
  vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.createScanButton`, !await isScanRunning(context, createScanStatusBarItem));
  vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.cancelScanButton`, await isScanRunning(context, createScanStatusBarItem));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.pollForScan`, async () => { await pollForScan(context,logs,createScanStatusBarItem) }));
  vscode.commands.executeCommand(`${EXTENSION_NAME}.pollForScan`);

  const kicsProvider = new KicsProvider(context, logs, kicsStatusBarItem, kicsDiagnosticCollection,[],[]);
   // kics auto scan  command
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.kicsRealtime`, async () => await kicsProvider.runKics()));

  const diagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_NAME);
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

  // Create listener for file saves for real time feedback
  addRealTimeSaveListener(context,logs,kicsStatusBarItem);

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
    async (result: AstResult) => {
      var detailsDetachedView = new AstDetailsDetached(
        context.extensionUri,
        result,
        context,
        false
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
      if(result.type === "sast") {
        getChanges(logs,context,result,detailsPanel);
        getLearnMore(logs,context,result,detailsPanel);
      }
      // Start to load the bfl, gets called everytime a new details webview is opened in a SAST result
      //result.sastNodes.length>0 && getResultsBfl(logs,context,result,detailsPanel);
      // Comunication between webview and extension
      detailsPanel.webview.onDidReceiveMessage(async data => {
        switch (data.command) {
          // Catch open file message to open and view the result entry
          case 'showFile':
            detailsDetachedView.loadDecorations(data.path, data.line, data.column, data.length);
            break;
          // Catch submit message to open and view the result entry
          case 'submit':
            triageSubmit(result, context, data, logs, detailsPanel!, detailsDetachedView);
            getChanges(logs,context,result,detailsPanel!);
            break;
          // Catch get codebashing link and open a browser page
          case 'codebashing':
            getCodebashingLink(result.cweId!,result.language,result.queryName,logs);
            break;
          case 'references':
            vscode.env.openExternal(vscode.Uri.parse(data.link));
            break;
          case 'scaFix':
            applyScaFix(data.package,data.file,data.version,logs);
        }
      });
    }
  );
  context.subscriptions.push(newDetails);
  
  // Branch Listener
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
  if (gitExtension.enabled) {
    context.subscriptions.push(await getBranchListener(context, logs));
  } else {
    logs.warn("Could not find active git extension in workspace, will not listen to branch changes");
  }

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
  vscode.workspace.onDidChangeConfiguration(async (event) => {
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isValidCredentials`, getAstConfiguration() ? true : false);
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isCreateScanEligible`, await isCreateScanEligible(logs));
    const onSave = vscode.workspace.getConfiguration("CheckmarxKICS").get("Activate KICS Auto Scanning") as boolean;
    kicsStatusBarItem.text = onSave===true?"$(check) Checkmarx kics":"$(debug-disconnect) Checkmarx kics";
    await vscode.commands.executeCommand(REFRESH_TREE);
  });

  // Refresh Tree Commmand
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.refreshTree`, async () => await astResultsProvider.refreshData()));


  // Clear Command
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.clear`, async () =>  await astResultsProvider.clean()));

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

  // Group Commands for command list
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByFiles`, async () => await group(logs, context, astResultsProvider, IssueFilter.fileName, FILE_GROUP)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByLanguages`, async () => await  group(logs, context, astResultsProvider, IssueFilter.language, LANGUAGE_GROUP)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupBySeverities`, async () => await group(logs, context, astResultsProvider, IssueFilter.severity, SEVERITY_GROUP)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStatuses`, async () => await group(logs, context, astResultsProvider, IssueFilter.status, STATUS_GROUP)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStates`, async () => await group(logs, context, astResultsProvider, IssueFilter.state, STATE_GROUP)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByQueryNames`, async () => await group(logs, context, astResultsProvider, IssueFilter.queryName, QUERY_NAME_GROUP)));

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
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterUrgentActive`, async () => await filterState(logs, context, astResultsProvider,  StateLevel.urgent, URGENT_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotIgnored`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notIgnored, NOT_IGNORED_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotIgnoredActive`, async () => await filterState(logs, context, astResultsProvider,  StateLevel.notIgnored, NOT_IGNORED_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterIgnored`, async () => await filterState(logs, context, astResultsProvider, StateLevel.ignored, IGNORED_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterIgnoredActive`, async () => await filterState(logs, context, astResultsProvider,  StateLevel.ignored, IGNORED_FILTER)));
  
  // State Filters Command for command list
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotExploitables`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notExploitable, NOT_EXPLOITABLE_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterProposeds`, async () => await filterState(logs, context, astResultsProvider, StateLevel.proposed, PROPOSED_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterConfirmeds`, async () => await filterState(logs, context, astResultsProvider, StateLevel.confirmed, CONFIRMED_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterToVerifies`, async () => await filterState(logs, context, astResultsProvider, StateLevel.toVerify, TO_VERIFY_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterUrgents`, async () => await filterState(logs, context, astResultsProvider, StateLevel.urgent, URGENT_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterIgnoreds`, async () => await filterState(logs, context, astResultsProvider, StateLevel.ignored, IGNORED_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterNotIgnoreds`, async () => await filterState(logs, context, astResultsProvider, StateLevel.notIgnored, NOT_IGNORED_FILTER)));
  
  // Pickers command 
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.generalPick`, async () => { await multiStepInput(logs, context); }));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.projectPick`, async () => { await projectPicker(context, logs); }));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.branchPick`, async () => { await branchPicker(context, logs); }));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.scanPick`, async () => { await scanPicker(context, logs); }));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.scanInput`, async () => { await scanInput(context, logs); }));

  // Visual feedback on wrapper errors
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.showError`, () => { vscode.window.showErrorMessage(getError(context)!);}));

  // Kics remediation command
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.kicsRemediation`, async (fixedResults,kicsResults,file,diagnosticCollection,fixAll,fixLine) => {
   await kicsProvider.kicsRemediation(fixedResults,kicsResults,file,diagnosticCollection,fixAll,fixLine,logs);
   }));
}

export function deactivate() { }