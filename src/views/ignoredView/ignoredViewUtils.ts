import * as vscode from 'vscode';
import * as path from 'path';
import { constants } from '../../utils/common/constants';
export function getIconName(severity: string, webview: vscode.Webview, extensionPath: string): string {
	const iconMap: Record<string, string> = {
		'critical': 'Vulnerability critical_ignore',
		'high': 'Vulnerability-high_ignore',
		'medium': 'Vulnerability-medium_ignore',
		'low': 'Vulnerability-low_ignore}',
		'malicious': 'Vulnerability_malicious_ignore'
	};

	const normalizedSeverity = severity?.toLowerCase();
	const iconFile = iconMap[normalizedSeverity] || 'Vulnerability-medium_ignore';

	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', `${iconFile}.svg`))
	);

	return iconPath?.toString() || '';
}

export function getReviveIconPath(webview: vscode.Webview, extensionPath: string): string {
	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', 'arrow_ignore.svg'))
	);
	return iconPath?.toString() || '';
}

export function getScaIconPath(webview: vscode.Webview, extensionPath: string): string {
	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', 'sca_ignore.svg'))
	);
	return iconPath?.toString() || '';
}

export function getNoIgnoreVulIconPath(webview: vscode.Webview, extensionPath: string): string {
	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', 'no_ignore_vul.svg'))
	);
	return iconPath?.toString() || '';
}

export function getPackageIconPath(severity: string, webview: vscode.Webview, extensionPath: string, isHover: boolean = false): string {
	const normalizedSeverity = severity?.toLowerCase();
	const iconName = isHover ? `${normalizedSeverity}_hover` : normalizedSeverity;

	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', 'Packages', `${iconName}.svg`))
	);

	return iconPath?.toString() || '';
}

export function getSecretsIconPath(severity: string, webview: vscode.Webview, extensionPath: string, isHover: boolean = false): string {
	const normalizedSeverity = severity?.toLowerCase();
	const iconName = isHover ? `${normalizedSeverity}_hover` : normalizedSeverity;

	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', 'Secrets', `${iconName}.svg`))
	);

	return iconPath?.toString() || '';
}

export function getSecretsIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', 'secrets_ignore.svg'))
	);
	return iconPath?.toString() || '';
}

export function getGenericFileIconPath(webview: vscode.Webview, extensionPath: string): string {
	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', 'genericFile.svg'))
	);
	return iconPath?.toString() || '';
}

export function getCloseIconPath(webview: vscode.Webview, extensionPath: string): string {
	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', 'Close.svg'))
	);
	return iconPath?.toString() || '';
}

export function formatPackageDisplayName(packageKey: string, packageType: string): string {
	if (packageType === constants.ossRealtimeScannerEngineName) {
		return packageKey.replace(':', '@');
	} else if (packageType === constants.secretsScannerEngineName) {
		return packageKey.split(':')[0];
	}
	return packageKey;
}

export function getLastUpdated(dateAdded: string | undefined): string {
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

export function getRiskText(severity: string): string {
	if (severity?.toLowerCase() === 'malicious') {
		return 'malicious-package detected';
	}
	return `${severity}-risk package`;
}

export function generateFileButtons(
	files: Array<{ path: string; active: boolean; line?: number }>,
	webview: vscode.Webview,
	extensionPath: string,
	entryType?: string
): string {
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

	const fileIconUri = getGenericFileIconPath(webview, extensionPath);

	const visibleButtons = visibleFiles
		.map(file => {
			const fileName = file.path.split('/').pop() || file.path;
			const displayLine = entryType === constants.ossRealtimeScannerEngineName ? (file.line || 0) + 1 : (file.line || 1);
			return `<div class="tooltip file-btn-tooltip">
				<button class="file-btn" onclick="openFile('${file.path}', ${displayLine})">
					<img src="${fileIconUri}" alt="File" class="file-icon" />
					${fileName}
				</button>
				<span class="tooltiptext">Click to show in ${file.path}</span>
			</div>`;
		})
		.join('');

	const hiddenButtons = activeFiles.slice(maxVisible)
		.map(file => {
			const fileName = file.path.split('/').pop() || file.path;
			const displayLine = entryType === constants.ossRealtimeScannerEngineName ? (file.line || 0) + 1 : (file.line || 1);
			return `<div class="tooltip file-btn-tooltip hidden-tooltip">
				<button class="file-btn hidden-file-btn" onclick="openFile('${file.path}', ${displayLine})">
					<img src="${fileIconUri}" alt="File" class="file-icon" />
					${fileName}
				</button>
				<span class="tooltiptext">Click to show in ${file.path}</span>
			</div>`;
		})
		.join('');

	const expandButton = remainingCount > 0
		? `<button class="expand-files-btn" onclick="expandFiles(this)">and ${remainingCount} more files</button>`
		: '';

	return `<div class="file-buttons">${visibleButtons}${expandButton}${hiddenButtons}</div>`;
}