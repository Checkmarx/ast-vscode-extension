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
        this._risksManagementService = RisksManagementService.getInstance(this.context);
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
        const webview = this._view.webview;
        if (!project && !scan) {
            this._view.webview.html = this.getWebviewContent(webview, undefined, undefined, false);
            return;

        }
        const isLatestScan = await this._risksManagementService.checkIfLatestScan(project.id, scan.id);
        const projectToDisplay = exctarctData(project.name, "Project:");
        const scanToDisplay = exctarctData(scan.displayScanId, "Scan:");
        const riskManagementResults = await this._risksManagementService.getRiskManagementResults(project.id, scanToDisplay);

        this._view.webview.html = this.getWebviewContent(webview, projectToDisplay, scanToDisplay, isLatestScan, riskManagementResults);
            this._view.webview.postMessage({
                command: 'getRiskManagementResults',
                data: riskManagementResults
            });
    }
    private setWebUri(...paths: string[]): vscode.Uri {
        return this._view.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, ...paths)
        );
    }

    private getWebviewContent(webview: vscode.Webview, projectName: string, scan: string, isLatestScan: boolean, applications: { applicationNameIDMap: any[] }): string {
        const styleResetUri = this.setWebUri("media", "reset.css");
        const styleVSCodeUri = this.setWebUri("media", "vscode.css");
        const styleMainUri = this.setWebUri("media", "main.css");
        const scriptUri = this.setWebUri("media", "risksManagement.js");
        const styleUri = this.setWebUri("media", "risksManagement.css");
        const unionIcon = this.setWebUri("media", "icons", "union.svg");
        const styleBootStrap = this.setWebUri(
            "media",
            "bootstrap",
            "bootstrap.min.css"
        );
        const scriptBootStrap = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "bootstrap", "bootstrap.min.js")
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
	<link href="https://microsoft.github.io/vscode-codicons/dist/codicon.css" rel="stylesheet">

	<title>Risks Management</title>
</head>

<body>
	${!projectName && !scan ? `<div>
		No project selected.
	</div>` :
	`${!isLatestScan ? `<div>
		ASPM results are only available for latest scan.
	</div>` :
	`<div class="ditales" data-bs-toggle="tooltip" data-bs-placement="top"
		title="You can show ASPM data for a different project by changing the selection in the Checkmarx One Results section above.">

		<div class="ellipsis"><i class="codicon codicon-project"></i>Project: ${projectName ?? ""}</div>
		<div class="ellipsis"><i class="codicon codicon-shield"></i>Scan ID: ${scan ?? ""}
	</div>
	</div>
	<div class="app-header">
		<img src="${unionIcon}"/> ${applications.applicationNameIDMap.length} Applications
	</div>
	<div class="accordion" id="applicationsContainer"></div>
	`}`}
	<script nonce="${nonce}" src="${scriptUri}">
		const vscode = acquireVsCodeApi();
	</script>
	<script nonce="${nonce}" src="${scriptBootStrap}"></script>

</body>

</html>`;
    }
}

function exctarctData(input: string, prefix: string) {
    const trimmed = input.substring(prefix.length).trim();
    return trimmed.split(/\s+/)[0];
}

