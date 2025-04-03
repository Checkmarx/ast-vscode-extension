import * as vscode from "vscode";
import { getNonce, getResultsFilePath, readResultsFromFile } from "../../utils/utils";
import { riskManagementService } from "./riskManagementService";
import { getFromState, Item } from "../../utils/common/globalState";
import { commands } from "../../utils/common/commands";
import { AstResult } from "../../models/results";
import { constants } from "../../utils/common/constants";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";
const ICONS = {
    sort: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.3518 2.978L7.7063 4.91299C7.83001 5.08973 7.70357 5.33258 7.48783 5.33258H6.66668V9.59873C6.66668 9.89328 6.42789 10.1321 6.13334 10.1321C5.83879 10.1321 5.60001 9.89328 5.60001 9.59873V5.33258H4.77885C4.56311 5.33258 4.43667 5.08973 4.56039 4.91299L5.91488 2.978C6.02104 2.82634 6.24564 2.82634 6.3518 2.978Z" fill="currentColor"/><path d="M9.86668 5.86643C9.57212 5.86643 9.33334 6.10522 9.33334 6.39977V10.6659H8.51218C8.29644 10.6659 8.17 10.9088 8.29372 11.0855L9.64821 13.0205C9.75437 13.1721 9.97898 13.1721 10.0851 13.0205L11.4396 11.0855C11.5633 10.9088 11.4369 10.6659 11.2212 10.6659H10.4V6.39977C10.4 6.10522 10.1612 5.86643 9.86668 5.86643Z" fill="currentColor"/></svg>`,
    union: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.19485 3.98089C0.676978 4.29161 0.67698 5.04216 1.19485 5.35288L7.58839 9.189C7.84174 9.34101 8.15824 9.34101 8.41158 9.189L14.8051 5.35288C15.323 5.04216 15.323 4.29161 14.8051 3.98089L8.41158 0.144767C8.15824 -0.00724038 7.84174 -0.00723996 7.58839 0.144768L1.19485 3.98089ZM3.14133 4.66689L7.99999 7.58208L12.8586 4.66689L7.99999 1.75169L3.14133 4.66689Z" fill="currentColor"/><path d="M1.83902 7.38471C1.62022 7.25042 1.34453 7.25042 1.12572 7.38471C0.692151 7.6508 0.692151 8.28083 1.12572 8.54693L7.581 12.5088C7.83773 12.6663 8.1612 12.6663 8.41793 12.5088L14.8732 8.54693C15.3068 8.28083 15.3068 7.6508 14.8732 7.38471C14.6544 7.25042 14.3787 7.25042 14.1599 7.38471L8.41793 10.9088C8.1612 11.0663 7.83773 11.0663 7.581 10.9088L1.83902 7.38471Z" fill="currentColor"/><path d="M1.12055 10.7513C1.33927 10.6172 1.61471 10.6172 1.83343 10.7513L7.58474 14.2765C7.84127 14.4338 8.16434 14.4338 8.42088 14.2765L14.1722 10.7513C14.3909 10.6172 14.6664 10.6172 14.8851 10.7513C15.3192 11.0174 15.3192 11.6482 14.8851 11.9143L8.42088 15.8765C8.16434 16.0338 7.84127 16.0338 7.58474 15.8765L1.12055 11.9143C0.68638 11.6482 0.68638 11.0174 1.12055 10.7513Z" fill="currentColor"/></svg>`
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

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
    ) {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(async (message) => {this.handleMessage(message); });
        const resultJsonPath = getResultsFilePath();
        const scan = getFromState(this.context, constants.scanIdKey);
        this.cxResults = await readResultsFromFile(resultJsonPath, scan?.id);
        const projectItem = getFromState(this.context, constants.projectIdKey);

        this.updateContent(projectItem, scan, this.cxResults);
    }

    private async handleMessage(message: { command: string; result?: { hash: string; engine: string } }): Promise<void> {
        switch (message.command) {
            case 'openVulnerabilityDetails': {
                const hash = message.result.hash;
                const type = message.result.engine;
                const result = this.findResultByHash(hash, type);
                if (result) {
                    const astResult = new AstResult(result);
                    await vscode.commands.executeCommand(
                        commands.newDetails,
                        astResult
                    );
                } else {
                    vscode.window.showErrorMessage('Result not found');
                }
                break;
            }
        }
    }

    private findResultByHash(hash: string, type: string): CxResult | undefined {

        if (type === constants.sast) {
            return this.cxResults.find(result => result.data.resultHash === hash);
        }
    }

    public async updateContent(project?: Item, scan?: Item, cxResults?: CxResult[]) {
        if (!this.view) {
            return;
        }

        const errorIcon = this.setWebUri("media", "icons", "error.svg");
        const styleUri = this.setWebUri("media", "riskManagement.css");

        if (!(await this.isAuthenticated())) {
            this.showAuthError(styleUri);
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
                    results: undefined
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
                await this.riskManagementService.getRiskManagementResults(project.id);
            this.view.webview.html = this.getWebviewContent(
                projectToDisplay,
                scanToDisplay,
                isLatestScan,
                riskManagementResults as { results: any; applicationNameIDMap: any[]; }
            );
            this.view.webview.postMessage({
                command: "getRiskManagementResults",
                data: riskManagementResults,
            });
        } catch (error) {
            this.showError(errorIcon, styleUri);
            ;
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

    private showAuthError(styleUri) {
        this.view.webview.html = `<!DOCTYPE html>
         <html>
           <head>
                 <link href="${styleUri}" rel="stylesheet">
           </head>
         <body>
             <div class="no-results-message">
                 Authentication to Chrckmarx One is required in order to get ASPM results 
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
        ASPMResults: { results: any; applicationNameIDMap: any[]; }
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
			${!projectName || !scan || !isLatestScan ? `<div class="no-results-message">
				ASPM data is only shown when the most recent scan of a project is selected
				in the Checkmarx One Results tab
			</div>` :
			ASPMResults.applicationNameIDMap.length === 0 ? `<div
				class="no-results-message">
				This project is not associated with any application in the ASPM
			</div>` :
			ASPMResults.applicationNameIDMap.length > 0 && ASPMResults.results.length ===
			0 ? `<div class="no-results-message">
				ASPM does not hold result data for this project
			</div>` :
			`<div class="ditales"
				data-bs-toggle="tooltip" data-bs-placement="auto"
				title="You can show ASPM data for a different project by changing the selection in the Checkmarx One Results section above.">

				<div class="ellipsis"><i class="codicon codicon-project"></i>Project:
					${projectName ?? ""
					}</div>
				<div class="ellipsis"><i class="codicon codicon-shield"></i>Scan ID: ${scan
					?? ""
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
				<span>${ICONS.union}</span> ${ASPMResults.applicationNameIDMap.length}
				Applications
				<hr class="separator-vertical" />
				<div class="sort-menu-container">
					<button class="sort-button" id="sortButton">
						<span>${ICONS.sort}</span>
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
