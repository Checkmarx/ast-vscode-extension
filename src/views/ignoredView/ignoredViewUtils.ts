import * as vscode from 'vscode';
import * as path from 'path';
import { constants } from '../../utils/common/constants';

export function getCurrentTheme(): 'light' | 'dark' {
	const currentTheme = vscode.window.activeColorTheme.kind;
	return (currentTheme === vscode.ColorThemeKind.Light || currentTheme === vscode.ColorThemeKind.HighContrastLight)
		? 'light'
		: 'dark';
}

/**
 * Create a theme-aware webview URI for an icon
 */
function createThemeAwareIconUri(
	webview: vscode.Webview,
	extensionPath: string,
	lightIcon: string,
	darkIcon: string
): string {
	const currentTheme = getCurrentTheme();
	const iconFileName = currentTheme === 'light' ? lightIcon : darkIcon;

	const iconPath = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', iconFileName))
	);
	return iconPath?.toString() || '';
}

/**
 * Create a simple webview URI for an icon (no theme awareness)
 */
function createSimpleIconUri(webview: vscode.Webview, extensionPath: string, iconPath: string): string {
	const uri = webview.asWebviewUri(
		vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'ignorePage', iconPath))
	);
	return uri?.toString() || '';
}

// =============================================================================
// VULNERABILITY SEVERITY ICONS
// =============================================================================

const VULNERABILITY_ICON_MAP: Record<string, string> = {
	'critical': 'Vulnerability critical_ignore',
	'high': 'Vulnerability-high_ignore',
	'medium': 'Vulnerability-medium_ignore',
	'low': 'Vulnerability-low_ignore}',
	'malicious': 'Vulnerability_malicious_ignore'
};

export function getIconName(severity: string, webview: vscode.Webview, extensionPath: string): string {
	const normalizedSeverity = severity?.toLowerCase();
	const iconFile = VULNERABILITY_ICON_MAP[normalizedSeverity] || 'Vulnerability-medium_ignore';

	return createSimpleIconUri(webview, extensionPath, `${iconFile}.svg`);
}

// =============================================================================
// THEME-AWARE IGNORE ICONS
// =============================================================================

export function getReviveIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createSimpleIconUri(
		webview,
		extensionPath,
		'arrow_ignore.svg'
	);
}

export function getScaIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(
		webview,
		extensionPath,
		'lightTheme/sca_ignore_light.svg',
		'sca_ignore.svg'
	);
}

export function getSecretsIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(
		webview,
		extensionPath,
		'lightTheme/secrets_ignore_light.svg',
		'secrets_ignore.svg'
	);
}

export function getIacIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(
		webview,
		extensionPath,
		'lightTheme/iac_ignore_light.svg',
		'iac_ignore.svg'
	);
}

export function getAscaIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(
		webview,
		extensionPath,
		'lightTheme/asca_ignore_light.svg',
		'asca_ignore.svg'
	);
}

export function getContainersIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(
		webview,
		extensionPath,
		'lightTheme/containers_ignore_light.svg',
		'containers_ignore.svg'
	);
}

export function getCloseIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createSimpleIconUri(webview, extensionPath, 'Close.svg');
}

export function getGenericFileIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(
		webview,
		extensionPath,
		'lightTheme/genericFile_light.svg',
		'genericFile.svg'
	);
}

// =============================================================================
// STATIC ICONS (NO THEME AWARENESS)
// =============================================================================

export function getNoIgnoreVulIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createSimpleIconUri(webview, extensionPath, 'no_ignore_vul.svg');
}

// =============================================================================
// SEVERITY-BASED ICONS WITH HOVER SUPPORT
// =============================================================================

/**
 * Create severity-based icon with optional hover state
 */
function createSeverityIcon(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	subFolder: string,
	isHover: boolean = false,
	defaultSeverity: string = 'medium'
): string {
	const normalizedSeverity = severity?.toLowerCase() || defaultSeverity;
	const iconName = isHover ? `${normalizedSeverity}_hover` : normalizedSeverity;

	return createSimpleIconUri(webview, extensionPath, `${subFolder}/${iconName}.svg`);
}

export function getPackageIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'Packages', isHover);
}

export function getSecretsIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'Secrets', isHover);
}

export function getIacIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'IacAsca', isHover);
}

export function getAscaIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'IacAsca', isHover);
}

export function getContainersIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'Containers', isHover);
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

const PACKAGE_DISPLAY_FORMATTERS: Record<string, (packageKey: string) => string> = {
	[constants.ossRealtimeScannerEngineName]: (packageKey) => packageKey.replace(':', '@'),
	[constants.secretsScannerEngineName]: (packageKey) => packageKey.split(':')[0],
	[constants.iacRealtimeScannerEngineName]: (packageKey) => packageKey.split(':')[0],
	[constants.ascaRealtimeScannerEngineName]: (packageKey) => packageKey.split(':')[0],
	[constants.containersRealtimeScannerEngineName]: (packageKey) => {
		const parts = packageKey.split(':');
		return parts.slice(0, 2).join('@');
	}
};

export function formatPackageDisplayName(packageKey: string, packageType: string): string {
	const formatter = PACKAGE_DISPLAY_FORMATTERS[packageType];
	return formatter ? formatter(packageKey) : packageKey;
}

export function getRiskText(severity: string): string {
	return severity?.toLowerCase() === 'malicious'
		? 'malicious-package detected'
		: `${severity}-risk package`;
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

const TIME_UNITS = {
	day: 1,
	week: 7,
	month: 30,
	year: 365
};

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
		}
		if (diffDays === 1) {
			return '1 day ago';
		}
		if (diffDays < TIME_UNITS.week) {
			return `${diffDays} days ago`;
		}

		if (diffDays < TIME_UNITS.month) {
			const weeks = Math.floor(diffDays / TIME_UNITS.week);
			return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
		}

		if (diffDays < TIME_UNITS.year) {
			const months = Math.floor(diffDays / TIME_UNITS.month);
			return months === 1 ? '1 month ago' : `${months} months ago`;
		}

		const years = Math.floor(diffDays / TIME_UNITS.year);
		return years === 1 ? '1 year ago' : `${years} years ago`;
	} catch (error) {
		console.error('Error parsing date:', dateAdded, error);
		return 'Unknown';
	}
}

// =============================================================================
// HTML GENERATION
// =============================================================================

interface FileInfo {
	path: string;
	active: boolean;
	line?: number;
}

function createFileButton(
	file: FileInfo,
	fileIconUri: string,
	entryType: string | undefined,
	isHidden: boolean = false
): string {
	const fileName = file.path.split('/').pop() || file.path;
	const displayLine = entryType === constants.ossRealtimeScannerEngineName
		? (file.line || 0) + 1
		: (file.line || 1);

	const buttonClass = isHidden ? 'file-btn hidden-file-btn' : 'file-btn';
	const tooltipClass = isHidden ? 'tooltip file-btn-tooltip hidden-tooltip' : 'tooltip file-btn-tooltip';

	return `<div class="${tooltipClass}">
		<button class="${buttonClass}" onclick="openFile('${file.path}', ${displayLine})">
			<img src="${fileIconUri}" alt="File" class="file-icon" />
			${fileName}
		</button>
		<span class="tooltiptext">Click to show in ${file.path}</span>
	</div>`;
}

export function generateFileButtons(
	files: Array<FileInfo>,
	webview: vscode.Webview,
	extensionPath: string,
	entryType?: string
): string {
	if (!files?.length) {
		return '';
	}

	const activeFiles = files.filter(file => file.active);
	if (!activeFiles.length) {
		return '';
	}

	const maxVisible = 1;
	const visibleFiles = activeFiles.slice(0, maxVisible);
	const hiddenFiles = activeFiles.slice(maxVisible);
	const remainingCount = hiddenFiles.length;

	const fileIconUri = getGenericFileIconPath(webview, extensionPath);

	const visibleButtons = visibleFiles
		.map(file => createFileButton(file, fileIconUri, entryType, false))
		.join('');

	const hiddenButtons = hiddenFiles
		.map(file => createFileButton(file, fileIconUri, entryType, true))
		.join('');

	const expandButton = remainingCount > 0
		? `<button class="expand-files-btn" onclick="expandFiles(this)">and ${remainingCount} more files</button>`
		: '';

	return `<div class="file-buttons">${visibleButtons}${expandButton}${hiddenButtons}</div>`;
}