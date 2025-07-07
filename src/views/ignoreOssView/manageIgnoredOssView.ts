import * as vscode from 'vscode';
import { IgnoreFileManager } from '../../realtimeScanners/common/ignoreFileManager';
import { Logs } from '../../models/logs';

export class ManageIgnoredOssView implements vscode.TreeDataProvider<IgnoreItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<IgnoreItem | undefined | null | void> = new vscode.EventEmitter<IgnoreItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<IgnoreItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private ignoreFileManager: IgnoreFileManager;

	constructor(private context: vscode.ExtensionContext, private logs: Logs) {
		this.ignoreFileManager = IgnoreFileManager.getInstance(logs);
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: IgnoreItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: IgnoreItem): Thenable<IgnoreItem[]> {
		if (!element) {
			// Root level - show all ignored packages
			return this.getIgnoredPackages();
		} else if (element.contextValue === 'ignoredPackage') {
			// Show files for this package
			return this.getFilesForPackage(element.packageKey);
		}
		return Promise.resolve([]);
	}

	private async getIgnoredPackages(): Promise<IgnoreItem[]> {
		const ignoreData = this.ignoreFileManager.getIgnoreData();
		const packages: IgnoreItem[] = [];

		for (const [packageKey, entry] of Object.entries(ignoreData)) {
			const [packageName, version] = packageKey.split(':');
			const files = entry.files;

			const item = new IgnoreItem(
				`${packageName}@${version}`,
				vscode.TreeItemCollapsibleState.Collapsed,
				'ignoredPackage',
				packageKey
			);
			item.description = `${files.length} file(s)`;
			item.tooltip = `Package: ${packageName}@${version}\nIgnored in ${files.length} file(s)\nType: ${entry.type}`;
			packages.push(item);
		}


		if (packages.length === 0) {
			const emptyItem = new IgnoreItem(
				'No ignored packages',
				vscode.TreeItemCollapsibleState.None,
				'empty'
			);
			emptyItem.description = 'All packages are being scanned';
			return [emptyItem];
		}

		return packages;
	}

	private async getFilesForPackage(packageKey: string): Promise<IgnoreItem[]> {
		const ignoreData = this.ignoreFileManager.getIgnoreData();
		const entry = ignoreData[packageKey];

		if (!entry) {
			return [];
		}

		return entry.files.map(filePath => {
			const item = new IgnoreItem(
				filePath,
				vscode.TreeItemCollapsibleState.None,
				'ignoredFile',
				packageKey
			);
			item.tooltip = `Click to remove from ignore list`;
			item.command = {
				command: 'cx.removeIgnoredFile',
				title: 'Remove from ignore list',
				arguments: [packageKey, filePath]
			};
			return item;
		});
	}


	public registerCommands() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand('cx.removeIgnoredPackage', async (item: IgnoreItem | string) => {
				// Handle both cases: when called from context menu (gets IgnoreItem) or directly (gets string)
				const packageKey = typeof item === 'string' ? item : item?.packageKey;

				this.logs.info(`removeIgnoredPackage called with: ${typeof item === 'string' ? item : `IgnoreItem with packageKey: ${item?.packageKey}`}`);

				if (!packageKey) {
					this.logs.error('Invalid package information - packageKey is undefined');
					vscode.window.showErrorMessage('Invalid package information');
					return;
				}

				const result = await vscode.window.showWarningMessage(
					`Remove ${packageKey} from ignore list completely?`,
					'Yes',
					'No'
				);

				if (result === 'Yes') {
					if (this.ignoreFileManager.removeIgnoredPackage(packageKey)) {
						vscode.window.showInformationMessage(`${packageKey} removed from ignore list`);
						this.refresh();
					} else {
						vscode.window.showErrorMessage(`Failed to remove ${packageKey} from ignore list`);
					}
				}
			})
		);

		this.context.subscriptions.push(
			vscode.commands.registerCommand('cx.removeIgnoredFile', async (packageKey: string, filePath: string) => {
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('No workspace folder found');
					return;
				}

				const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, filePath).fsPath;
				if (this.ignoreFileManager.removeIgnoredPackage(packageKey, fullPath)) {
					vscode.window.showInformationMessage(`${packageKey} removed from ignore list for ${filePath}`);
					this.refresh();
				} else {
					vscode.window.showErrorMessage(`Failed to remove ${packageKey} from ignore list`);
				}
			})
		);

		this.context.subscriptions.push(
			vscode.commands.registerCommand('cx.refreshIgnoreList', () => {
				this.refresh();
			})
		);

		this.context.subscriptions.push(
			vscode.commands.registerCommand('cx.openIgnoreFile', async () => {
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('No workspace folder found');
					return;
				}

				const ignoreFileUri = vscode.Uri.joinPath(workspaceFolder.uri, '.checkmarxIgnored');
				try {
					await vscode.window.showTextDocument(ignoreFileUri);
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to open ignore file: ${error}`);
				}
			})
		);
	}
}

export class IgnoreItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string,
		public readonly packageKey?: string
	) {
		super(label, collapsibleState);
		this.contextValue = contextValue;

		if (contextValue === 'ignoredPackage') {
			this.iconPath = new vscode.ThemeIcon('package');
		} else if (contextValue === 'ignoredFile') {
			this.iconPath = new vscode.ThemeIcon('file');
		}
	}
}