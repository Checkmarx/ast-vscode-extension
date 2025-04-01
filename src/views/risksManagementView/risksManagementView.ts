import * as vscode from "vscode";
import { getNonce, getResultsFilePath, readResultsFromFile } from "../../utils/utils";
import { RisksManagementService } from "./risksManagementService";
import { getFromState, Item } from "../../utils/common/globalState";
import { commands } from "../../utils/common/commands";
import { AstResultsProvider } from "../resultsView/astResultsProvider";
import { AstResult } from "../../models/results";
import { constants } from "../../utils/common/constants";

export class RisksManagementView implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private risksManagementService: RisksManagementService;
    private cxResults: any;
    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        this.risksManagementService = RisksManagementService.getInstance(
            this.context
        );
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
    ) {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'openVulnerabilityDetails':
                    const hash = message.result.hash;
                    const type = message.result.engine;
                    const result = await this.findResultByHash(hash, type);
                    if (result) {
                        const astResult = new AstResult(result);
                        // if (!astResult || !astResult.typeLabel) {
                        //   return;
                        // }
                        await vscode.commands.executeCommand(
                            commands.newDetails,
                            astResult
                        );
                    } else {
                        vscode.window.showErrorMessage('Result not found');
                    }
                    break;
            }
        });
        const resultJsonPath = getResultsFilePath();
        const scan = getFromState(this.context, constants.scanIdKey);
        this.cxResults = await readResultsFromFile(resultJsonPath, scan?.id);
        const projectItem = getFromState(this.context, constants.projectIdKey);

        this.updateContent(projectItem, scan, this.cxResults);
    }

    

    private async findResultByHash(hash: string, type): Promise<any> {
        if (type === constants.sast) {
            return this.cxResults.find(result => result.data.resultHash === hash);
        }
        if (type === constants.kics) {
            return this.cxResults.find(result => result.id === hash);
        }
    }

    public async updateContent(project?: Item, scan?: Item, cxResults?: any) {
        if (!this.view) {
            return;
        }
        this.view.webview.postMessage({ command: "showLoader" });
        this.cxResults = cxResults;
        if (!project && !scan) {
            this.view.webview.html = this.getWebviewContent(
                undefined,
                undefined,
                false,
                { applicationNameIDMap: [] }
            );
            this.view.webview.postMessage({ command: "hideLoader" });
            return;
        }
        try {
            const isLatestScan = await this.risksManagementService.checkIfLatestScan(
                project.id,
                scan.id
            );
            const projectToDisplay = exctarctData(project.name, "Project:");
            const scanToDisplay = exctarctData(scan.displayScanId, "Scan:");
            const riskManagementResults =
                await this.risksManagementService.getRiskManagementResults(project.id);
if (riskManagementResults === undefined) {
    console.log("Error: No results found for the given project ID.");
    
                return;
    
}
            this.view.webview.html = this.getWebviewContent(
                projectToDisplay,
                scanToDisplay,
                isLatestScan,
                riskManagementResults as { applicationNameIDMap: any[] }
            );
            this.view.webview.postMessage({
                command: "getRiskManagementResults",
                data: riskManagementResults,
            });
            console.log(riskManagementResults);
        } catch (error) {
            console.error(error);
            const errorIcon = this.setWebUri("media", "icons", "error.svg");
            const styleUri = this.setWebUri("media", "risksManagement.css");

            this.view.webview.html = `<!DOCTYPE html>
            <html>
            <head>
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
                <div class="error-message">
                    <div>
                        <img src="${errorIcon}" alt="error" />
                    </div>feild to get the Checkmarx ASPM results
                </div>
            </body>
            </html>`;
        } finally {
            this.view.webview.postMessage({ command: "hideLoader" });
        }



    }
    private setWebUri(...paths: string[]): vscode.Uri {
        return this.view.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, ...paths)
        );
    }

    private getWebviewContent(
        projectName: string,
        scan: string,
        isLatestScan: boolean,
        ASPMResults: {
            results: any;
            applicationNameIDMap: any[]
        }
    ): string {
        const styleResetUri = this.setWebUri("media", "reset.css");
        const styleVSCodeUri = this.setWebUri("media", "vscode.css");
        const styleMainUri = this.setWebUri("media", "main.css");
        const scriptUri = this.setWebUri("media", "risksManagement.js");
        const styleUri = this.setWebUri("media", "risksManagement.css");
        const unionIcon = this.setWebUri("media", "icons", "union.svg");
        const sortIcon = this.setWebUri("media", "icons", "sort.svg");
        const codiconsUri = this.setWebUri(
            "node_modules",
            "@vscode/codicons",
            "dist",
            "codicon.css"
        );
        const popperUri = this.setWebUri(
            "node_modules",
            "@popperjs/core",
            "dist",
            "umd",
            "popper.min.js"
        );
        const styleBootStrap = this.setWebUri(
            "media",
            "bootstrap",
            "bootstrap.min.css"
        );
        const scriptBootStrap = this.setWebUri(
            "media",
            "bootstrap",
            "bootstrap.min.js"
        );
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleResetUri}" rel="stylesheet">
	<link href="${styleVSCodeUri}" rel="stylesheet">
	<link href="${styleMainUri}" rel="stylesheet">
	<link href="${styleBootStrap}" rel="stylesheet">
	<link href="${styleUri}" rel="stylesheet">
    <link rel="stylesheet" href="${codiconsUri}">

	<title>Risks Management</title>
</head>

<body>
 <div id="loading" class="loading">
		<div class="spinner-border" role="status">
		  <span class="visually-hidden">ASPM Results Loadind...</span>
		</div>
	  </div>
      <div id="risksManagementContainer">
	${!projectName || !scan || !isLatestScan ? `<div class="no-results-message">
		ASPM data is only shown when the most recent scan of a project is selected in the Checkmarx One Results tab
	</div>` :
                ASPMResults.applicationNameIDMap.length === 0 ? `<div class="no-results-message">
        This project is not associated with any application in the ASPM
    </div>` :
                    ASPMResults.applicationNameIDMap.length > 0 && ASPMResults.results.length === 0 ? `<div class="no-results-message">
        ASPM does not hold result data for this project
    </div>` :
                        `<div class="ditales"
    data-bs-toggle="tooltip" data-bs-placement="auto"
	title="You can show ASPM data for a different project by changing the selection in the Checkmarx One Results section above.">
	
		<div class="ellipsis"><i class="codicon codicon-project"></i>Project: ${projectName ?? ""
                        }</div>
		<div class="ellipsis"><i class="codicon codicon-shield"></i>Scan ID: ${scan ?? ""
                        }</div>
	</div>


 <hr class="separator" />
   <div class="filter-section">
  <div class="filter-title"><i class="codicon"></i>Vulnerability Type:</div>
  <div class="filter-buttons-wrapper">
    <div class="filter-buttons" id="typeFilters"></div>
  </div>
</div>
  
	<div class="app-header">
    <img src="${unionIcon}"/> ${ASPMResults.applicationNameIDMap.length} Applications
 <hr class="separator-vertical" />
    <div class="sort-menu-container">
        <button class="sort-button" id="sortButton">
            <img src="${sortIcon}"/>
            <span id="currentSort">Sort By: Score</span>
            <i class="codicon codicon-chevron-down"></i>
        </button>
        <div class="sort-menu" id="sortMenu">
            <div class="sort-option" data-sort="score">Aplication Risk Score</div>
            <div class="sort-option" data-sort="az">Aplication Name A-Z</div>
            <div class="sort-option" data-sort="za">Aplication Name Z-A</div>
        </div>
    </div>
</div>

	<div class="accordion" id="applicationsContainer"></div>
	`}</div>
	<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
</script>
<script nonce="${nonce}" src="${scriptUri}"></script>
<script src=${popperUri}></script>

	<script nonce="${nonce}" src="${scriptBootStrap}"></script>

</body>

</html>`;
    }
}

function exctarctData(input: string, prefix: string) {
    const trimmed = input.substring(prefix.length).trim();
    return trimmed.split(/\s+/)[0];
}
