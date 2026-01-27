import * as vscode from 'vscode';
import * as path from 'path';
import { RemediationFileManager, RemediationEntry } from '../../realtimeScanners/common/remediationFileManager';
import { commands } from '../../utils/common/commands';

export class RemediationView {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public show(): void {
        const remediationManager = RemediationFileManager.getInstance();
        remediationManager.setUiRefreshCallback(() => {
            this.refresh();
        });

        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'remediationView',
            'Fixed Vulnerabilities',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
                ]
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'viewDiff':
                        await this.viewDiff(message.id);
                        break;
                    case 'viewFlowDiagram':
                        await this.viewFlowDiagram(message.id);
                        break;
                    case 'generateReport':
                        await this.generateReport(message.id);
                        break;
                    case 'deleteRemediation':
                        await this.deleteRemediation(message.id);
                        break;
                    case 'refresh':
                        this.refresh();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private refresh(): void {
        if (this.panel) {
            this.panel.webview.html = this.getWebviewContent();
        }
    }

    private async viewDiff(remediationId: string): Promise<void> {
        const remediationManager = RemediationFileManager.getInstance();
        const remediations = remediationManager.getRemediationsData();
        const remediation = remediations[remediationId];

        if (!remediation) {
            vscode.window.showErrorMessage('Remediation not found');
            return;
        }

        // Create temporary files for diff view
        const originalUri = vscode.Uri.parse(`untitled:Original - ${remediation.title}`);
        const fixedUri = vscode.Uri.parse(`untitled:Fixed - ${remediation.title}`);

        const originalDoc = await vscode.workspace.openTextDocument(originalUri);
        const fixedDoc = await vscode.workspace.openTextDocument(fixedUri);

        const originalEdit = new vscode.WorkspaceEdit();
        originalEdit.insert(originalUri, new vscode.Position(0, 0), remediation.originalCode);
        await vscode.workspace.applyEdit(originalEdit);

        const fixedEdit = new vscode.WorkspaceEdit();
        fixedEdit.insert(fixedUri, new vscode.Position(0, 0), remediation.fixedCode);
        await vscode.workspace.applyEdit(fixedEdit);

        // Show diff
        await vscode.commands.executeCommand('vscode.diff', originalUri, fixedUri, `${remediation.title} - Diff`);
    }

    private async viewFlowDiagram(remediationId: string): Promise<void> {
        vscode.commands.executeCommand(commands.viewRemediationFlowDiagram, remediationId);
    }

    private async generateReport(remediationId: string): Promise<void> {
        vscode.commands.executeCommand(commands.generateRemediationReport, remediationId);
    }

    private async deleteRemediation(remediationId: string): Promise<void> {
        const result = await vscode.window.showWarningMessage(
            'Are you sure you want to delete this remediation record?',
            'Delete',
            'Cancel'
        );

        if (result === 'Delete') {
            const remediationManager = RemediationFileManager.getInstance();
            remediationManager.deleteRemediation(remediationId);
            this.refresh();
        }
    }

    private getWebviewContent(): string {
        const remediationManager = RemediationFileManager.getInstance();

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            remediationManager.initialize(vscode.workspace.workspaceFolders[0]);
        }

        const remediations = remediationManager.getRemediationsData();
        const count = remediationManager.getRemediationsCount();

        const cssUri = this.panel?.webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'remediationView.css'))
        );

        const jsUri = this.panel?.webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'remediationView.js'))
        );

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Fixed Vulnerabilities</title>
                <link rel="stylesheet" href="${cssUri}">
            </head>
            <body>
                <div class="header">
                    <h1>Fixed Vulnerabilities (${count})</h1>
                    <button data-action="refresh" class="refresh-btn">🔄 Refresh</button>
                </div>
                <div class="table-container">
                    ${this.generateTableContent(remediations)}
                </div>
                <script src="${jsUri}"></script>
            </body>
            </html>
        `;
    }

    private generateTableContent(remediations: Record<string, RemediationEntry>): string {
        const remediationKeys = Object.keys(remediations);

        if (remediationKeys.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div class="empty-state-text">No Fixed Vulnerabilities</div>
                    <div class="empty-state-subtext">Vulnerabilities fixed with Checkmarx One Assist will appear here</div>
                </div>
            `;
        }

        const rows = remediationKeys.map(key => {
            const remediation = remediations[key];
            return this.generateTableRow(key, remediation);
        }).join('');

        return `
            <div class="table-header">
                <div class="col-icon"></div>
                <div class="col-title">Title</div>
                <div class="col-type">Type</div>
                <div class="col-severity">Severity</div>
                <div class="col-file">File</div>
                <div class="col-date">Date</div>
                <div class="col-actions">Actions</div>
            </div>
            <div class="table-body">
                ${rows}
            </div>
        `;
    }

    private generateTableRow(id: string, remediation: RemediationEntry): string {
        const typeIcon = this.getTypeIcon(remediation.vulnerabilityType);
        const severityClass = remediation.severity.toLowerCase();
        const fileName = path.basename(remediation.filePath);
        const date = new Date(remediation.dateAdded).toLocaleDateString();

        return `
            <div class="table-row">
                <div class="col-icon">${typeIcon}</div>
                <div class="col-title">
                    <div class="title-text">${this.escapeHtml(remediation.title)}</div>
                    <div class="subtitle-text">Fixed with ${remediation.fixMethod}</div>
                </div>
                <div class="col-type">${remediation.vulnerabilityType.toUpperCase()}</div>
                <div class="col-severity">
                    <span class="severity-badge ${severityClass}">${remediation.severity}</span>
                </div>
                <div class="col-file" title="${this.escapeHtml(remediation.filePath)}">${this.escapeHtml(fileName)}</div>
                <div class="col-date">${date}</div>
                <div class="col-actions">
                    <button data-action="viewDiff" data-id="${id}" class="action-btn" title="View Diff">📊</button>
                    <button data-action="viewFlowDiagram" data-id="${id}" class="action-btn" title="Flow Diagram">🔀</button>
                    <button data-action="generateReport" data-id="${id}" class="action-btn" title="Generate Report">📄</button>
                    <button data-action="deleteRemediation" data-id="${id}" class="action-btn delete-btn" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }

    private getTypeIcon(type: string): string {
        const icons: Record<string, string> = {
            'oss': '📦',
            'secrets': '🔐',
            'containers': '🐳',
            'iac': '☁️',
            'asca': '🔍'
        };
        return icons[type] || '🔧';
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

