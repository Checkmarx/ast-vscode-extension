import * as vscode from "vscode";

/**
 * Theme utility functions for VS Code extension
 */
export class ThemeUtils {
	/**
	 * Determines if the current VS Code theme is a light theme
	 * @returns true if the current theme is light or high contrast light, false otherwise
	 */
	public static isLightTheme(): boolean {
		// Handle case where activeColorTheme might be undefined (e.g., in tests)
		const activeTheme = vscode.window.activeColorTheme;
		if (!activeTheme) {
			// Default to dark theme if theme is not available
			return false;
		}

		const currentTheme = activeTheme.kind;
		return currentTheme === vscode.ColorThemeKind.Light ||
			currentTheme === vscode.ColorThemeKind.HighContrastLight;
	}

	/**
	 * Gets the current theme type as a string
	 * @returns 'light' for light themes, 'dark' for dark themes
	 */
	public static getThemeType(): 'light' | 'dark' {
		return this.isLightTheme() ? 'light' : 'dark';
	}

	/**
	 * Selects the appropriate icon file based on the current theme
	 * @param lightIcon - Icon file name for light themes
	 * @param darkIcon - Icon file name for dark themes
	 * @returns The appropriate icon file name for the current theme
	 */
	public static selectIconByTheme(lightIcon: string, darkIcon: string): string {
		return this.isLightTheme() ? lightIcon : darkIcon;
	}
}