import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { constants } from "../utils/common/constants";
import { getExtensionId } from "../config/extensionConfig";
import { Logs } from "../models/logs";

/**
 * Writes ~/.checkmarx/cx-onboarding-ide.properties, the IDE state file read by ast-cli and
 * the Checkmarx Copilot plugin (cx-devassist) hooks. Only this extension writes it.
 * While logged in it mirrors the settings (Self-Healing defaults to ON). While logged out it is kept
 * but says Self-Healing and every scanner are OFF; the settings themselves are left untouched, so the
 * next login restores the user's choices.
 */

export const IDE_ONBOARDING_SCHEMA_VERSION = 1;
export const IDE_ONBOARDING_DIR = ".checkmarx";
export const IDE_ONBOARDING_FILE = "cx-onboarding-ide.properties";
const UPDATED_AT_KEY = "cx_updated_at";
export const BOM_PATTERN = new RegExp("^" + String.fromCharCode(0xfeff));

export interface IdeOnboardingValues {
	selfHealingEnabled: boolean;
	ascaEnabled: boolean;
	scaEnabled: boolean;
	secretEnabled: boolean;
	kicsEnabled: boolean;
	containersEnabled: boolean;
	ideExtension: string;
	ideVersion: string;
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
		`cx_ide_extension=${values.ideExtension}`,
		`cx_ide_version=${values.ideVersion}`,
		`${UPDATED_AT_KEY}=${updatedAt}`,
	];
	return lines.join("\n") + "\n";
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
	const content = buildIdeOnboardingProperties(values, (options.now ?? new Date()).toISOString());
	let tempPath: string | undefined;
	try {
		try {
			const existing = fs.readFileSync(filePath, "utf8");
			if (withoutTimestamp(existing) === withoutTimestamp(content)) {
				return "unchanged";
			}
		} catch {
			// Missing or unreadable file: write a fresh one
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
	return getBooleanSetting(constants.getSelfHealingConfigSection(), constants.activateSelfHealing, true);
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
export function getIdeOnboardingValues(context?: vscode.ExtensionContext): IdeOnboardingValues {
	const ideExtension = getExtensionId();
	const ideVersion = String(context?.extension?.packageJSON?.version ?? "unknown");
	if (!authenticated) {
		return {
			selfHealingEnabled: false,
			ascaEnabled: false,
			scaEnabled: false,
			secretEnabled: false,
			kicsEnabled: false,
			containersEnabled: false,
			ideExtension,
			ideVersion,
		};
	}
	return {
		selfHealingEnabled: isSelfHealingEnabled(),
		ascaEnabled: getBooleanSetting(constants.getAscaRealtimeScanner(), constants.activateAscaRealtimeScanner, false),
		scaEnabled: getBooleanSetting(constants.getOssRealtimeScanner(), constants.activateOssRealtimeScanner, false),
		secretEnabled: getBooleanSetting(constants.getSecretsScanner(), constants.activateSecretsScanner, false),
		kicsEnabled: getBooleanSetting(constants.getIacRealtimeScanner(), constants.activateIacRealtimeScanner, false),
		containersEnabled: getBooleanSetting(constants.getContainersRealtimeScanner(), constants.activateContainersRealtimeScanner, false),
		ideExtension,
		ideVersion,
	};
}

/** Syncs the properties file from the current settings. Never throws. */
export function syncIdeOnboardingProperties(context?: vscode.ExtensionContext, logs?: Logs): IdeOnboardingWriteResult {
	try {
		return writeIdeOnboardingProperties(getIdeOnboardingValues(context), { logs });
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
