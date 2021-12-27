import * as vscode from "vscode";
import { AstResultsProvider } from "./ast_results_provider";
import { AstResult } from "./models/results";
import {
  EXTENSION_NAME,
  HIGH_FILTER,
  MEDIUM_FILTER,
  LOW_FILTER,
  INFO_FILTER,
  IssueLevel,
  IssueFilter,
} from "./utils/constants";
import { Logs } from "./models/logs";
import * as path from "path";
import { multiStepInput } from "./ast_multi_step_input";
import { AstDetailsDetached } from "./ast_details_view";
import { branchPicker, projectPicker, scanInput, scanPicker } from "./pickers";
import {filter, initializeFilters} from "./utils/filters";
import { group } from "./utils/group";
import { getBranchListener } from "./utils/listeners";
import { getAstConfiguration } from "./utils/ast";
import { REFRESH_TREE } from "./utils/commands";

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel(EXTENSION_NAME);
  const logs = new Logs(output);
  logs.show();
  logs.info("Checkmarx plugin is running");

  const diagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_NAME);
  
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

  const astResultsProvider = new AstResultsProvider(
    context,
    logs,
    statusBarItem,
    diagnosticCollection
  );
  astResultsProvider.refreshData().then(r => logs.info("Data refreshed"));
  initializeFilters(logs, context, astResultsProvider).then(value => logs.info("Filters initialized"));
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
      const detailsDetachedView = new AstDetailsDetached(
        context.extensionUri,
        result
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
              vscode.Uri.file(path.join(context.extensionPath, "media")),
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

      detailsPanel.webview.html = detailsDetachedView.getDetailsWebviewContent(
        detailsPanel.webview,
      );
      detailsPanel.webview.onDidReceiveMessage(data => {
        console.log(data);
        switch (data.command) {
          case 'showFile':
            detailsDetachedView.loadDecorations(data.path, data.line, data.column, data.length);
            break;
        }
      });
    }
  );
  context.subscriptions.push(newDetails);
  
  // Branch Listener
  context.subscriptions.push(await getBranchListener(context, logs));

  // Settings
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.viewSettings`, () => {
        vscode.commands.executeCommand(
            "workbench.action.openSettings",
            `checkmarx`
        );
      }
  ));

  // Listening to settings changes
  vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isValidCredentials`, getAstConfiguration() ? true : false);
  vscode.workspace.onDidChangeConfiguration(async () => {
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.isValidCredentials`, getAstConfiguration() ? true : false);
    await vscode.commands.executeCommand(REFRESH_TREE);
  });

  // Refresh Tree
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.refreshTree`, async () => await astResultsProvider.refreshData()));

  // Clear
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.clear`, async () =>  await astResultsProvider.clean()));

  // Group
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByFile`, async () => await group(logs, astResultsProvider, IssueFilter.fileName)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByLanguage`, async () => await group(logs, astResultsProvider, IssueFilter.language)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupBySeverity`, async () => await group(logs, astResultsProvider, IssueFilter.severity)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.groupByStatus`, async () => await group(logs, astResultsProvider, IssueFilter.status)));

  // Filters
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterHigh_toggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.high, HIGH_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterHigh_untoggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.high, HIGH_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterMedium_toggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.medium, MEDIUM_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterMedium_untoggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.medium, MEDIUM_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterLow_toggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.low, LOW_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterLow_untoggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.low, LOW_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterInfo_untoggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.info, INFO_FILTER)));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.filterInfo_toggle`, async () => await filter(logs, context, astResultsProvider, IssueLevel.info, INFO_FILTER)));

  // New pickers
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.generalPick`, async () => { await multiStepInput(logs, context); }));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.projectPick`, async () => { await projectPicker(context, logs); }));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.branchPick`, async () => { await branchPicker(context, logs); }));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.scanPick`, async () => { await scanPicker(context, logs); }));
  context.subscriptions.push(vscode.commands.registerCommand(`${EXTENSION_NAME}.scanInput`, async () => { await scanInput(context, logs); }));
}

export function deactivate() { }