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
import { DocAndFeedbackView } from "./views/docsAndFeedbackView/docAndFeedbackView";
import { messages } from "./utils/common/messages";
import { commands } from "./utils/common/commands";
import { IgnoredView } from "./views/ignoredView/ignoredView";
import { AuthenticationWebview } from "./webview/authenticationWebview";
import { AuthService } from "./services/authService";
import { initialize } from "./cx";
import { ScannerRegistry } from "./realtimeScanners/scanners/scannerRegistry";
import { ConfigurationManager } from "./realtimeScanners/configuration/configurationManager";
import { CopilotChatCommand } from "./commands/openAIChatCommand";
import { CxCodeActionProvider } from "./realtimeScanners/scanners/CxCodeActionProvider";
import { OssScannerCommand } from "./realtimeScanners/scanners/oss/ossScannerCommand";
import { SecretsScannerCommand } from "./realtimeScanners/scanners/secrets/secretsScannerCommand";
import { IgnoreFileManager } from "./realtimeScanners/common/ignoreFileManager";


import { registerMcpSettingsInjector } from "./services/mcpSettingsInjector";
let globalContext: vscode.ExtensionContext;

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
  const ignoredStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left, 20

  );

  const configManager = new ConfigurationManager();
  const scannerRegistry = new ScannerRegistry(context, logs, configManager);
  await scannerRegistry.activateAllScanners();
  const configListener = configManager.registerConfigChangeListener(
    (section) => {
      const ossEffected = section(
        `${constants.ossRealtimeScanner}.${constants.activateOssRealtimeScanner}`
      );
      if (ossEffected) {
        scannerRegistry.getScanner(constants.ossRealtimeScannerEngineName)?.register();
        return;
      }
      const secretsEffected = section(
        `${constants.secretsScanner}.${constants.activateSecretsScanner}`
      );
      if (secretsEffected) {
        scannerRegistry.getScanner(constants.secretsScannerEngineName)?.register();
        return;
      }
      const ascaEffected = section(
        `${constants.ascaRealtimeScanner}.${constants.activateAscaRealtimeScanner}`
      );
      if (ascaEffected) {
        scannerRegistry.getScanner(constants.ascaRealtimeScannerEngineName)?.register();
        return;
      }
      const containersEffected = section(
        `${constants.containersRealtimeScanner}.${constants.activateContainersRealtimeScanner}`
      );
      if (containersEffected) {
        scannerRegistry.getScanner(constants.containersRealtimeScannerEngineName)?.register();
        return;
      }
    });
  context.subscriptions.push(configListener);

  await setScanButtonDefaultIfScanIsNotRunning(context);

  // Scans from IDE scanning commands
  const scanCommand = new ScanCommand(context, runScanStatusBar, logs);
  scanCommand.registerIdeScans();
  scanCommand.executePollScan();

  const kicsDiagnosticCollection = vscode.languages.createDiagnosticCollection(
    constants.extensionName
  );

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
  // Workspace listener
  const workspaceListener: WorkspaceListener = new WorkspaceListener();
  setInterval(
    () => workspaceListener.listener(context, astResultsProvider),
    500
  );
  // Results side tree creation
  vscode.window.registerTreeDataProvider(
    constants.treeName,
    astResultsProvider
  );
  const tree = vscode.window.createTreeView(constants.treeName, {
    treeDataProvider: astResultsProvider,
  });
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

  const docAndFeedbackTree = vscode.window.createTreeView("docAndFeedback", {
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

  // SCA auto scanning commands register
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
  // Register refresh sca and results Tree Commmand
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
  // Registe Kics remediation command
  kicsScanCommand.registerKicsRemediation();
  // Refresh sca tree with start scan message
  scaResultsProvider.refreshData(constants.scaStartScan);

  // Register authentication command

  context.subscriptions.push(
    vscode.commands.registerCommand("ast-results.showAuth", () => {
      AuthenticationWebview.show(context, webViewCommand, logs);
    })
  );
  const ignoreFileManager = IgnoreFileManager.getInstance();
  const ossCommand = scannerRegistry.getScanner(constants.ossRealtimeScannerEngineName) as OssScannerCommand;
  const ossScanner = ossCommand.getScannerService();

  const secretCommand = scannerRegistry.getScanner(constants.secretsScannerEngineName) as SecretsScannerCommand;
  const secretScanner = secretCommand.getScannerService();

  ignoreFileManager.setOssScannerService(ossScanner);
  ignoreFileManager.setSecretsScannerService(secretScanner);

  context.subscriptions.push({
    dispose: () => ignoreFileManager.dispose()
  });

  const copilotChatCommand = new CopilotChatCommand(context, logs, ossScanner, secretScanner);
  registerMcpSettingsInjector(context);


  copilotChatCommand.registerCopilotChatCommand();



  const ignoredView = new IgnoredView(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(commands.openIgnoredView, () => {
      ignoredView.show();
    })
  );

  function updateIgnoredStatusBar() {
    const count = ignoreFileManager.getIgnoredPackagesCount();
    const hasIgnoreFile = ignoreFileManager.hasIgnoreFile();

    if (hasIgnoreFile) {
      ignoredStatusBarItem.text = `$(circle-slash) ${count}`;
      ignoredStatusBarItem.tooltip = count > 0
        ? `${count} ignored vulnerabilities - Click to view`
        : `No ignored vulnerabilities - Click to view`;
      ignoredStatusBarItem.command = commands.openIgnoredView;
      ignoredStatusBarItem.show();
    } else {
      ignoredStatusBarItem.hide();
    }
  }

  updateIgnoredStatusBar();

  ignoreFileManager.setStatusBarUpdateCallback(updateIgnoredStatusBar);





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
