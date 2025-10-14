import { IgnoreFileManager } from "../../realtimeScanners/common/ignoreFileManager";
import { CxOneAssistWebviewState } from "./CxOneAssistTypes";

export class CxOneAssistUtils {
	/**
	 * Gets the current state of ignored vulnerabilities
	 */
	public static getWebviewState(ignoreFileManager: IgnoreFileManager): CxOneAssistWebviewState {
		const ignoredCount = ignoreFileManager.getIgnoredPackagesCount();
		const hasIgnoreFile = ignoreFileManager.hasIgnoreFile();

		return {
			ignoredCount,
			hasIgnoreFile
		};
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
		if (count === 0) {
			return "No ignored vulnerabilities";
		}
		return `View ignored vulnerabilities (${count})`;
	}

	/**
	 * Gets the tooltip text for the ignored vulnerabilities button
	 */
	public static getIgnoredTooltip(count: number): string {
		if (count === 0) {
			return "No ignored vulnerabilities found";
		}
		return `Click to view ${count} ignored vulnerabilities`;
	}
}