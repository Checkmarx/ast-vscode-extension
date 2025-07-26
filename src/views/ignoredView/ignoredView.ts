import * as vscode from 'vscode';
import * as path from 'path';
import { IgnoreFileManager, IgnoreEntry } from '../../realtimeScanners/common/ignoreFileManager';
import * as ignoredViewUtils from './ignoredViewUtils';
import { constants } from '../../utils/common/constants';

export class IgnoredView {
	private panel: vscode.WebviewPanel | undefined;
	private context: vscode.ExtensionContext;
	private autoRefreshTimer: NodeJS.Timeout | undefined;
	private lastRefreshDate: string;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.lastRefreshDate = new Date().toDateString();
	}

	public show(): void {
		const ignoreManager = IgnoreFileManager.getInstance();
		ignoreManager.setUiRefreshCallback(() => {
			this.refresh();
		});

		if (this.panel) {
			this.panel.reveal();
			this.checkAndRefreshIfDateChanged();
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'ignoredPackages',
			'Ignored Vulnerabilities',
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

		this.startAutoRefresh();

		this.panel.onDidDispose(() => {
			this.panel = undefined;
			this.stopAutoRefresh();
			const ignoreManager = IgnoreFileManager.getInstance();
			ignoreManager.setUiRefreshCallback(undefined);
		});

		this.panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'refresh':
						this.refresh();
						break;
					case 'revive':
						this.revivePackage(message.packageKey);
						break;
					case 'reviveMultiple':
						this.reviveMultiplePackages(message.packageKeys);
						break;
					case 'openFile':
						this.openFile(message.filePath, message.line);
						break;
				}
			}
		);
	}

	private startAutoRefresh(): void {
		this.scheduleNextDayRefresh();
	}

	private scheduleNextDayRefresh(): void {
		const now = new Date();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);

		const msUntilTomorrow = tomorrow.getTime() - now.getTime();

		console.log(`Next refresh scheduled in ${Math.round(msUntilTomorrow / 1000 / 60)} minutes (at ${tomorrow.toLocaleString()})`);

		this.autoRefreshTimer = setTimeout(() => {
			this.onDayChanged();
		}, msUntilTomorrow);
	}

	private onDayChanged(): void {
		console.log('Day changed - refreshing ignored view with updated dates');
		this.lastRefreshDate = new Date().toDateString();
		this.refresh();

		this.scheduleNextDayRefresh();
	}

	private stopAutoRefresh(): void {
		if (this.autoRefreshTimer) {
			clearTimeout(this.autoRefreshTimer);
			this.autoRefreshTimer = undefined;
		}
	}

	private checkAndRefreshIfDateChanged(): void {
		const currentDate = new Date().toDateString();
		if (currentDate !== this.lastRefreshDate) {
			console.log('Date changed detected - refreshing ignored view');
			this.lastRefreshDate = currentDate;
			this.refresh();

			this.stopAutoRefresh();
			this.startAutoRefresh();
		}
	}

	private refresh(): void {
		this.lastRefreshDate = new Date().toDateString();

		if (this.panel) {
			this.panel.webview.html = this.getWebviewContent();

			setTimeout(() => {
				const ignoreManager = IgnoreFileManager.getInstance();
				const packageCount = ignoreManager.getIgnoredPackagesCount();
				const hasPackages = packageCount > 0;

				this.panel?.webview.postMessage({
					command: 'updateButtonState',
					hasPackages: hasPackages
				});

				ignoreManager.updateStatusBar();
			}, 100);
		}
	}

	private async revivePackage(packageKey: string): Promise<void> {
		const ignoreManager = IgnoreFileManager.getInstance();

		try {
			const packageData = ignoreManager.getIgnoredPackagesData()[packageKey];
			const fileCount = packageData ? packageData.files.filter(file => file.active).length : 0;

			const success = ignoreManager.revivePackage(packageKey);

			if (success) {
				vscode.window.showInformationMessage(
					`'${packageKey}' vulnerability has been revived in ${fileCount} files.`,
					'Close',
					'Undo'
				);

				setTimeout(async () => {
					await ignoreManager.triggerActiveChangesDetection();
					this.refresh();
				}, 100);

			} else {
				vscode.window.showErrorMessage(`Package ${packageKey} not found in ignored list`);
			}
		} catch (error) {
			console.error('Error reviving package:', error);
			vscode.window.showErrorMessage(`Failed to revive package: ${error}`);
		}
	}

	private async reviveMultiplePackages(packageKeys: string[]): Promise<void> {
		const ignoreManager = IgnoreFileManager.getInstance();

		try {
			let totalSuccesses = 0;
			let totalFileCount = 0;
			const failedPackages: string[] = [];

			for (const packageKey of packageKeys) {
				const packageData = ignoreManager.getIgnoredPackagesData()[packageKey];
				const fileCount = packageData ? packageData.files.filter(file => file.active).length : 0;

				const success = ignoreManager.revivePackage(packageKey);

				if (success) {
					totalSuccesses++;
					totalFileCount += fileCount;
				} else {
					failedPackages.push(packageKey);
				}
			}

			if (totalSuccesses > 0) {
				const message = totalSuccesses === 1
					? `1 vulnerability has been revived in ${totalFileCount} files.`
					: `${totalSuccesses} vulnerabilities have been revived in ${totalFileCount} files.`;

				vscode.window.showInformationMessage(message, 'Close');

				setTimeout(async () => {
					await ignoreManager.triggerActiveChangesDetection();
					this.refresh();
				}, 100);
			}

			if (failedPackages.length > 0) {
				vscode.window.showErrorMessage(`Failed to revive: ${failedPackages.join(', ')}`);
			}

		} catch (error) {
			console.error('Error reviving packages:', error);
			vscode.window.showErrorMessage(`Failed to revive packages: ${error}`);
		}
	}

	private async openFile(filePath: string, line: number): Promise<void> {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}

			const fullPath = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, filePath));

			try {
				const document = await vscode.workspace.openTextDocument(fullPath);
				const editor = await vscode.window.showTextDocument(document);
				const position = new vscode.Position(Math.max(0, line - 1), 0);
				editor.selection = new vscode.Selection(position, position);
				editor.revealRange(new vscode.Range(position, position));
			} catch (error) {
				console.error('Error opening file:', error);
				vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
			}
		} catch (error) {
			console.error('Error in openFile:', error);
			vscode.window.showErrorMessage(`Failed to open file: ${error}`);
		}
	}



	private getWebviewContent(): string {
		const ignoreManager = IgnoreFileManager.getInstance();


		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			ignoreManager.initialize(vscode.workspace.workspaceFolders[0]);
		}

		const ignoredPackages = ignoreManager.getIgnoredPackagesData();


		console.log('Ignored packages data:', ignoredPackages);


		const ignoreManagerInstance = IgnoreFileManager.getInstance();
		const packageCount = ignoreManagerInstance.getIgnoredPackagesCount();
		const hasPackages = packageCount > 0;

		const cssUri = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'ignoredView.css'))
		);

		const jsUri = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'ignoredView.js'))
		);

		const refreshIconUri = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icons', 'ignorePage', 'refresh_ignore.svg'))
		);

		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Ignored Vulnerabilities</title>
				<link rel="stylesheet" href="${cssUri}">
			</head>
			<body>
				<div class="container">
					<div class="header">
						<div class="header-left">
							<h1>Ignored Vulnerabilities (${packageCount})</h1>
							<p class="subtitle">Manage and review vulnerabilities that have been marked as ignored</p>
							<div class="selection-bar" id="selection-bar" style="display: none;">
								<div class="selection-info">
									<span id="selection-count">0 Risks selected</span>
									<div class="divider"></div>
									<button class="clear-selections-btn" onclick="clearAllSelections()">
										<img src="${ignoredViewUtils.getCloseIconPath(this.panel!.webview, this.context.extensionPath)}" alt="Close" class="close-icon" />
										Clear Selections
									</button>
								</div>
								<div class="bulk-actions">
									<button class="revive-all-btn" onclick="reviveAllSelected()">
										<img src="${ignoredViewUtils.getReviveIconPath(this.panel!.webview, this.context.extensionPath)}" alt="Revive" class="revive-icon" />
										Revive All
									</button>
								</div>
							</div>
						</div>
						<div class="header-right">
							<button class="refresh-btn ${!hasPackages ? 'disabled' : ''}" ${!hasPackages ? 'disabled' : ''} onclick="refresh()">
								<img src="${refreshIconUri}" alt="Refresh" class="refresh-icon" />
								Refresh
							</button>
						</div>
					</div>

					${this.generateTableContent(ignoredPackages)}
				</div>

								<script src="${jsUri}"></script>
			</body>
			</html>
		`;
	}

	private generateTableContent(ignoredPackages: Record<string, IgnoreEntry>): string {
		const packageKeys = Object.keys(ignoredPackages);

		if (packageKeys.length === 0) {
			return `
				<div class="empty-state">
					<img src="${ignoredViewUtils.getNoIgnoreVulIconPath(this.panel!.webview, this.context.extensionPath)}" alt="No ignored vulnerabilities" class="empty-state-icon" />
					<div class="empty-state-text">No Ignored Vulnerabilities</div>
				</div>
			`;
		}

		const rows = packageKeys.map(packageKey => {
			const pkg = ignoredPackages[packageKey];
			return this.generateTableRow(packageKey, pkg);
		}).join('');

		return `
			<div class="table-header">
				<div class="col-checkbox">
					<input type="checkbox" id="master-checkbox" onchange="toggleMasterCheckbox(this)" />
				</div>
				<div class="col-package-icon"></div>
				<div class="col-risk">Risk</div>
				<div class="col-updated">Last updated</div>
				<div class="col-actions"></div>
			</div>
			<div class="table-body">
				${rows}
			</div>
		`;
	}

	private generateTableRow(packageKey: string, pkg: IgnoreEntry): string {
		const webview = this.panel!.webview;
		const extensionPath = this.context.extensionPath;

		const iconName = ignoredViewUtils.getIconName(pkg.severity, webview, extensionPath);
		const lastUpdated = ignoredViewUtils.getLastUpdated(pkg.dateAdded);
		const fileButtons = ignoredViewUtils.generateFileButtons(pkg.files, webview, extensionPath);
		const scaIcon = pkg.type === constants.ossRealtimeScannerEngineName ? ignoredViewUtils.getScaIconPath(webview, extensionPath) : '';
		const secretsIcon = pkg.type === constants.secretsScannerEngineName ? ignoredViewUtils.getSecretsIgnoreIconPath(webview, extensionPath) : '';

		const packageIcon = pkg.type === constants.ossRealtimeScannerEngineName
			? ignoredViewUtils.getPackageIconPath(pkg.severity || 'medium', webview, extensionPath)
			: pkg.type === constants.secretsScannerEngineName
				? ignoredViewUtils.getSecretsIconPath(pkg.severity || 'medium', webview, extensionPath)
				: '';

		const packageIconHover = pkg.type === constants.ossRealtimeScannerEngineName
			? ignoredViewUtils.getPackageIconPath(pkg.severity || 'medium', webview, extensionPath, true)
			: pkg.type === constants.secretsScannerEngineName
				? ignoredViewUtils.getSecretsIconPath(pkg.severity || 'medium', webview, extensionPath, true)
				: '';

		const displayName = ignoredViewUtils.formatPackageDisplayName(packageKey, pkg.type);

		return `
			<div class="table-row">
				<div class="col-checkbox">
					<input type="checkbox" class="row-checkbox" data-package-key="${packageKey}" onchange="updateMasterCheckbox()" />
				</div>
				${packageIcon ? `<div class="col-package-icon">
					<img src="${packageIcon}" alt="Package ${pkg.severity}" class="package-severity-icon-large" data-hover-src="${packageIconHover}" />
				</div>` : '<div class="col-package-icon"></div>'}
				<div class="col-risk">
					<div class="risk-content">
						<div class="package-line">
							<img src="${iconName}" alt="${pkg.severity}" class="severity-icon" />
							<div class="package-name">${displayName}</div>
						</div>
						<div class="file-buttons-container">
							${scaIcon ? `<img src="${scaIcon}" alt="SCA" class="sca-icon" />` : ''}
							${secretsIcon ? `<img src="${secretsIcon}" alt="Secrets" class="secrets-icon" />` : ''}
							${fileButtons}
						</div>
					</div>
				</div>
				<div class="col-updated">${lastUpdated}</div>
				<div class="col-actions">
					<div class="tooltip revive-btn-tooltip">
						<button class="revive-btn" onclick="revivePackage('${packageKey}')">
							<img src="${ignoredViewUtils.getReviveIconPath(webview, extensionPath)}" alt="Revive" class="revive-icon" />
							Revive
						</button>
						<span class="tooltiptext">Revive this vulnerability in all affected files</span>
					</div>
				</div>
			</div>
		`;
	}


}