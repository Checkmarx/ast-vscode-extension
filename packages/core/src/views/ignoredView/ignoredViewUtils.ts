import * as vscode from 'vscode';
import * as path from 'path';
import { constants } from '../../utils/common/constants';
import { ThemeUtils } from '../../utils/themeUtils';
import { MediaPathResolver } from '../../utils/mediaPathResolver';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface FileInfo {
	path: string;
	active: boolean;
	line?: number;
}

export type ThemeType = 'light' | 'dark';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'malicious';
export type ScannerType = 'oss' | 'secrets' | 'iac' | 'asca' | 'containers';

// =============================================================================
// CONFIGURATION AND MAPPINGS
// =============================================================================

/**
 * Icon path configurations for different themes and scanners
 */
const ICON_CONFIG = {
	themes: {
		light: 'lightTheme',
		dark: 'darkTheme'
	},
	severityIcons: {
		critical: 'Vulnerability critical_ignore',
		high: 'Vulnerability-high_ignore',
		medium: 'Vulnerability-medium_ignore',
		low: 'Vulnerability-low_ignore',
		malicious: 'Vulnerability_malicious_ignore'
	},
	scannerFolders: {
		oss: 'Packages',
		secrets: 'Secrets',
		iac: 'Iac-Asca',
		asca: 'Iac-Asca',
		containers: 'Containers'
	},
	ignoreIcons: {
		oss: 'sca_ignore',
		secrets: 'secrets_ignore',
		iac: 'iac_ignore',
		asca: 'asca_ignore',
		containers: 'containers_ignore'
	}
} as const;

/**
 * Package display formatters configuration
 */
const PACKAGE_FORMATTERS = {
	[constants.ossRealtimeScannerEngineName]: (key: string) => key.replace(':', '@'),
	[constants.secretsScannerEngineName]: (key: string) => key.split(':')[0],
	[constants.iacRealtimeScannerEngineName]: (key: string) => key.split(':')[0],
	[constants.ascaRealtimeScannerEngineName]: (key: string) => key.split(':')[0],
	[constants.containersRealtimeScannerEngineName]: (key: string) => {
		const parts = key.split(':');
		return parts.slice(0, 2).join('@');
	}
} as const;

/**
 * Time calculation constants
 */
const TIME_UNITS = {
	day: 1,
	week: 7,
	month: 30,
	year: 365
} as const;

// =============================================================================
// CORE UTILITIES
// =============================================================================

/**
 * Get current VS Code theme type
 */
export function getCurrentTheme(): ThemeType {
	return ThemeUtils.getThemeType();
}

/**
 * Create a webview URI for an icon file
 */
function createIconUri(webview: vscode.Webview, extensionPath: string, iconPath: string): string {
	const uri = webview.asWebviewUri(
		vscode.Uri.file(MediaPathResolver.getMediaFilePath('icons', 'ignorePage', iconPath))
	);
	return uri?.toString() || '';
}

/**
 * Build themed icon path using configuration
 */
function buildThemedIconPath(iconName: string, theme: ThemeType = getCurrentTheme()): string {
	const themeDir = ICON_CONFIG.themes[theme];
	return `${themeDir}/ignore/${iconName}.svg`.replace('_.svg', '.svg');
}

/**
 * Create a theme-aware webview URI for an icon
 */
function createThemeAwareIconUri(
	webview: vscode.Webview,
	extensionPath: string,
	iconName: string
): string {
	const currentTheme = getCurrentTheme();
	const lightPath = buildThemedIconPath(iconName, 'light');
	const darkPath = buildThemedIconPath(iconName, 'dark');
	const iconPath = currentTheme === 'light' ? lightPath : darkPath;
	return createIconUri(webview, extensionPath, iconPath);
}

// =============================================================================
// ICON PATH FUNCTIONS - VULNERABILITY SEVERITY
// =============================================================================

/**
 * Get icon path for vulnerability severity indicators
 */
export function getIconName(severity: string, webview: vscode.Webview, extensionPath: string): string {
	const normalizedSeverity = severity?.toLowerCase() as SeverityLevel;
	const iconFile = ICON_CONFIG.severityIcons[normalizedSeverity] || ICON_CONFIG.severityIcons.medium;
	return createIconUri(webview, extensionPath, `${iconFile}.svg`);
}

// =============================================================================
// ICON PATH FUNCTIONS - THEME AWARE IGNORE ICONS
// =============================================================================

/**
 * Get revive/restore icon path
 */
export function getReviveIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createIconUri(webview, extensionPath, 'arrow_ignore.svg');
}

/**
 * Get scanner-specific ignore icon path
 */
function getScannerIgnoreIconPath(
	scannerType: ScannerType,
	webview: vscode.Webview,
	extensionPath: string
): string {
	const iconName = ICON_CONFIG.ignoreIcons[scannerType];
	return createThemeAwareIconUri(webview, extensionPath, iconName);
}

/**
 * Get SCA (Software Composition Analysis) ignore icon path
 */
export function getScaIconPath(webview: vscode.Webview, extensionPath: string): string {
	return getScannerIgnoreIconPath('oss', webview, extensionPath);
}

/**
 * Get Secrets scanner ignore icon path
 */
export function getSecretsIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	return getScannerIgnoreIconPath('secrets', webview, extensionPath);
}

/**
 * Get IaC (Infrastructure as Code) scanner ignore icon path
 */
export function getIacIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	return getScannerIgnoreIconPath('iac', webview, extensionPath);
}

/**
 * Get ASCA scanner ignore icon path
 */
export function getAscaIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	return getScannerIgnoreIconPath('asca', webview, extensionPath);
}

/**
 * Get Containers scanner ignore icon path
 */
export function getContainersIgnoreIconPath(webview: vscode.Webview, extensionPath: string): string {
	return getScannerIgnoreIconPath('containers', webview, extensionPath);
}

/**
 * Get close/dismiss icon path
 */
export function getCloseIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(webview, extensionPath, 'Close');
}

/**
 * Get generic file icon path
 */
export function getGenericFileIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(webview, extensionPath, 'genericFile');
}

// =============================================================================
// ICON PATH FUNCTIONS - STATIC ICONS
// =============================================================================

/**
 * Get "no ignored vulnerabilities" state icon path
 */
export function getNoIgnoreVulIconPath(webview: vscode.Webview, extensionPath: string): string {
	return createThemeAwareIconUri(webview, extensionPath, 'no_ignore_vul');
}

// =============================================================================
// ICON PATH FUNCTIONS - SEVERITY-BASED WITH HOVER SUPPORT
// =============================================================================

/**
 * Create severity-based icon path with optional hover state
 */
function createSeverityIcon(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	scannerType: ScannerType,
	isHover: boolean = false,
	defaultSeverity: SeverityLevel = 'medium'
): string {
	const currentTheme = getCurrentTheme();
	const themeDirectory = ICON_CONFIG.themes[currentTheme];
	const normalizedSeverity = (severity?.toLowerCase() as SeverityLevel) || defaultSeverity;
	const iconName = isHover ? `${normalizedSeverity}_hover` : normalizedSeverity;
	const subFolder = ICON_CONFIG.scannerFolders[scannerType];
	return createIconUri(webview, extensionPath, `${themeDirectory}/${subFolder}/${iconName}.svg`);
}

/**
 * Get package severity icon path
 */
export function getPackageIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'oss', isHover);
}

/**
 * Get secrets severity icon path
 */
export function getSecretsIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'secrets', isHover);
}

/**
 * Get IaC severity icon path
 */
export function getIacIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'iac', isHover);
}

/**
 * Get ASCA severity icon path
 */
export function getAscaIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'asca', isHover);
}

/**
 * Get containers severity icon path
 */
export function getContainersIconPath(
	severity: string,
	webview: vscode.Webview,
	extensionPath: string,
	isHover: boolean = false
): string {
	return createSeverityIcon(severity, webview, extensionPath, 'containers', isHover);
}

// =============================================================================
// FORMATTING AND TEXT UTILITIES
// =============================================================================

/**
 * Format package display name based on scanner type
 */
export function formatPackageDisplayName(packageKey: string, packageType: string): string {
	const formatter = PACKAGE_FORMATTERS[packageType];
	return formatter ? formatter(packageKey) : packageKey;
}

/**
 * Get risk description text for severity level
 */
export function getRiskText(severity: string): string {
	return severity?.toLowerCase() === 'malicious'
		? 'malicious-package detected'
		: `${severity}-risk package`;
}

// =============================================================================
// DATE AND TIME UTILITIES
// =============================================================================

/**
 * Calculate and format relative time since a given date
 */
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
// HTML GENERATION UTILITIES
// =============================================================================

/**
 * Create a file button HTML element
 */
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

/**
 * Generate HTML for file buttons with expand/collapse functionality
 */
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