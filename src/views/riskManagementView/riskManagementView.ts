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
const ICONS = {
  sort: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.3518 2.978L7.7063 4.91299C7.83001 5.08973 7.70357 5.33258 7.48783 5.33258H6.66668V9.59873C6.66668 9.89328 6.42789 10.1321 6.13334 10.1321C5.83879 10.1321 5.60001 9.89328 5.60001 9.59873V5.33258H4.77885C4.56311 5.33258 4.43667 5.08973 4.56039 4.91299L5.91488 2.978C6.02104 2.82634 6.24564 2.82634 6.3518 2.978Z" fill="currentColor"/><path d="M9.86668 5.86643C9.57212 5.86643 9.33334 6.10522 9.33334 6.39977V10.6659H8.51218C8.29644 10.6659 8.17 10.9088 8.29372 11.0855L9.64821 13.0205C9.75437 13.1721 9.97898 13.1721 10.0851 13.0205L11.4396 11.0855C11.5633 10.9088 11.4369 10.6659 11.2212 10.6659H10.4V6.39977C10.4 6.10522 10.1612 5.86643 9.86668 5.86643Z" fill="currentColor"/></svg>`,
  union: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.19485 3.98089C0.676978 4.29161 0.67698 5.04216 1.19485 5.35288L7.58839 9.189C7.84174 9.34101 8.15824 9.34101 8.41158 9.189L14.8051 5.35288C15.323 5.04216 15.323 4.29161 14.8051 3.98089L8.41158 0.144767C8.15824 -0.00724038 7.84174 -0.00723996 7.58839 0.144768L1.19485 3.98089ZM3.14133 4.66689L7.99999 7.58208L12.8586 4.66689L7.99999 1.75169L3.14133 4.66689Z" fill="currentColor"/><path d="M1.83902 7.38471C1.62022 7.25042 1.34453 7.25042 1.12572 7.38471C0.692151 7.6508 0.692151 8.28083 1.12572 8.54693L7.581 12.5088C7.83773 12.6663 8.1612 12.6663 8.41793 12.5088L14.8732 8.54693C15.3068 8.28083 15.3068 7.6508 14.8732 7.38471C14.6544 7.25042 14.3787 7.25042 14.1599 7.38471L8.41793 10.9088C8.1612 11.0663 7.83773 11.0663 7.581 10.9088L1.83902 7.38471Z" fill="currentColor"/><path d="M1.12055 10.7513C1.33927 10.6172 1.61471 10.6172 1.83343 10.7513L7.58474 14.2765C7.84127 14.4338 8.16434 14.4338 8.42088 14.2765L14.1722 10.7513C14.3909 10.6172 14.6664 10.6172 14.8851 10.7513C15.3192 11.0174 15.3192 11.6482 14.8851 11.9143L8.42088 15.8765C8.16434 16.0338 7.84127 16.0338 7.58474 15.8765L1.12055 11.9143C0.68638 11.6482 0.68638 11.0174 1.12055 10.7513Z" fill="currentColor"/></svg>`,
  filter: `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6.00033 3.33338C5.82351 3.33338 5.65395 3.40362 5.52892 3.52864C5.4039 3.65367 5.33366 3.82324 5.33366 4.00005C5.33366 4.17686 5.4039 4.34643 5.52892 4.47145C5.65395 4.59648 5.82351 4.66671 6.00033 4.66671C6.17714 4.66671 6.34671 4.59648 6.47173 4.47145C6.59675 4.34643 6.66699 4.17686 6.66699 4.00005C6.66699 3.82324 6.59675 3.65367 6.47173 3.52864C6.34671 3.40362 6.17714 3.33338 6.00033 3.33338ZM4.11366 3.33338C4.25139 2.94302 4.50682 2.605 4.84473 2.36591C5.18263 2.12681 5.58638 1.99841 6.00033 1.99841C6.41427 1.99841 6.81802 2.12681 7.15593 2.36591C7.49383 2.605 7.74926 2.94302 7.88699 3.33338H12.667C12.8438 3.33338 13.0134 3.40362 13.1384 3.52864C13.2634 3.65367 13.3337 3.82324 13.3337 4.00005C13.3337 4.17686 13.2634 4.34643 13.1384 4.47145C13.0134 4.59648 12.8438 4.66671 12.667 4.66671H7.88699C7.74926 5.05707 7.49383 5.39509 7.15593 5.63419C6.81802 5.87328 6.41427 6.00168 6.00033 6.00168C5.58638 6.00168 5.18263 5.87328 4.84473 5.63419C4.50682 5.39509 4.25139 5.05707 4.11366 4.66671H3.33366C3.15685 4.66671 2.98728 4.59648 2.86225 4.47145C2.73723 4.34643 2.66699 4.17686 2.66699 4.00005C2.66699 3.82324 2.73723 3.65367 2.86225 3.52864C2.98728 3.40362 3.15685 3.33338 3.33366 3.33338H4.11366ZM10.0003 7.33338C9.82351 7.33338 9.65395 7.40362 9.52892 7.52864C9.4039 7.65367 9.33366 7.82324 9.33366 8.00005C9.33366 8.17686 9.4039 8.34643 9.52892 8.47145C9.65395 8.59648 9.82351 8.66671 10.0003 8.66671C10.1771 8.66671 10.3467 8.59648 10.4717 8.47145C10.5968 8.34643 10.667 8.17686 10.667 8.00005C10.667 7.82324 10.5968 7.65367 10.4717 7.52864C10.3467 7.40362 10.1771 7.33338 10.0003 7.33338ZM8.11366 7.33338C8.25139 6.94303 8.50682 6.605 8.84473 6.36591C9.18263 6.12681 9.58638 5.99841 10.0003 5.99841C10.4143 5.99841 10.818 6.12681 11.1559 6.36591C11.4938 6.605 11.7493 6.94303 11.887 7.33338H12.667C12.8438 7.33338 13.0134 7.40362 13.1384 7.52864C13.2634 7.65367 13.3337 7.82324 13.3337 8.00005C13.3337 8.17686 13.2634 8.34643 13.1384 8.47145C13.0134 8.59648 12.8438 8.66671 12.667 8.66671H11.887C11.7493 9.05707 11.4938 9.39509 11.1559 9.63419C10.818 9.87328 10.4143 10.0017 10.0003 10.0017C9.58638 10.0017 9.18263 9.87328 8.84473 9.63419C8.50682 9.39509 8.25139 9.05707 8.11366 8.66671H3.33366C3.15685 8.66671 2.98728 8.59648 2.86225 8.47145C2.73723 8.34643 2.66699 8.17686 2.66699 8.00005C2.66699 7.82324 2.73723 7.65367 2.86225 7.52864C2.98728 7.40362 3.15685 7.33338 3.33366 7.33338H8.11366ZM6.00033 11.3334C5.82351 11.3334 5.65395 11.4036 5.52892 11.5286C5.4039 11.6537 5.33366 11.8232 5.33366 12C5.33366 12.1769 5.4039 12.3464 5.52892 12.4715C5.65395 12.5965 5.82351 12.6667 6.00033 12.6667C6.17714 12.6667 6.34671 12.5965 6.47173 12.4715C6.59675 12.3464 6.66699 12.1769 6.66699 12C6.66699 11.8232 6.59675 11.6537 6.47173 11.5286C6.34671 11.4036 6.17714 11.3334 6.00033 11.3334ZM4.11366 11.3334C4.25139 10.943 4.50682 10.605 4.84473 10.3659C5.18263 10.1268 5.58638 9.99841 6.00033 9.99841C6.41427 9.99841 6.81802 10.1268 7.15593 10.3659C7.49383 10.605 7.74926 10.943 7.88699 11.3334H12.667C12.8438 11.3334 13.0134 11.4036 13.1384 11.5286C13.2634 11.6537 13.3337 11.8232 13.3337 12C13.3337 12.1769 13.2634 12.3464 13.1384 12.4715C13.0134 12.5965 12.8438 12.6667 12.667 12.6667H7.88699C7.74926 13.0571 7.49383 13.3951 7.15593 13.6342C6.81802 13.8733 6.41427 14.0017 6.00033 14.0017C5.58638 14.0017 5.18263 13.8733 4.84473 13.6342C4.50682 13.3951 4.25139 13.0571 4.11366 12.6667H3.33366C3.15685 12.6667 2.98728 12.5965 2.86225 12.4715C2.73723 12.3464 2.66699 12.1769 2.66699 12C2.66699 11.8232 2.73723 11.6537 2.86225 11.5286C2.98728 11.4036 3.15685 11.3334 3.33366 11.3334H4.11366Z" fill="currentColor" />
</svg>`,
};
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
    result?: { hash: string; engine: string };
  }): Promise<void> {
    switch (message.command) {
      case "openVulnerabilityDetails": {
        const hash = message.result.hash;
        const type = message.result.engine;
        const result = this.findResultByHash(hash, type);
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

  private findResultByHash(hash: string, type: string): CxResult | undefined {
    if (type === constants.sast) {
      return this.cxResults.find((result) => result.data.resultHash === hash);
    }
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
        "Authentication to Chrckmarx One is required in order to get ASPM results"
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
		<script nonce="${nonce}" src="${scriptUri}"></script>
		<script src=${popperUri}></script>
		<script nonce="${nonce}" src="${scriptBootStrap}"></script>
	</body>
</html>`;
  }
}
