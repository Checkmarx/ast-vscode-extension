import * as vscode from "vscode";
import { AstResultsProvider } from "./views/resultsView/astResultsProvider";
import { constants } from "./utils/common/constants";
import { Logs } from "./models/logs";
import {
  addRealTimeSaveListener,
  executeCheckSettingsChange,
  gitExtensionListener,
  setScanButtonDefaultIfScanIsNotRunning,
} from "./utils/listener/listeners";
import { SCAResultsProvider } from "./views/scaView/scaResultsProvider";
import { ScanCommand } from "./commands/scanCommand";
import { ScanSCACommand } from "./commands/scanSCACommand";
import { TreeCommand } from "./commands/treeCommand";
import { PickerCommand } from "./commands/pickerCommand";
import { CommonCommand } from "./commands/commonCommand";
import { GroupByCommand } from "./commands/groupByCommand";
import { FilterCommand } from "./commands/filterCommand";
import { WebViewCommand } from "./commands/webViewCommand";
import { WorkspaceListener } from "./utils/listener/workspaceListener";
import { DocAndFeedbackView } from "./views/docsAndFeedbackView/docAndFeedbackView";
import { messages } from "./utils/common/messages";
import { commands } from "./utils/common/commands";
import { IgnoredView } from "./views/ignoredView/ignoredView";
import { AuthService } from "./services/authService";
import { initialize } from "./cx";
import { CopilotChatCommand } from "./commands/openAIChatCommand";
import { CxCodeActionProvider } from "./realtimeScanners/scanners/CxCodeActionProvider";
import { DiagnosticCommand } from "./commands/diagnosticCommand";

import { registerMcpSettingsInjector } from "./services/mcpSettingsInjector";
import { cx } from "./cx";
let globalContext: vscode.ExtensionContext;
import { registerStatusBars } from "./activation/registerStatusBars";
import { registerRealtimeScanners } from "./activation/registerRealtimeScanners";
import { registerKicsRealtime } from "./activation/registerKicsRealtime";
import { registerIgnoredStatusBar } from "./activation/registerIgnoredStatusBar";
import {
  registerAssistDocumentation,
  registerPromoResultsWebview,
  registerScaPromoWebview,
  registerAssistView,
  registerAssistRelatedCommands,
  registerAuthenticationLauncher
} from "./activation/registerAssist";











export async function activate(context: vscode.ExtensionContext) {
  // Initialize cx first
  initialize(context);

  globalContext = context;
  // Create logs channel and make it visible
  const output = vscode.window.createOutputChannel(constants.extensionFullName);
  const logs = new Logs(output);
  logs.info(messages.pluginRunning);

  // Integrity check on startup
  const authService = AuthService.getInstance(context, logs);
  await authService.validateAndUpdateState();
  // Register docs & promo webview now that logs exist
  registerAssistDocumentation(context);
  registerPromoResultsWebview(context, logs);
  registerScaPromoWebview(context, logs);

  // --- Setup grouped UI elements ---
  const {
    runScanStatusBar,
    runSCAScanStatusBar,
    kicsStatusBarItem,
    statusBarItem,
    ignoredStatusBarItem
  } = await registerStatusBars(context, logs);

  const { ignoreFileManager, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner } = await registerRealtimeScanners(context, logs);

  await setScanButtonDefaultIfScanIsNotRunning(context);

  // Scans from IDE scanning commands
  const scanCommand = new ScanCommand(context, runScanStatusBar, logs);
  scanCommand.registerIdeScans();
  scanCommand.executePollScan();

  const kicsDiagnosticCollection = vscode.languages.createDiagnosticCollection(
    constants.extensionName
  );

  // Command to allow other components (e.g., auth webview) to clear KICS remediation diagnostics
  context.subscriptions.push(
    vscode.commands.registerCommand(commands.clearKicsDiagnostics, async () => {
      if (await cx.isStandaloneEnabled(logs)) {
        kicsDiagnosticCollection.clear();
      }
    })
  );

  const { kicsScanCommand } = registerKicsRealtime(context, logs, kicsStatusBarItem, kicsDiagnosticCollection);

  const diagnosticCollection = vscode.languages.createDiagnosticCollection(
    constants.extensionName
  );
  // Create  listener for file saves for real time feedback
  addRealTimeSaveListener(context, logs);
  const filterCommand = new FilterCommand(context, logs);
  const groupByCommand = new GroupByCommand(context, logs);
  const astResultsProvider = new AstResultsProvider(
    context,
    logs,
    statusBarItem,
    diagnosticCollection,
    filterCommand,
    groupByCommand
  );
  // Initialize filters state
  filterCommand
    .initializeFilters()
    .then(() => logs.info(messages.filtersInitialized));
  // Initialize group by state
  groupByCommand
    .initializeFilters()
    .then(() => logs.info(messages.groupByInitialized));
  // Results side tree creation
  vscode.window.registerTreeDataProvider(
    constants.treeName,
    astResultsProvider
  );
  const tree = vscode.window.createTreeView(constants.treeName, {
    treeDataProvider: astResultsProvider,
  });
  // Throttled, visibility-aware workspace listener to reduce idle load
  const workspaceListener: WorkspaceListener = new WorkspaceListener();
  const wsInterval = setInterval(() => {
    if (!tree.visible) {
      return;
    }
    workspaceListener.listener(context, astResultsProvider);
  }, 2000);
  context.subscriptions.push({ dispose: () => clearInterval(wsInterval) });
  // tree listener to open a webview in a new panel with results details
  tree.onDidChangeSelection((item) => {
    if (item.selection.length > 0) {
      if (!item.selection[0].contextValue && !item.selection[0].children) {
        // Open new details
        vscode.commands.executeCommand(
          commands.newDetails,
          item.selection[0].result
        );
      }
    }
  });

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { scheme: "file" },
      {
        provideHover() {
          return undefined;
        }
      }
    )
  );
  // Webview detailsPanel to show result details on the side
  const webViewCommand = new WebViewCommand(context, logs, astResultsProvider);
  webViewCommand.registerGpt();
  webViewCommand.registerNewDetails();
  // Branch change Listener
  await gitExtensionListener(context, logs);
  // SCA Auto Scanning view
  const scaResultsProvider = new SCAResultsProvider(
    context,
    logs,
    statusBarItem,
    diagnosticCollection
  );

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
  });  // SCA auto scanning commands register
  const scaScanCommand = new ScanSCACommand(
    context,
    runSCAScanStatusBar,
    scaResultsProvider,
    logs
  );
  scaScanCommand.registerScaScans();
  vscode.window.registerTreeDataProvider(
    constants.scaTreeName,
    scaResultsProvider
  );
  const scaTree = vscode.window.createTreeView(constants.scaTreeName, {
    treeDataProvider: scaResultsProvider,
  });
  scaTree.onDidChangeSelection(async (item) => {
    if (await cx.isStandaloneEnabled(this.logs)) {
      return;
    }
    if (item.selection.length > 0) {
      if (!item.selection[0].contextValue && !item.selection[0].children) {
        // Open new details
        vscode.commands.executeCommand(
          commands.newDetails,
          item.selection[0].result,
          constants.realtime
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
    scaTree
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
  // execute command to listen to settings change
  await executeCheckSettingsChange(
    context,
    kicsStatusBarItem,
    logs
  );

  const treeCommand = new TreeCommand(
    context,
    astResultsProvider,
    scaResultsProvider,
    logs
  );
  // Promo webview already registered above

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
  // ignoreFileManager already initialized & wired in setupRealtimeScanners

  // CxOne Assist view & its commands
  const cxOneAssistProvider = registerAssistView(context, ignoreFileManager, logs);
  registerAssistRelatedCommands(context, cxOneAssistProvider);

  const copilotChatCommand = new CopilotChatCommand(context, logs, ossScanner, secretScanner, iacScanner, ascaScanner, containersScanner);
  registerMcpSettingsInjector(context);

  copilotChatCommand.registerCopilotChatCommand();

  const ignoredView = new IgnoredView(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(commands.openIgnoredView, () => {
      ignoredView.show();
    })
  );

  registerIgnoredStatusBar(context, logs, ignoreFileManager, ignoredStatusBarItem, cxOneAssistProvider);

  vscode.commands.registerCommand("ast-results.mockTokenTest", async () => {
    const authService = AuthService.getInstance(context);
    await authService.saveToken(context, "FAKE_TOKEN_FROM_TEST");
    console.log(">> Mock token has been saved to secrets");
    await authService.validateAndUpdateState();
  });

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: "file" },
      new CxCodeActionProvider(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
      }
    )
  );

}

export function getGlobalContext(): vscode.ExtensionContext {
  return globalContext;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() { }
