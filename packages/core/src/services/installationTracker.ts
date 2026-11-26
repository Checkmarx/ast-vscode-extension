import * as vscode from "vscode";
import * as crypto from "crypto";
import { constants } from "../utils/common/constants";
import { getIdeInfo } from "../utils/ideInfo";
import { TELEMETRY_SUB_TYPE, TELEMETRY_TYPE } from "../models/telemetryEvent";
import { emitTelemetryAndWait } from "./telemetryService";
import { Logs } from "../models/logs";

/**
 * Install event (AST-184025).
 *
 * On first activation an installation id `<ide>-<uuid-v4>` is created and stored in
 * globalState, together with a pending install event. Sending needs an authenticated
 * CLI, so the pending event is sent after the first successful login, or on the next
 * startup with valid credentials, and cleared only once it was delivered.
 *
 * Each IDE has its own globalState, so VS Code and Cursor on one machine get separate ids.
 * Each extension has its own keys, so Checkmarx One and Dev Assist don't overwrite each other.
 *
 * Users who already had the extension before this release also get an id, but no install
 * event: they upgraded, they didn't install. See isExistingInstallation.
 */

let installationLogs: Logs | undefined;

/** Initialize logs for installation tracker. Called from activateCore. */
export function initInstallationTracker(logs?: Logs): void {
  installationLogs = logs;
}

export interface PendingInstallEvent {
  installationId: string;
  installationTimestamp: string;
}

/** RFC 4122 v4 UUID. crypto.randomUUID is missing on older VS Code builds (Node < 14.17). */
export function generateUuidV4(): string {
  const randomUUID = (crypto as { randomUUID?: () => string }).randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(crypto);
  }
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

/**
 * True when the extension was already used before. Source of truth: globalState only,
 * not credentials (they can persist across uninstall but don't indicate install status).
 */
export async function isExistingInstallation(context: vscode.ExtensionContext): Promise<boolean> {
  const ownKeys = new Set([constants.getInstallationIdKey(), constants.getPendingInstallEventKey()]);
  const keys = typeof context.globalState.keys === "function" ? context.globalState.keys() : [];
  return keys.some((key) => !ownKeys.has(key));
}

function newInstallationId(): string {
  return `${getIdeInfo().installPrefix}-${generateUuidV4()}`;
}

/**
 * Creates the installation id on the first activation and returns it afterwards. Only a fresh
 * install gets a pending install event; an upgrade or a reinstall keeps the id and gets none.
 */
export async function ensureInstallationId(context: vscode.ExtensionContext): Promise<string> {
  const key = constants.getInstallationIdKey();
  const existing = context.globalState.get<string>(key);
  if (existing) {
    return existing;
  }

  const upgradedFromOlderVersion = await isExistingInstallation(context);
  const installationId = newInstallationId();
  await context.globalState.update(key, installationId);

  if (upgradedFromOlderVersion) {
    installationLogs?.info("⚠️ [INSTALL] UPGRADE detected - NO pending event");
    return installationId;
  }

  installationLogs?.info("🆔 [INSTALL] Fresh Install? true");
  const event: PendingInstallEvent = {
    installationId,
    installationTimestamp: new Date().toISOString(),
  };
  await context.globalState.update(constants.getPendingInstallEventKey(), event);
  installationLogs?.info("✅ [INSTALL] Pending event CREATED");
  return installationId;
}

let flushInProgress: Promise<void> | undefined;

/**
 * Sends the pending install event, if any. Clears it only when the CLI accepted it.
 * Concurrent calls (startup and login at the same time) share one send.
 */
export function flushPendingInstallEvent(context: vscode.ExtensionContext): Promise<void> {
  if (!flushInProgress) {
    flushInProgress = doFlush(context).finally(() => {
      flushInProgress = undefined;
    });
  }
  return flushInProgress;
}

async function doFlush(context: vscode.ExtensionContext): Promise<void> {
  const pendingKey = constants.getPendingInstallEventKey();
  const pending = context.globalState.get<PendingInstallEvent>(pendingKey);

  installationLogs?.info(`📦 [FLUSH] Pending event exists? ${!!pending?.installationId}`);

  // Only flush if pending event exists (fresh install, not upgrade)
  if (!pending?.installationId) {
    installationLogs?.info(`⏭️ [FLUSH] Skipping - no pending event (upgrade or already flushed)`);
    return;
  }

  const delivered = await emitTelemetryAndWait({
    type: TELEMETRY_TYPE.install,
    subType: TELEMETRY_SUB_TYPE.installation,
    status: "Success",
    statusResult: "Plugin installed successfully.",
    eventAttributes: {
      installationId: pending.installationId,
      installationTimestamp: pending.installationTimestamp,
    },
  });

  installationLogs?.info(`📦 [FLUSH] Event delivered? ${delivered}`);

  // Clear pending event only after successful delivery
  if (delivered) {
    await context.globalState.update(pendingKey, undefined);
    installationLogs?.info(`✅ [FLUSH] Pending event cleared after successful delivery`);
  }
}

/** For unit tests only. */
export function resetInstallationTrackerState(): void {
  flushInProgress = undefined;
}
