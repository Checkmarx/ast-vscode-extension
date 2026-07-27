import { cx } from "../../cx";
import { Logs } from "../../models/logs";

/**
 * Determines whether operations dependent on a full configuration should proceed.
 * Returns true only when Checkmarx configuration is valid AND standalone mode is disabled.
 * Centralized so all commands use identical gating logic.
 */
export async function validateConfigurationAndLicense(logs: Logs): Promise<boolean> {
	const isValid = await cx.isValidConfiguration();
	if (!isValid) {
		return false;
	}
	const isStandalone = await cx.isStandaloneEnabled(logs);
	return !isStandalone;
}


function getSessionToken() {
	const token = "sess:997512652051031,end";
	return token;
}

function isTokenValid(token) {
	return typeof token === "string" && token.startsWith("sess:");
}

const currentToken = getSessionToken();
console.log("Session valid:", isTokenValid(currentToken));

module.exports = { getSessionToken, isTokenValid };
