import * as vscode from "vscode";
import { AstResultsProvider } from "./views/resultsView/astResultsProvider";
import {
  constants
} from "./utils/common/constants";
import { Logs } from "./models/logs";
import {
  addRealTimeSaveListener,
  executeCheckSettingsChange,
  gitExtensionListener,
  setScanButtonDefaultIfScanIsNotRunning,
} from "./utils/listener/listeners";
import { KicsProvider } from "./kics/kicsRealtimeProvider";
import { SCAResultsProvider } from "./views/scaView/scaResultsProvider";
import { ScanCommand } from "./commands/scanCommand";
import { ScanSCACommand } from "./commands/scanSCACommand";
import { KICSRealtimeCommand } from "./commands/kicsRealtimeCommand";
import { TreeCommand } from "./commands/treeCommand";
import { PickerCommand } from "./commands/pickerCommand";
import { CommonCommand } from "./commands/commonCommand";
import { GroupByCommand } from "./commands/groupByCommand";
import { FilterCommand } from "./commands/filterCommand";
import { WebViewCommand } from "./commands/webViewCommand";
import { WorkspaceListener } from "./utils/listener/workspaceListener";
import { messages } from "./utils/common/messages";
import { commands } from "./utils/common/commands";

export async function activate(context: vscode.ExtensionContext) {
  // Create logs channel and make it visible
  const output = vscode.window.createOutputChannel(constants.extensionFullName);
  const logs = new Logs(output);
  logs.show();
  logs.info(messages.pluginRunning);

  // Status bars creation
  const runScanStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  const runSCAScanStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  runSCAScanStatusBar.text = messages.scaStatusBarConnect;
  runSCAScanStatusBar.show();
  const kicsStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );

  await setScanButtonDefaultIfScanIsNotRunning(context);

  // Scans from IDE scanning commands
  const scanCommand = new ScanCommand(context, runScanStatusBar, logs);
  scanCommand.registerIdeScans();
  scanCommand.executePollScan();

  const kicsDiagnosticCollection =
    vscode.languages.createDiagnosticCollection(constants.extensionName);

  const kicsProvider = new KicsProvider(
    context,
    logs,
    kicsStatusBarItem,
    kicsDiagnosticCollection,
    [],
    []
  );
  const kicsScanCommand = new KICSRealtimeCommand(context, kicsProvider, logs);
  kicsScanCommand.registerKicsScans();

  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection(constants.extensionName);
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
  // Workspace listener
  const workspaceListener: WorkspaceListener = new WorkspaceListener();
  setInterval(
    () => workspaceListener.listener(context, astResultsProvider),
    500
  );
  // Results side tree creation
  vscode.window.registerTreeDataProvider(constants.treeName, astResultsProvider);
  const tree = vscode.window.createTreeView(constants.treeName, {
    treeDataProvider: astResultsProvider,
  });
  // tree listener to open a webview in a new panel with results details
  tree.onDidChangeSelection((item) => {
    if (item.selection.length > 0) {
      if (!item.selection[0].contextValue && !item.selection[0].children) {
        // Open new details
        vscode.commands.executeCommand(commands.newDetails, item.selection[0].result);
      }
    }
  });
  // Webview detailsPanel to show result details on the side
  const webViewCommand = new WebViewCommand(context, logs, astResultsProvider);
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

  // SCA auto scanning commands register
  const scaScanCommand = new ScanSCACommand(
    context,
    runSCAScanStatusBar,
    scaResultsProvider,
    logs
  );
  scaScanCommand.registerScaScans();
  vscode.window.registerTreeDataProvider(constants.scaTreeName, scaResultsProvider);
  const scaTree = vscode.window.createTreeView(constants.scaTreeName, {
    treeDataProvider: scaResultsProvider,
  });
  scaTree.onDidChangeSelection((item) => {
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
  // Register Settings
  const commonCommand = new CommonCommand(context, logs);
  commonCommand.registerSettings();
  kicsScanCommand.registerSettings();
  // Listening to settings changes
  commonCommand.executeCheckSettings();
  // Scan from IDE enablement
  await commonCommand.executeCheckScanEnabled();
  // SCA auto scanning enablement
  await commonCommand.executeCheckScaScanEnabled();
  // execute command to listen to settings change
  await executeCheckSettingsChange(kicsStatusBarItem);

  const treeCommand = new TreeCommand(
    context,
    astResultsProvider,
    scaResultsProvider,
    logs
  );
  // Register refresh sca and results Tree Commmand
  treeCommand.registerRefreshCommands();
  // Register clear sca and results tree Command
  treeCommand.registeClearCommands();
  // Register group Commands for UI and for command list
  groupByCommand.registerGroupBy();
  // Register Severity and state Filters Command for UI and for command list
  filterCommand.registerFilters();
  // Register pickers command
  const pickerCommand = new PickerCommand(context, logs, astResultsProvider);
  pickerCommand.registerPickerCommands();
  // Visual feedback on wrapper errors
  commonCommand.registerErrors();
  // Registe Kics remediation command
  kicsScanCommand.registerKicsRemediation();
  // Refresh sca tree with start scan message
  scaResultsProvider.refreshData(constants.scaStartScan);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() { }
