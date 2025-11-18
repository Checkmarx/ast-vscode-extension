import { IgnoreFileManager } from "../../realtimeScanners/common/ignoreFileManager";
import { CxOneAssistWebviewState } from "./CxOneAssistTypes";
import * as vscode from "vscode";
import { Cx } from "../../cx/cx";
import { Logs } from "../../models/logs";

export class CxOneAssistUtils {
	public static async getWebviewState(
		ignoreFileManager: IgnoreFileManager,
		context: vscode.ExtensionContext,
		logs: Logs
	): Promise<CxOneAssistWebviewState> {
		const ignoredCount = ignoreFileManager.getIgnoredPackagesCount();
		const hasIgnoreFile = ignoreFileManager.hasIgnoreFile();
		const cxInstance = new Cx(context);
		const isAuthenticated = await cxInstance.isValidConfiguration();
		const isStandaloneEnabled = await cxInstance.isStandaloneEnabled(logs);
		const isCxOneAssistEnabled = await cxInstance.isCxOneAssistEnabled(logs);
		return { ignoredCount, hasIgnoreFile, isStandaloneEnabled, isAuthenticated, isCxOneAssistEnabled };
	}

	public static shouldShowIgnoredButton(state: CxOneAssistWebviewState): boolean {
		return state.hasIgnoreFile && state.ignoredCount > 0;
	}

	public static formatIgnoredText(count: number): string {
		return count === 0 ? "No ignored vulnerabilities" : `View ignored vulnerabilities (${count})`;
	}

	public static getIgnoredTooltip(count: number): string {
		return count === 0 ? "No ignored vulnerabilities found" : `${count} ignored vulnerabilities - Click to view`;
	}
}