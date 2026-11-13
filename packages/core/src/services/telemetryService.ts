import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { cx } from "../cx";
import { Logs } from "../models/logs";
import {
  AuthMethod,
  PLUGIN_TYPE_IDE,
  TELEMETRY_SUB_TYPE,
  TELEMETRY_TYPE,
  TelemetryEvent,
  TelemetryPayload,
} from "../models/telemetryEvent";
import { getIdeInfo, getIdeVersion } from "../utils/ideInfo";

/**
 * Single entry point for Dev Assist analytics events (AST-184025).
 *
 * Every event gets the common envelope (agent, agentVersion, cxPluginVersion, pluginType)
 * and is sent through the CLI wrapper. Sending never throws, never blocks the caller,
 * and never shows anything to the user; failures are logged at debug level.
 */

const MAX_STATUS_RESULT_LENGTH = 256;

let pluginVersion = "";
let telemetryLogs: Logs | undefined;

/** Called once from activateCore. */
export function initTelemetry(context: vscode.ExtensionContext, logs?: Logs): void {
  telemetryLogs = logs;
  pluginVersion = readPluginVersion(context);
}

function readPluginVersion(context: vscode.ExtensionContext): string {
  try {
    const version = context.extension?.packageJSON?.version;
    if (typeof version === "string") {
      return version;
    }
  } catch {
    // fall back to reading package.json
  }
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(context.extensionPath, "package.json"), "utf8"));
    return typeof packageJson.version === "string" ? packageJson.version : "";
  } catch {
    return "";
  }
}

export interface TelemetryEnvelope {
  agent: string;
  agentVersion: string;
  cxPluginVersion: string;
  pluginType: string;
}

export function buildEnvelope(): TelemetryEnvelope {
  return {
    agent: getIdeInfo().agent,
    agentVersion: getIdeVersion(),
    cxPluginVersion: pluginVersion,
    pluginType: PLUGIN_TYPE_IDE,
  };
}

export function toPayload(event: TelemetryEvent): TelemetryPayload {
  return {
    ...buildEnvelope(),
    eventType: event.type,
    subType: event.subType,
    status: event.status,
    engine: event.engine,
    problemSeverity: event.problemSeverity,
    totalCount: event.totalCount,
    aiProvider: event.aiProvider,
    statusResult: event.statusResult === undefined ? undefined : sanitizeTelemetryText(event.statusResult),
    repoUrl: event.repoUrl,
    eventAttributes: event.eventAttributes,
  };
}

/** Sends an event and resolves to true only when the CLI accepted it. Never rejects. */
export async function emitTelemetryAndWait(event: TelemetryEvent): Promise<boolean> {
  try {
    if (!cx) {
      return false;
    }
    const delivered = await cx.sendTelemetryEvent(toPayload(event));
    if (!delivered) {
      telemetryLogs?.debug(`Telemetry event ${event.type}/${event.subType} was not delivered`);
    }
    return delivered;
  } catch (error) {
    telemetryLogs?.debug(`Telemetry event ${event.type}/${event.subType} failed: ${sanitizeTelemetryText(error)}`);
    return false;
  }
}

/** Sends an event in the background. */
export function emitTelemetry(event: TelemetryEvent): void {
  void emitTelemetryAndWait(event);
}

/**
 * Login event. Emitted only for interactive sign-ins.
 * A failed login is sent best-effort: it is delivered only if a valid credential is still stored.
 */
export function emitLoginEvent(authMethod: AuthMethod, success: boolean, reason?: unknown): void {
  emitTelemetry({
    type: TELEMETRY_TYPE.authentication,
    subType: TELEMETRY_SUB_TYPE.authentication,
    status: success ? "Success" : "Failure",
    statusResult: success
      ? "Authentication successful."
      : `Authentication failed. Reason: ${sanitizeTelemetryText(reason ?? "unknown")}, Error Code: N/A`,
    eventAttributes: {
      authMethod,
      loginTimestamp: new Date().toISOString(),
    },
  });
}

/**
 * Makes free text safe to send: removes anything that looks like a token, key or credential,
 * collapses whitespace and truncates.
 */
export function sanitizeTelemetryText(value: unknown, maxLength = MAX_STATUS_RESULT_LENGTH): string {
  let text: string;
  if (value instanceof Error) {
    text = value.message;
  } else if (typeof value === "string") {
    text = value;
  } else {
    try {
      text = String(value);
    } catch {
      text = "";
    }
  }
  text = text
    // credentials in URLs: https://user:secret@host
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, "$1***@")
    // key=value / key: value pairs that carry secrets
    .replace(/\b(api[-_]?key|apikey|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=***")
    // Authorization: Bearer <token> / Basic <credentials>
    .replace(/\b(bearer|basic)\s+[^\s,;]+/gi, "$1 ***")
    // JWTs
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "***")
    // long opaque strings (keys, hashes, base64)
    .replace(/[A-Za-z0-9_\-+/]{32,}={0,2}/g, "***")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? text.substring(0, maxLength) : text;
}
