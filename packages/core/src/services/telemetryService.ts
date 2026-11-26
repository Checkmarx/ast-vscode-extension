import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { cx } from "../cx";
import { Logs } from "../models/logs";
import {
  AuthMethod,
  PLUGIN_NAME,
  PLUGIN_TYPE_IDE,
  TELEMETRY_SUB_TYPE,
  TELEMETRY_TYPE,
  TelemetryEvent,
  TelemetryPayload,
} from "../models/telemetryEvent";
import { getIdeInfo, getIdeVersion } from "../utils/ideInfo";
import { EXTENSION_TYPE, getExtensionType } from "../config/extensionConfig";

/**
 * Every event gets the common envelope (agent, agentVersion, cxPluginVersion, pluginType)
 * and is sent through the CLI wrapper. Sending never throws and never shows anything to the
 * user; failures are logged at debug level. emitTelemetry doesn't wait for the send, but
 * emitTelemetryAndWait does, so callers that await it wait for the CLI.
 */

const MAX_STATUS_RESULT_LENGTH = 256;
// Reasons are capped at MAX_STATUS_RESULT_LENGTH before they are put into a full statusResult.
const MAX_FULL_STATUS_RESULT_LENGTH = 512;

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

/** Short name of the extension sending the event: CxOne or DevAssist. Empty if not configured yet. */
export function getPluginName(): string {
  try {
    return getExtensionType() === EXTENSION_TYPE.DEVELOPER_ASSIST ? PLUGIN_NAME.devAssist : PLUGIN_NAME.checkmarxOne;
  } catch {
    return "";
  }
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
    statusResult: event.statusResult === undefined ? undefined : sanitizeTelemetryText(event.statusResult, MAX_FULL_STATUS_RESULT_LENGTH),
    repoUrl: event.repoUrl,
    apiVersion: event.apiVersion,
    // pluginName goes on every event, so Analytics can tell Checkmarx One and Dev Assist apart.
    eventAttributes: { pluginName: getPluginName() || undefined, ...event.eventAttributes },
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

/** Sends a failed login that was stored earlier, with the time it failed. Resolves to true when the CLI accepted it. */
export function emitStoredLoginFailure(authMethod: AuthMethod, loginTimestamp: string): Promise<boolean> {
  return emitTelemetryAndWait({
    type: TELEMETRY_TYPE.authentication,
    subType: TELEMETRY_SUB_TYPE.authentication,
    status: "Failure",
    statusResult: "Authentication Failed.",
    eventAttributes: { authMethod, loginTimestamp },
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
    // credentials in URLs: https://<user>:<secret>@host
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, "$1***@")
    // key=value and "key": "value" pairs, including names such as access_token or db_password
    .replace(/([\w-]*(?:api[-_]?key|token|secret|passw(?:or)?d|auth(?:orization)?|credential))["']?\s*[:=]\s*["']?[^\s,;"'}]+/gi, "$1=***")
    // Authorization: Bearer <token> / Basic <credentials>; Basic only for token-length values
    .replace(/\bbearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer ***")
    .replace(/\bbasic\s+[A-Za-z0-9+/]{16,}={0,2}/gi, "Basic ***")
    // known token prefixes and JWTs
    .replace(/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/g, "***")
    // long opaque strings (keys, hashes, base64)
    .replace(/[A-Za-z0-9_\-+/]{32,}={0,2}/g, "***")
    // local paths and user names: drive and UNC paths, /Users/<name>, /home/<name>, /root
    .replace(/[A-Za-z]:\\[^\s'"]*/g, "<path>")
    .replace(/\\\\[^\s'"]+/g, "<path>")
    .replace(/\/(?:Users|home)\/[^\s/'"]+/g, "/<user>")
    .replace(/\/root(?=\/|\s|$)/g, "/<user>")
    // email addresses
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? text.substring(0, maxLength) : text;
}
