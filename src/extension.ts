import * as vscode from "vscode";
var fs = require("fs");
import * as ast from "./ast_results_provider";
import { AstResultsProvider, TreeItem } from "./ast_results_provider";
import { AstResult } from "./results";
import {
  EXTENSION_NAME,
  HIGH_FILTER,
  MEDIUM_FILTER,
  LOW_FILTER,
  INFO_FILTER,
} from "./constants";
import { Logs } from "./logs";
import * as path from "path";
import { getBranches, getProjectId, getProjectList, getResults, updateBranchId, updateProjectId, updateScanId, getScans, Item, getBranchId } from "./utils";
import { CxQuickPickItem, multiStepInput } from "./select_project";
import { AstDetailsDetached } from "./views/details/ast_details_view";

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection(EXTENSION_NAME);
  const output = vscode.window.createOutputChannel(EXTENSION_NAME);
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  const logs = new Logs(output);

  const astResultsProvider = new AstResultsProvider(
    context,
    logs,
    statusBarItem,
    diagnosticCollection
  );
  vscode.window.registerTreeDataProvider(`astResults`, astResultsProvider);
  const tree = vscode.window.createTreeView("astResults", {
    treeDataProvider: astResultsProvider,
    showCollapseAll: true,
  });
  tree.onDidChangeSelection((item) => {
	  if(item.selection.length>0){
		// Catch the new pickers actions
		if(item.selection[0].contextValue){
			switch (item.selection[0].contextValue) {
				case "project":
					logs.log("CxInfo","Selecting project");
					break;
				case "branch":
					logs.log("CxInfo","Selecting branch");
					break;
				case "scanTree":
					logs.log("CxInfo","Selecting scan id");
					break;
			}
	  }
	  // Catch the new page details action
	  else{
		if(!item.selection[0].children) {
			// Open new details
			vscode.commands.executeCommand(
			  "ast-results.newDetails",
			  item.selection[0].result
			);
		  }
	} 
	}
	  
    
  });
  // Show the user the ast logs channel
  logs.show();
  logs.log("Info", "Checkmarx plugin is running");

  


  const refreshTree = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.refreshTree`,
    () => {
      console.log("In extension- refresh tree");
      astResultsProvider.refresh();
    }
  );
  context.subscriptions.push(refreshTree);

  const viewSeetings = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.viewSettings`,
    () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        `checkmarx`
      );
    }
  );
  context.subscriptions.push(viewSeetings);

  const groupBySeverity = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.groupBySeverity`,
    () => {
      logs.log("Info", "Group by severity");
      astResultsProvider.issueFilter = ast.IssueFilter.severity;
      astResultsProvider.refresh();
    }
  );
  context.subscriptions.push(groupBySeverity);

  const groupByLanguage = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.groupByLanguage`,
    () => {
      logs.log("Info", "Group by language");
      astResultsProvider.issueFilter = ast.IssueFilter.language;
      astResultsProvider.refresh();
    }
  );
  context.subscriptions.push(groupByLanguage);

  const groupByStatus = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.groupByStatus`,
    () => {
      logs.log("Info", "Group by status");
      astResultsProvider.issueFilter = ast.IssueFilter.status;
      astResultsProvider.refresh();
    }
  );
  context.subscriptions.push(groupByStatus);

  const groupByFile = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.groupByFile`,
    () => {
      logs.log("Info", "Group by fileName");
      astResultsProvider.issueFilter = ast.IssueFilter.fileName;
      astResultsProvider.refresh();
    }
  );
  context.subscriptions.push(groupByFile);

  const clearResults = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.cleanResults`,
    () => {
      logs.log("Info", "Clear results");
      diagnosticCollection.clear();
    }
  );
  context.subscriptions.push(clearResults);

  const filterHightoggle = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.filterHigh_toggle`,
    (item: ast.TreeItem) => {
      logs.log("Info", "Filtering high results");
      astResultsProvider.issueLevel = astResultsProvider.issueLevel.includes(
        ast.IssueLevel.high
      )
        ? astResultsProvider.issueLevel.filter((x) => {
            return x !== ast.IssueLevel.high;
          })
        : astResultsProvider.issueLevel.concat([ast.IssueLevel.high]);
      astResultsProvider.refreshData(HIGH_FILTER);
    }
  );
  context.subscriptions.push(filterHightoggle);

  const filterHighuntoggle = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.filterHigh_untoggle`,
    (item: ast.TreeItem) => {
      logs.log("Info", "Filtering high results");
      astResultsProvider.issueLevel = astResultsProvider.issueLevel.includes(
        ast.IssueLevel.high
      )
        ? astResultsProvider.issueLevel.filter((x) => {
            return x !== ast.IssueLevel.high;
          })
        : astResultsProvider.issueLevel.concat([ast.IssueLevel.high]);
      astResultsProvider.refreshData(HIGH_FILTER);
    }
  );
  context.subscriptions.push(filterHighuntoggle);

  const filterMediumtoggle = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.filterMedium_toggle`,
    (item: ast.TreeItem) => {
      logs.log("Info", "Filtering medium results");
      astResultsProvider.issueLevel = astResultsProvider.issueLevel.includes(
        ast.IssueLevel.medium
      )
        ? astResultsProvider.issueLevel.filter((x) => {
            return x !== ast.IssueLevel.medium;
          })
        : astResultsProvider.issueLevel.concat([ast.IssueLevel.medium]);
      astResultsProvider.refreshData(MEDIUM_FILTER);
    }
  );
  context.subscriptions.push(filterMediumtoggle);

  const filterMediumuntoggle = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.filterMedium_untoggle`,
    (item: ast.TreeItem) => {
      logs.log("Info", "Filtering medium results");
      astResultsProvider.issueLevel = astResultsProvider.issueLevel.includes(
        ast.IssueLevel.medium
      )
        ? astResultsProvider.issueLevel.filter((x) => {
            return x !== ast.IssueLevel.medium;
          })
        : astResultsProvider.issueLevel.concat([ast.IssueLevel.medium]);
      astResultsProvider.refreshData(MEDIUM_FILTER);
    }
  );
  context.subscriptions.push(filterMediumuntoggle);

  const filterLowtoggle = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.filterLow_toggle`,
    async (item: ast.TreeItem) => {
      logs.log("Info", "Filtering low results");
      astResultsProvider.issueLevel =
        (await astResultsProvider.issueLevel.includes(ast.IssueLevel.low))
          ? astResultsProvider.issueLevel.filter((x) => {
              return x !== ast.IssueLevel.low;
            })
          : astResultsProvider.issueLevel.concat([ast.IssueLevel.low]);
      await astResultsProvider.refreshData(LOW_FILTER);
    }
  );
  context.subscriptions.push(filterLowtoggle);

  const filterLowuntoggle = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.filterLow_untoggle`,
    async (item: ast.TreeItem) => {
      logs.log("Info", "Filtering low results");
      astResultsProvider.issueLevel =
        (await astResultsProvider.issueLevel.includes(ast.IssueLevel.low))
          ? astResultsProvider.issueLevel.filter((x) => {
              return x !== ast.IssueLevel.low;
            })
          : astResultsProvider.issueLevel.concat([ast.IssueLevel.low]);
      await astResultsProvider.refreshData(LOW_FILTER);
    }
  );
  context.subscriptions.push(filterLowuntoggle);

  const filterInfotoggle = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.filterInfo_toggle`,
    (item: ast.TreeItem) => {
      logs.log("Info", "Filtering info results");
      astResultsProvider.issueLevel = astResultsProvider.issueLevel.includes(
        ast.IssueLevel.info
      )
        ? astResultsProvider.issueLevel.filter((x) => {
            return x !== ast.IssueLevel.info;
          })
        : astResultsProvider.issueLevel.concat([ast.IssueLevel.info]);
      astResultsProvider.refreshData(INFO_FILTER);
    }
  );
  context.subscriptions.push(filterInfotoggle);

  const filterInfountoggle = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.filterInfo_untoggle`,
    (item: ast.TreeItem) => {
      logs.log("Info", "Filtering info results");
      astResultsProvider.issueLevel = astResultsProvider.issueLevel.includes(
        ast.IssueLevel.info
      )
        ? astResultsProvider.issueLevel.filter((x) => {
            return x !== ast.IssueLevel.info;
          })
        : astResultsProvider.issueLevel.concat([ast.IssueLevel.info]);
      astResultsProvider.refreshData(INFO_FILTER);
    }
  );
  context.subscriptions.push(filterInfountoggle);

  // Webview detailsPanel needs to be global in order to check if there was one open or not
  var detailsPanel: vscode.WebviewPanel | undefined = undefined;
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
      if (detailsPanel) {
        detailsPanel.reveal(vscode.ViewColumn.Two);
        detailsPanel.title =
          "(" + result.severity + ") " + result.label.replaceAll("_", " ");
      } else {
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
      }
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

      detailsPanel.webview.html = detailsDetachedView.getDetailsWeviewContent(
        detailsPanel.webview,
        result.getIcon().replace(__dirname, "")
      );
    }
  );
  context.subscriptions.push(newDetails);


  const clearAll = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.clear`,
    () => {
      logs.log("Info", "Clear all loaded information");
      // Clean results.json
      //astResultsProvider.clean();
      // Clean the results tree
      //vscode.commands.executeCommand("ast-results.cleanTree");
      // Get the project web view
      //let project = projectView.getWebView();
      // Send the clear id indication to the web view
      //project?.webview.postMessage({ instruction: "clear ID" });
    }
  );
  context.subscriptions.push(clearAll);

  // New pickers 

  vscode.commands.registerCommand(`${EXTENSION_NAME}.generalPick`, async () => {multiStepInput(context);});

	// Quick pick project 
	vscode.commands.registerCommand(`${EXTENSION_NAME}.projectPick`, async () => {
		const projectList = await getProjectList();
    const projectListPickItem = projectList.map((label) => ({label: label.Name, id:  label.ID }));
		const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
		quickPick.items = projectListPickItem;
		quickPick.onDidChangeSelection(([label]) => {
      var i = new Item();
      i.name =  label.label?label.label:"";
      i.id = label.id?label.id:"";
			updateProjectId(context, i);
			updateBranchId(context, new Item());
			updateScanId(context, new Item());
		  astResultsProvider.refresh();
		  	quickPick.hide();
		});
		quickPick.show();
	});

	// Quick pick branch 
	vscode.commands.registerCommand(`${EXTENSION_NAME}.branchPick`, async () => {
		let projectId = getProjectId(context).id;
    const branches = await getBranches(projectId);
    const branchesPickList = branches.map(label => ({ label: label, id: label }));
		//adicionar o selectionado
		const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
		quickPick.items = branchesPickList;
		quickPick.onDidChangeSelection(([label]) => {
      var i = new Item();
      i.name =  label.label?label.label:"";
      i.id = label.id?label.id:"";
			updateBranchId(context, i);
			updateScanId(context, new Item);
			astResultsProvider.refresh();
		  	quickPick.hide();
		});
		quickPick.show();
	});

	// Quick pick scan
	vscode.commands.registerCommand(`${EXTENSION_NAME}.scanPick`, async () => {
		const projectList = await getScans(getProjectId(context).id,getBranchId(context).name);
		const projectListPickItem = projectList.map((label) => ({label: label.CreatedAt, id:  label.ID }));
		// add selected
		const quickPick = vscode.window.createQuickPick<CxQuickPickItem>();
		quickPick.items = projectListPickItem;
		quickPick.onDidChangeSelection(([label]) => {
      var i = new Item();
      i.name =  label.label?label.label:"";
      i.id = label.id?label.id:"";
			updateScanId(context, i);
			getResults(label.id?label.id:"");
			astResultsProvider.refresh();
		  quickPick.hide();
		});
		quickPick.show();
	});
	
}

export function deactivate() {}
