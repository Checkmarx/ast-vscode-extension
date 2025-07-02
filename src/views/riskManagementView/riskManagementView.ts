import * as vscode from "vscode";
import {
  getNonce,
  getResultsFilePath,
  readResultsFromFile,
} from "../../utils/utils";
import { riskManagementService } from "./riskManagementService";
import { getFromState, Item } from "../../utils/common/globalState";
import { commands } from "../../utils/common/commands";
import { AstResult } from "../../models/results";
import { constants } from "../../utils/common/constants";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
import { ICONS } from "./constants";
export class riskManagementView implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private riskManagementService: riskManagementService;
  private cxResults: CxResult[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.riskManagementService = riskManagementService.getInstance(
      this.context
    );
  }

  public async resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      this.handleMessage(message);
    });
    const resultJsonPath = getResultsFilePath();
    const scan = getFromState(this.context, constants.scanIdKey);
    this.cxResults = await readResultsFromFile(resultJsonPath, scan?.id);
    const project = getFromState(this.context, constants.projectIdKey);

    this.updateContent({ project, scan, cxResults: this.cxResults });
  }

  private async handleMessage(message: {
    command: string;
    result?: { hash: string, riskScore: number, severity: string, traits: { [key: string]: string } };
  }): Promise<void> {
    switch (message.command) {
      case "openVulnerabilityDetails": {
        const result = this.findResultByHash(message.result.hash, message.result.riskScore, message.result.severity, message.result.traits);
        if (result) {
          const astResult = new AstResult(result);
          await vscode.commands.executeCommand(commands.newDetails, astResult);
        } else {
          vscode.window.showErrorMessage("Result not found");
        }
        break;
      }
    }
  }

  private findResultByHash(hash: string, riskScore: number, severity1: string, traits: { [key: string]: string } = {}): CxResult | undefined {
    const result = this.cxResults.find((result) => result.alternateId === hash);
    if (result) {
      result.riskScore = riskScore;
      result.traits = traits;
      result.severity = severity1.toUpperCase();
    }
    return result;
  }

  public async updateContent(options?: {
    project?: Item;
    scan?: Item;
    cxResults?: CxResult[];
  }) {
    const { project, scan, cxResults } = options || {};

    if (!this.view) {
      return;
    }

    const errorIcon = this.setWebUri("media", "icons", "error.svg");
    const styleUri = this.setWebUri("media", "riskManagement.css");

    if (!(await this.isAuthenticated())) {
      this.showMessage(
        styleUri,
        "Authentication to Checkmarx One is required in order to get ASPM results"
      );
      return;
    }

    this.view.webview.postMessage({ command: "showLoader" });

    this.cxResults = cxResults;

    if (!project && !scan) {
      this.view.webview.html = this.getWebviewContent(
        undefined,
        undefined,
        false,
        {
          applicationNameIDMap: [],
          results: undefined,
        }
      );
      this.view.webview.postMessage({ command: "hideLoader" });
      return;
    }
    try {
      const isLatestScan = await this.riskManagementService.checkIfLatestScan(
        project.id,
        scan.id
      );
      const projectToDisplay = this.extractData(project.name, "Project:");
      const scanToDisplay = this.extractData(scan.displayScanId, "Scan:");
      const riskManagementResults =
        await this.riskManagementService.getRiskManagementResults(
          project.id,
          scan.id
        );
      this.view.webview.html = this.getWebviewContent(
        projectToDisplay,
        scanToDisplay,
        isLatestScan,
        riskManagementResults as { results: any; applicationNameIDMap: any[] }
      );
      this.view.webview.postMessage({
        command: "getRiskManagementResults",
        data: riskManagementResults,
      });
    } catch (error) {
      const notAvailableMessage =
        "Risk management results are currently unavailable for your tenant";
      if (error.message.includes(notAvailableMessage)) {
        this.showMessage(styleUri, notAvailableMessage);
        return;
      }
      this.showError(errorIcon, styleUri);
    } finally {
      this.view.webview.postMessage({ command: "hideLoader" });
    }
  }

  private extractData(input: string, prefix: string) {
    const trimmed = input.substring(prefix.length).trim();
    return trimmed.split(/\s+/)[0];
  }

  private showError(errorIcon: vscode.Uri, styleUri: vscode.Uri) {
    this.view.webview.html = `<!DOCTYPE html>
            <html>
            <head>
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
            <div class="error-message">
                <div>
                    <img src="${errorIcon}" alt="error" />
                </div>Failed to get the Checkmarx ASPM results
            </div>
            </body>
            </html>`;
  }

  private async isAuthenticated(): Promise<boolean> {
    const token = await this.context.secrets.get("authCredential");
    return !!token;
  }

  private showMessage(styleUri, message) {
    this.view.webview.html = `<!DOCTYPE html>
         <html>
           <head>
                 <link href="${styleUri}" rel="stylesheet">
           </head>
         <body>
             <div class="no-results-message">
                 ${message} 
             </div>
         </body>
         </html>`;
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
    ASPMResults: { results: any; applicationNameIDMap: any[] }
  ): string {
    const styleResetUri = this.setWebUri("media", "reset.css");
    const styleVSCodeUri = this.setWebUri("media", "vscode.css");
    const styleMainUri = this.setWebUri("media", "main.css");
    const scriptUri = this.setWebUri("media", "riskManagement.js");
    const styleUri = this.setWebUri("media", "riskManagement.css");
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
		<div id="riskManagementContainer">
			${
        !projectName || !scan || !isLatestScan
          ? `<div class="no-results-message">
				ASPM data is only shown when the most recent scan of a project is selected
				in the Checkmarx One Results tab
			</div>`
          : ASPMResults.applicationNameIDMap.length === 0
          ? `<div
				class="no-results-message">
				This project is not associated with any application in the ASPM
			</div>`
          : ASPMResults.applicationNameIDMap.length > 0 &&
            ASPMResults.results.length === 0
          ? `<div class="no-results-message">
				ASPM does not hold result data for this project
			</div>`
          : `<div class="ditales"
				data-bs-toggle="tooltip" data-bs-placement="auto"
				title="You can show ASPM data for a different project by changing the selection in the Checkmarx One Results section above.">

				<div class="ellipsis"><i class="codicon codicon-project"></i>Project:
					${projectName ?? ""}</div>
				<div class="ellipsis"><i class="codicon codicon-shield"></i>Scan ID: ${
          scan ?? ""
        }</div>
			</div>

			<hr class="separator" />
			<div class="app-header">
				<span>${ICONS.union}</span> ${ASPMResults.applicationNameIDMap.length}
				Applications
				  <div class="app-icons">
            <div class="sort-wrapper">
					<button class="sort-button" id="sortButton">
						<span>${ICONS.sort}</span>
						<span id="currentSort"></span>
					</button>
					<div class="sort-menu" id="sortMenu">
            <div class="sort-option sort-title">SORT BY</div>
						<div class="sort-option" data-sort="score">Aplication Risk Score</div>
						<div class="sort-option" data-sort="az">Aplication Name A-Z</div>
						<div class="sort-option" data-sort="za">Aplication Name Z-A</div>
					</div>
				</div>
        <hr class="separator-vertical" />

        <div class="sort-wrapper">
      <button class="filter-button" id="filterButton">
      <span class="center-badge">${ICONS.filter}</span>
      </button>
      <div class="filter-menu" id="filterMenu">
  <div class="filter-title-option">Showing</div>

  <div class="filter-category" data-toggle="vuln-type">
   <span class="chevron">›</span>
  <span class="category-label">Vulnerability Type</span>
   <span class="filter-count"></span>
</div>

  <div class="filter-submenu hidden" id="submenu-vuln-type"></div>

 <div class="filter-category" data-toggle="traits">
   <span class="chevron">›</span>
  <span class="category-label">Additional Trait</span>
   <span class="filter-count"></span>
</div>

  <div class="filter-submenu hidden" id="submenu-traits"></div>
</div>
    </div>
  </div>
</div>

			<div class="accordion" id="applicationsContainer"></div>
			`
      }</div>
		<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
</script>
		<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
		<script src=${popperUri}></script>
		<script nonce="${nonce}" src="${scriptBootStrap}"></script>
	</body>
</html>`;
  }
}
