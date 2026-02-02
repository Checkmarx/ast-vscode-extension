import * as vscode from 'vscode';
import * as path from 'path';
import { RemediationFileManager, RemediationEntry } from '../../realtimeScanners/common/remediationFileManager';
import { commands } from '../../utils/common/commands';

// Virtual document content provider for diff views
class DiffContentProvider implements vscode.TextDocumentContentProvider {
    private static instance: DiffContentProvider;
    private contentMap = new Map<string, string>();
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    static getInstance(): DiffContentProvider {
        if (!DiffContentProvider.instance) {
            DiffContentProvider.instance = new DiffContentProvider();
        }
        return DiffContentProvider.instance;
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        const content = this.contentMap.get(uri.toString());
        console.log(`[DiffContentProvider] Providing content for ${uri.toString()}: ${content ? content.length : 0} chars`);
        return content || '';
    }

    setContent(uri: vscode.Uri, content: string): void {
        console.log(`[DiffContentProvider] Setting content for ${uri.toString()}: ${content.length} chars`);
        this.contentMap.set(uri.toString(), content);
        this._onDidChange.fire(uri);
    }

    clearContent(uri: vscode.Uri): void {
        this.contentMap.delete(uri.toString());
    }
}

export class RemediationView {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private static providerRegistered = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        // Register the virtual document provider once
        if (!RemediationView.providerRegistered) {
            const provider = DiffContentProvider.getInstance();
            context.subscriptions.push(
                vscode.workspace.registerTextDocumentContentProvider('checkmarx-diff', provider)
            );
            RemediationView.providerRegistered = true;
        }
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
                    case 'generateBulkReport':
                        await this.generateBulkReport(message.ids);
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

        try {
            console.log('[ViewDiff] Remediation data:', {
                type: remediation.vulnerabilityType,
                filePath: remediation.filePath,
                originalCodeLength: remediation.originalCode?.length,
                fixedCodeLength: remediation.fixedCode?.length,
                originalCodePreview: remediation.originalCode?.substring(0, 100),
                fixedCodePreview: remediation.fixedCode?.substring(0, 100)
            });

            // Get file extension for proper syntax highlighting
            const ext = path.extname(remediation.filePath) || '.txt';
            const timestamp = Date.now();

            // Use query parameters for language hint instead of file extension in path
            // This prevents VSCode from treating it as a real file
            const language = ext.substring(1); // Remove the leading dot

            // Create virtual URIs using our custom scheme with language as query parameter
            const originalUri = vscode.Uri.parse(`checkmarx-diff://original/${timestamp}?lang=${language}`);
            const fixedUri = vscode.Uri.parse(`checkmarx-diff://fixed/${timestamp}?lang=${language}`);

            console.log('[ViewDiff] Created URIs:', {
                originalUri: originalUri.toString(),
                fixedUri: fixedUri.toString()
            });

            // Store content in the provider
            const provider = DiffContentProvider.getInstance();
            provider.setContent(originalUri, remediation.originalCode);
            provider.setContent(fixedUri, remediation.fixedCode);

            // Open the virtual documents first to ensure they're loaded
            const originalDoc = await vscode.workspace.openTextDocument(originalUri);
            const fixedDoc = await vscode.workspace.openTextDocument(fixedUri);

            // Execute diff command with the opened documents
            console.log('[ViewDiff] Executing vscode.diff command...');
            await vscode.commands.executeCommand(
                'vscode.diff',
                originalDoc.uri,
                fixedDoc.uri,
                `${remediation.title} - Diff`,
                { preview: true, preserveFocus: false }
            );
            console.log('[ViewDiff] Diff command executed successfully');

            // Clean up content after a delay
            setTimeout(() => {
                provider.clearContent(originalUri);
                provider.clearContent(fixedUri);
            }, 5000); // Keep content for 5 seconds to allow diff to load
        } catch (error) {
            console.error('[ViewDiff] Error:', error);
            vscode.window.showErrorMessage(`Failed to show diff: ${error}`);
        }
    }



    private async viewFlowDiagram(remediationId: string): Promise<void> {
        vscode.commands.executeCommand(commands.viewRemediationFlowDiagram, remediationId);
    }

    private async generateReport(remediationId: string): Promise<void> {
        vscode.commands.executeCommand(commands.generateRemediationReport, remediationId);
    }

    private async generateBulkReport(remediationIds: string[]): Promise<void> {
        if (!remediationIds || remediationIds.length === 0) {
            vscode.window.showWarningMessage('Please select at least one vulnerability to generate a report');
            return;
        }

        vscode.commands.executeCommand(commands.generateBulkRemediationReport, remediationIds);
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
                    <div class="header-actions">
                        <button data-action="refresh" class="refresh-btn">🔄 Refresh</button>
                    </div>
                </div>
                ${count > 0 ? `
                <div class="bulk-actions">
                    <div class="selection-controls">
                        <label class="checkbox-label">
                            <input type="checkbox" id="selectAll" class="select-all-checkbox">
                            <span>Select All</span>
                        </label>
                        <span id="selectionCount" class="selection-count">0 selected</span>
                    </div>
                    <button id="generateBulkReport" class="bulk-action-btn" disabled>
                        📄 Generate Report for Selected
                    </button>
                </div>
                ` : ''}
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
                <div class="col-checkbox"></div>
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
        const severityClass = remediation.severity.toLowerCase();
        const fileName = path.basename(remediation.filePath);
        const date = new Date(remediation.dateAdded).toLocaleDateString();

        return `
            <div class="table-row">
                <div class="col-checkbox">
                    <input type="checkbox" class="row-checkbox" data-id="${id}">
                </div>
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

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

