import * as vscode from "vscode";
import * as crypto from "crypto";
import { constants } from "../utils/common/constants";
import { getIdeInfo } from "../utils/ideInfo";
import { TELEMETRY_SUB_TYPE, TELEMETRY_TYPE } from "../models/telemetryEvent";
import { emitTelemetryAndWait } from "./telemetryService";

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
 */

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

/** Creates the installation id on the first activation. Does nothing afterwards. */
export async function ensureInstallationId(context: vscode.ExtensionContext): Promise<string> {
  const key = constants.getInstallationIdKey();
  const existing = context.globalState.get<string>(key);
  if (existing) {
    return existing;
  }
  const installationId = `${getIdeInfo().installPrefix}-${generateUuidV4()}`;
  const pending: PendingInstallEvent = {
    installationId,
    installationTimestamp: new Date().toISOString(),
  };
  await context.globalState.update(key, installationId);
  await context.globalState.update(constants.getPendingInstallEventKey(), pending);
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
  if (!pending?.installationId) {
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
  if (delivered) {
    await context.globalState.update(pendingKey, undefined);
  }
}

/** For unit tests only. */
export function resetInstallationTrackerState(): void {
  flushInProgress = undefined;
}
