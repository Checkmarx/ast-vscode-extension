import * as vscode from 'vscode';
import * as path from 'path';
import { IgnoreFileManager, IgnoreEntry } from '../../realtimeScanners/common/ignoreFileManager';

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
				const position = new vscode.Position(Math.max(0, line), 0);
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

	private updateStatusBar(): void {

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
					<img src="${this.getNoIgnoreVulIconPath()}" alt="No ignored vulnerabilities" class="empty-state-icon" />
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
				<div class="col-checkbox"></div>
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
		const iconName = this.getIconName(pkg.severity);
		const lastUpdated = this.getLastUpdated(pkg.dateAdded);
		const fileButtons = this.generateFileButtons(pkg.files);
		const scaIcon = pkg.type === 'ossScan' ? this.getScaIconPath() : '';
		const packageIcon = pkg.type === 'ossScan' ? this.getPackageIconPath(pkg.severity || 'medium') : '';
		const packageIconHover = pkg.type === 'ossScan' ? this.getPackageIconPath(pkg.severity || 'medium', true) : '';

		console.log(`Package ${packageKey}: dateAdded = ${pkg.dateAdded}, lastUpdated = ${lastUpdated}, type = ${pkg.type}`);

		return `
			<div class="table-row">
				<div class="col-checkbox">
					<input type="checkbox" />
				</div>
				${packageIcon ? `<div class="col-package-icon">
					<img src="${packageIcon}" alt="Package ${pkg.severity}" class="package-severity-icon-large" data-hover-src="${packageIconHover}" />
				</div>` : '<div class="col-package-icon"></div>'}
				<div class="col-risk">
					<div class="risk-content">
						<div class="package-line">
							<img src="${iconName}" alt="${pkg.severity}" class="severity-icon" />
							<div class="package-name">${packageKey}</div>
						</div>
						<div class="file-buttons-container">
							${scaIcon ? `<img src="${scaIcon}" alt="SCA" class="sca-icon" />` : ''}
							${fileButtons}
						</div>
					</div>
				</div>
				<div class="col-updated">${lastUpdated}</div>
				<div class="col-actions">
					<button class="revive-btn" onclick="revivePackage('${packageKey}')">
						<img src="${this.getReviveIconPath()}" alt="Revive" class="revive-icon" />
						Revive
					</button>
				</div>
			</div>
		`;
	}

	private getIconName(severity: string): string {
		const iconMap: Record<string, string> = {
			'critical': 'Vulnerability critical_ignore',
			'high': 'Vulnerability-high_ignore',
			'medium': 'Vulnerability-medium_ignore',
			'low': 'Vulnerability-low_ignore}',
			'malicious': 'Vulnerability_malicious_ignore'
		};

		const normalizedSeverity = severity?.toLowerCase();
		const iconFile = iconMap[normalizedSeverity] || 'Vulnerability-medium_ignore';



		const iconPath = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icons', 'ignorePage', `${iconFile}.svg`))
		);

		console.log(`[Icon Debug] Final icon URI: ${iconPath?.toString()}`);

		return iconPath?.toString() || '';
	}

	private getReviveIconPath(): string {
		const iconPath = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icons', 'ignorePage', 'arrow_ignore.svg'))
		);
		return iconPath?.toString() || '';
	}

	private getScaIconPath(): string {
		const iconPath = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icons', 'ignorePage', 'sca_ignore.svg'))
		);
		return iconPath?.toString() || '';
	}

	private getNoIgnoreVulIconPath(): string {
		const iconPath = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icons', 'ignorePage', 'no_ignore_vul.svg'))
		);
		return iconPath?.toString() || '';
	}

	private getPackageIconPath(severity: string, isHover: boolean = false): string {
		const normalizedSeverity = severity?.toLowerCase();
		const iconName = isHover ? `${normalizedSeverity}_hover` : normalizedSeverity;

		const iconPath = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icons', 'ignorePage', 'Packages', `${iconName}.svg`))
		);

		console.log(`[Package Icon Debug] Severity: "${severity}", Hover: ${isHover}, Path: ${iconPath?.toString()}`);
		return iconPath?.toString() || '';
	}

	private getRiskText(severity: string): string {
		if (severity?.toLowerCase() === 'malicious') {
			return 'malicious-package detected';
		}
		return `${severity}-risk package`;
	}

	private generateFileButtons(files: Array<{ path: string; active: boolean; line?: number }>): string {
		if (!files || files.length === 0) {
			return '';
		}

		const activeFiles = files.filter(file => file.active);
		if (activeFiles.length === 0) {
			return '';
		}

		const maxVisible = 1;
		const visibleFiles = activeFiles.slice(0, maxVisible);
		const remainingCount = activeFiles.length - maxVisible;

		const visibleButtons = visibleFiles
			.map(file => {
				const fileName = file.path.split('/').pop() || file.path;
				const fileIconUri = this.getGenericFileIconPath();
				return `<button class="file-btn" onclick="openFile('${file.path}', ${file.line || 1})" title="Go to ${file.path}:${file.line || 1}">
					<img src="${fileIconUri}" alt="File" class="file-icon" />
					${fileName}
				</button>`;
			})
			.join('');

		const hiddenButtons = activeFiles.slice(maxVisible)
			.map(file => {
				const fileName = file.path.split('/').pop() || file.path;
				const fileIconUri = this.getGenericFileIconPath();
				return `<button class="file-btn hidden-file-btn" onclick="openFile('${file.path}', ${file.line || 1})" title="Go to ${file.path}:${file.line || 1}">
					<img src="${fileIconUri}" alt="File" class="file-icon" />
					${fileName}
				</button>`;
			})
			.join('');

		const expandButton = remainingCount > 0
			? `<button class="expand-files-btn" onclick="expandFiles(this)">and ${remainingCount} more files</button>`
			: '';

		return `<div class="file-buttons">${visibleButtons}${expandButton}${hiddenButtons}</div>`;
	}

	private getLastUpdated(dateAdded: string | undefined): string {
		if (!dateAdded) {
			return 'Unknown';
		}

		try {
			const addedDate = new Date(dateAdded);
			const now = new Date();

			const addedDay = new Date(addedDate.getFullYear(), addedDate.getMonth(), addedDate.getDate());
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

			const diffMs = today.getTime() - addedDay.getTime();
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

			if (diffDays === 0) {
				return 'Today';
			} else if (diffDays === 1) {
				return '1 day ago';
			} else if (diffDays < 7) {
				return `${diffDays} days ago`;
			} else if (diffDays < 30) {
				const weeks = Math.floor(diffDays / 7);
				return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
			} else if (diffDays < 365) {
				const months = Math.floor(diffDays / 30);
				return months === 1 ? '1 month ago' : `${months} months ago`;
			} else {
				const years = Math.floor(diffDays / 365);
				return years === 1 ? '1 year ago' : `${years} years ago`;
			}
		} catch (error) {
			console.error('Error parsing date:', dateAdded, error);
			return 'Unknown';
		}
	}

	private getGenericFileIconPath(): string {
		const iconPath = this.panel?.webview.asWebviewUri(
			vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icons', 'ignorePage', 'genericFile.svg'))
		);
		return iconPath?.toString() || '';
	}


}