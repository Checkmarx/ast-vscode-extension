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
import { AscaCommand } from "./commands/ascaCommand";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import * as http from "http";

// Function to handle browser-based loginnn

export async function getBaseAstConfiguration() {
  const config = new CxConfig();
  config.additionalParameters = vscode.workspace
    .getConfiguration("checkmarxOne")
    .get("additionalParams") as string;

  return config;
}

export async function getAstConfiguration() {
  const token = vscode.workspace
    .getConfiguration("checkmarxOne")
    .get("apiKey") as string;

  const config = await getBaseAstConfiguration();
  config.apiKey = token;
  return config;
}

export async function browserLoginCommand(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  // Retrieve the API key from the configuration
  const checkmarxApiKey = vscode.workspace
    .getConfiguration("checkmarxOne")
    .get("apiKey") as string;

  console.log("checkmarxApiKey", checkmarxApiKey);

  const config = await getAstConfiguration();
  const cx = new CxWrapper(config);

  const valid = await cx.authValidate();
  if (valid.exitCode === 0 && config.apiKey != "") {
    return;
  }

  const response = await vscode.window.showInformationMessage(
    "API key is missing or invalid. Authenticate via browser to continue using Checkmarx One.",
    "Authenticate via Browser",
    "Cancel"
  );

  if (response === "Authenticate via Browser") {
    try {
      // OAuth Configuration
      const AUTH_URL =
        "https://iam-dev.dev.cxast.net/auth/realms/dev_tenant/protocol/openid-connect/auth";
      const TOKEN_URL =
        "https://iam-dev.dev.cxast.net/auth/realms/dev_tenant/protocol/openid-connect/token";
      const REDIRECT_URI = "http://localhost:54321/callback";
      const CLIENT_ID = "ast-app";
      const SCOPES = "openid";

      // Create authorization URL
      const authRequestUrl = `${AUTH_URL}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
        REDIRECT_URI
      )}&scope=${SCOPES}`;

      // Create local server to handle callback
      const server = http.createServer(async (req, res) => {
        if (req.url?.startsWith("/callback")) {
          try {
            // Parse the callback URL
            const url = new URL(req.url, `http://localhost:54321`);
            const code = url.searchParams.get("code");

            if (!code) {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Authorization code not received");
              server.close();
              return;
            }

            // Exchange code for tokens
            const tokenResponse = await fetch(TOKEN_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                code: code,
              }),
            });

            if (!tokenResponse.ok) {
              const errorText = await tokenResponse.text();
              logs.error(`Token exchange failed: ${errorText}`);
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Failed to exchange code for token");
              server.close();
              return;
            }

            const tokens: {
              access_token: string;
              refresh_token?: string;
              id_token?: string;
            } = await tokenResponse.json();
            // Log tokens for testing
            console.log("Access Token:", tokens.access_token);
            console.log("Refresh Token:", tokens.refresh_token);
            console.log("ID Token:", tokens.id_token);

            logs.info("Access Token: " + tokens.access_token);
            logs.info(
              "Refresh Token: " + (tokens.refresh_token || "No refresh token")
            );
            logs.info("ID Token: " + (tokens.id_token || "No ID token"));

            await vscode.workspace
              .getConfiguration("checkmarxOne")
              .update("apiKey", tokens.refresh_token);
            logs.info("API key saved successfully.");
            vscode.window.showInformationMessage("API key saved successfully!");

            // Send success response to browser
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Successful!</h1>
                  <p>You can close this window now.</p>
                </body>
              </html>
            `);

            // Show success message in VS Code
            vscode.window.showInformationMessage(authSuccessMsg);

            // Close the server
            server.close();
          } catch (error) {
            logs.error(`Error during token exchange: ${error}`);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal server error during authentication");
            server.close();
          }
        }
      });

      // Start the server
      server.listen(54321, () => {
        logs.info("Authentication server listening on port 54321");
      });

      server.on("error", (error) => {
        logs.error(`Server error: ${error}`);
        vscode.window.showErrorMessage("Failed to start authentication server");
      });

      // Open the browser for authentication
      await vscode.env.openExternal(vscode.Uri.parse(authRequestUrl));
    } catch (error) {
      logs.error(`Authentication failed: ${error}`);
      vscode.window.showErrorMessage(
        "Authentication failed. Please try again."
      );
    }
  }
}
export async function activate(context: vscode.ExtensionContext) {
  // Create logs channel and make it visible
  const output = vscode.window.createOutputChannel(constants.extensionFullName);
  const logs = new Logs(output);
  logs.info(messages.pluginRunning);

  // Call the browserLoginCommand automatically on activation
  //await browserLoginCommand(context, logs);

  //Register browser-based login command
  context.subscriptions.push(
    vscode.commands.registerCommand("ast-results.login", async () => {
      await browserLoginCommand(context, logs);
    })
  );

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
  const ascaCommand = new AscaCommand(context, logs);
  ascaCommand.registerAsca();
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
  await executeCheckSettingsChange(kicsStatusBarItem, logs, ascaCommand);

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
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
