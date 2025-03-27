import * as vscode from "vscode";
import { getNonce } from "../../utils/utils";
import { RisksManagementService } from "./risksManagementService";
import { Item } from "../../utils/common/globalState";

export class RisksManagementView implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _risksManagementService: RisksManagementService;
    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        this._risksManagementService = RisksManagementService.getInstance(
            this.context
        );
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        this.updateContent();
    }

    public async updateContent(project?: Item, scan?: Item) {
        if (!this._view) {
            return;
        }
        this._view.webview.postMessage({ command: "showLoader" });

        if (!project && !scan) {
            this._view.webview.html = this.getWebviewContent(
                undefined,
                undefined,
                false,
                { applicationNameIDMap: [] }
            );
            this._view.webview.postMessage({ command: "hideLoader" });
            return;
        }
        try {
            const isLatestScan = await this._risksManagementService.checkIfLatestScan(
                project.id,
                scan.id
            );
            const projectToDisplay = exctarctData(project.name, "Project:");
            const scanToDisplay = exctarctData(scan.displayScanId, "Scan:");
            const riskManagementResults =
                await this._risksManagementService.getRiskManagementResults(project.id);

            this._view.webview.html = this.getWebviewContent(
                projectToDisplay,
                scanToDisplay,
                isLatestScan,
                riskManagementResults as { applicationNameIDMap: any[] }
            );
            this._view.webview.postMessage({
                command: "getRiskManagementResults",
                data: riskManagementResults,
            });
            console.log(riskManagementResults);
        } catch (error) {
            console.error(error);
            const errorIcon = this.setWebUri("media", "icons", "error.svg");
            const styleUri = this.setWebUri("media", "risksManagement.css");

            this._view.webview.html = `<!DOCTYPE html>
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
            this._view.webview.postMessage({ command: "hideLoader" });
        }

        //         case applicationNameIDMap not empty but result is empty ,display:
        //         ASPM does not hold result data for this project

        // case applicationNameIDMap empty ,display:
        //         this project is not assotiated with any application in the ASPM

    }
    private setWebUri(...paths: string[]): vscode.Uri {
        return this._view.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, ...paths)
        );
    }

    private getWebviewContent(
        projectName: string,
        scan: string,
        isLatestScan: boolean,
        applications: { applicationNameIDMap: any[] }
    ): string {
        const styleResetUri = this.setWebUri("media", "reset.css");
        const styleVSCodeUri = this.setWebUri("media", "vscode.css");
        const styleMainUri = this.setWebUri("media", "main.css");
        const scriptUri = this.setWebUri("media", "risksManagement.js");
        const styleUri = this.setWebUri("media", "risksManagement.css");
        const unionIcon = this.setWebUri("media", "icons", "union.svg");
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
		<img src="${unionIcon}"/> ${applications.applicationNameIDMap.length
                } Applications
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
