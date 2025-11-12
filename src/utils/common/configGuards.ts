import { cx } from "../../cx";
import { Logs } from "../../models/logs";

/**
 * Determines whether operations dependent on a full configuration should proceed.
 * Returns true only when Checkmarx configuration is valid AND standalone mode is disabled.
 * Centralized so all commands use identical gating logic.
 */
export async function validateConfigurationDetails(logs: Logs): Promise<boolean> {
	const isValid = await cx.isValidConfiguration();
	if (!isValid) {
		return false;
	}
	const isStandalone = await cx.isStandaloneEnabled(logs);
	return !isStandalone;
}

/**
 * Convenience alias specifically for refresh-like actions.
 */
export async function shouldRunRefresh(logs: Logs): Promise<boolean> {
	return validateConfigurationDetails(logs);
}
