import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { constants } from "../utils/common/constants";
import { Logs } from "../models/logs";

/**
 * Writes ~/.checkmarx/cx-onboarding-ide.properties, the IDE state file read by ast-cli and
 * the Checkmarx cx-devassist plugin hooks. Only this extension writes it.
 * While logged in it mirrors the settings (Self-Healing defaults to ON). While logged out it is kept
 * but says Self-Healing and every scanner are OFF; the settings themselves are left untouched, so the
 * next login restores the user's choices.
 */

export const IDE_ONBOARDING_SCHEMA_VERSION = 1;
export const IDE_ONBOARDING_DIR = ".checkmarx";
export const IDE_ONBOARDING_FILE = "cx-onboarding-ide.properties";
const UPDATED_AT_KEY = "cx_updated_at";
export const BOM_PATTERN = new RegExp("^" + String.fromCharCode(0xfeff));
/** cx_severity_threshold written to the file: minimum severity that blocks (low | medium | high | critical). */
export const IDE_SEVERITY_THRESHOLD_DEFAULT = "low";

export interface IdeOnboardingValues {
	selfHealingEnabled: boolean;
	ascaEnabled: boolean;
	scaEnabled: boolean;
	secretEnabled: boolean;
	kicsEnabled: boolean;
	containersEnabled: boolean;
	severityThreshold: string;
}

export type IdeOnboardingWriteResult = "written" | "unchanged" | "error";

export function getIdeOnboardingPropertiesPath(homeDir: string = os.homedir()): string {
	return path.join(homeDir, IDE_ONBOARDING_DIR, IDE_ONBOARDING_FILE);
}

export function buildIdeOnboardingProperties(values: IdeOnboardingValues, updatedAt: string): string {
	const lines = [
		`cx_schema_version=${IDE_ONBOARDING_SCHEMA_VERSION}`,
		`cx_self_healing_enabled=${values.selfHealingEnabled}`,
		`cx_asca_scanner_enabled=${values.ascaEnabled}`,
		`cx_sca_scanner_enabled=${values.scaEnabled}`,
		`cx_secret_scanner_enabled=${values.secretEnabled}`,
		`cx_kics_scanner_enabled=${values.kicsEnabled}`,
		`cx_containers_scanner_enabled=${values.containersEnabled}`,
		`cx_severity_threshold=${values.severityThreshold}`,
		`${UPDATED_AT_KEY}=${updatedAt}`,
	];
	return lines.join("\n") + "\n";
}

const SEVERITY_THRESHOLD_KEY = "cx_severity_threshold";
const SEVERITY_THRESHOLDS = ["low", "medium", "high", "critical"];

/** The valid cx_severity_threshold in the file (the last line wins, as ast-cli reads it), or undefined. */
export function readSeverityThresholdFromFile(content: string): string | undefined {
	let value: string | undefined;
	for (const raw of content.replace(BOM_PATTERN, "").split(/\r?\n/)) {
		const line = raw.trim();
		const eq = line.indexOf("=");
		if (line.startsWith("#") || eq === -1) {
			continue;
		}
		if (line.slice(0, eq).trim() === SEVERITY_THRESHOLD_KEY) {
			value = line.slice(eq + 1).trim().toLowerCase();
		}
	}
	return value !== undefined && SEVERITY_THRESHOLDS.includes(value) ? value : undefined;
}

/** Content without the timestamp line, used to detect "unchanged except for the timestamp". */
function withoutTimestamp(content: string): string {
	return content
		.replace(BOM_PATTERN, "")
		.split(/\r?\n/)
		.filter(line => !line.trim().startsWith(`${UPDATED_AT_KEY}=`))
		.join("\n")
		.trim();
}

/**
 * Atomically writes the properties file (temp file in the same directory, then rename).
 * Skips the write when only the timestamp would change. Never throws.
 */
export function writeIdeOnboardingProperties(
	values: IdeOnboardingValues,
	options: { homeDir?: string; now?: Date; logs?: Logs } = {}
): IdeOnboardingWriteResult {
	const filePath = getIdeOnboardingPropertiesPath(options.homeDir);
	let existing: string | undefined;
	try {
		existing = fs.readFileSync(filePath, "utf8");
	} catch {
		// Missing or unreadable file: write a fresh one
	}
	// A threshold the user set in the file (low | medium | high | critical) is kept on every sync.
	const severityThreshold = (existing !== undefined ? readSeverityThresholdFromFile(existing) : undefined) ?? values.severityThreshold;
	const content = buildIdeOnboardingProperties({ ...values, severityThreshold }, (options.now ?? new Date()).toISOString());
	let tempPath: string | undefined;
	try {
		if (existing !== undefined && withoutTimestamp(existing) === withoutTimestamp(content)) {
			return "unchanged";
		}

		const dir = path.dirname(filePath);
		fs.mkdirSync(dir, { recursive: true });
		tempPath = path.join(dir, `.${IDE_ONBOARDING_FILE}.${process.pid}.${Date.now()}.tmp`);
		fs.writeFileSync(tempPath, content, { encoding: "utf8" });
		fs.renameSync(tempPath, filePath);
		tempPath = undefined;
		options.logs?.info(`Updated ${filePath} (self-healing ${values.selfHealingEnabled ? "enabled" : "disabled"})`);
		return "written";
	} catch (error) {
		options.logs?.error(`Failed to write ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
		if (tempPath) {
			try {
				fs.unlinkSync(tempPath);
			} catch {
				// ignore
			}
		}
		return "error";
	}
}

function getBooleanSetting(section: string, key: string, defaultValue: boolean): boolean {
	const value = vscode.workspace.getConfiguration(section).get<boolean>(key, defaultValue);
	return typeof value === "boolean" ? value : defaultValue;
}

export function isSelfHealingEnabled(): boolean {
	return getBooleanSetting(constants.getSelfHealingConfigSection(), constants.activateSelfHealing, false);
}

let authenticated = false;

/** Records whether the user is logged in; the next sync writes the matching values. */
export function setIdeOnboardingAuthenticated(value: boolean): void {
	authenticated = value;
}

export function isIdeOnboardingAuthenticated(): boolean {
	return authenticated;
}

/** Reads the current values from the VS Code settings of the running extension; all OFF while logged out. */
export function getIdeOnboardingValues(): IdeOnboardingValues {
	if (!authenticated) {
		return {
			selfHealingEnabled: false,
			ascaEnabled: false,
			scaEnabled: false,
			secretEnabled: false,
			kicsEnabled: false,
			containersEnabled: false,
			severityThreshold: IDE_SEVERITY_THRESHOLD_DEFAULT,
		};
	}
	return {
		selfHealingEnabled: isSelfHealingEnabled(),
		ascaEnabled: getBooleanSetting(constants.getAscaRealtimeScanner(), constants.activateAscaRealtimeScanner, false),
		scaEnabled: getBooleanSetting(constants.getOssRealtimeScanner(), constants.activateOssRealtimeScanner, false),
		secretEnabled: getBooleanSetting(constants.getSecretsScanner(), constants.activateSecretsScanner, false),
		kicsEnabled: getBooleanSetting(constants.getIacRealtimeScanner(), constants.activateIacRealtimeScanner, false),
		containersEnabled: getBooleanSetting(constants.getContainersRealtimeScanner(), constants.activateContainersRealtimeScanner, false),
		severityThreshold: IDE_SEVERITY_THRESHOLD_DEFAULT,
	};
}

/** Syncs the properties file from the current settings. Never throws. */
export function syncIdeOnboardingProperties(logs?: Logs): IdeOnboardingWriteResult {
	try {
		return writeIdeOnboardingProperties(getIdeOnboardingValues(), { logs });
	} catch (error) {
		logs?.error(`Failed to sync IDE onboarding properties: ${error instanceof Error ? error.message : String(error)}`);
		return "error";
	}
}

/** Configuration keys that feed the properties file (section.key). */
export function getIdeOnboardingConfigKeys(): string[] {
	return [
		`${constants.getSelfHealingConfigSection()}.${constants.activateSelfHealing}`,
		`${constants.getAscaRealtimeScanner()}.${constants.activateAscaRealtimeScanner}`,
		`${constants.getOssRealtimeScanner()}.${constants.activateOssRealtimeScanner}`,
		`${constants.getSecretsScanner()}.${constants.activateSecretsScanner}`,
		`${constants.getIacRealtimeScanner()}.${constants.activateIacRealtimeScanner}`,
		`${constants.getContainersRealtimeScanner()}.${constants.activateContainersRealtimeScanner}`,
	];
}
