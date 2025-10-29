import { IgnoreFileManager } from "../../realtimeScanners/common/ignoreFileManager";
import { CxOneAssistWebviewState } from "./CxOneAssistTypes";
import * as vscode from "vscode";

export class CxOneAssistUtils {
	/**
	 * Gets the current state of ignored vulnerabilities and authentication
	 */
	public static async getWebviewState(
		ignoreFileManager: IgnoreFileManager,
		context: vscode.ExtensionContext
	): Promise<CxOneAssistWebviewState> {
		const ignoredCount = ignoreFileManager.getIgnoredPackagesCount();
		const hasIgnoreFile = ignoreFileManager.hasIgnoreFile();
		const token = await context.secrets.get("authCredential");
		const isAuthenticated = !!token;

		return { ignoredCount, hasIgnoreFile, isAuthenticated };
	}

	/**
	 * Determines if the ignored vulnerabilities button should be visible
	 */
	public static shouldShowIgnoredButton(state: CxOneAssistWebviewState): boolean {
		return state.hasIgnoreFile && state.ignoredCount > 0;
	}

	/**
	 * Formats the ignored vulnerabilities count text
	 */
	public static formatIgnoredText(count: number): string {
		return count === 0 ? "No ignored vulnerabilities" : `View ignored vulnerabilities (${count})`;
	}

	/**
	 * Gets the tooltip text for the ignored vulnerabilities button
	 */
	public static getIgnoredTooltip(count: number): string {
		return count === 0 ? "No ignored vulnerabilities found" : `Click to view ${count} ignored vulnerabilities`;
	}
}