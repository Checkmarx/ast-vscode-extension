import * as vscode from "vscode";
import { AuthMethod } from "../models/telemetryEvent";
import { emitLoginEvent } from "./telemetryService";
import { flushPendingInstallEvent } from "./installationTracker";

/**
 * Helpers for the auth views of both extensions. Call only for interactive sign-ins,
 * never for the silent credential check at startup.
 */

export function reportLoginSuccess(context: vscode.ExtensionContext, authMethod: AuthMethod): void {
  emitLoginEvent(authMethod, true);
  // The first successful login is also when a pending install event can be sent.
  void flushPendingInstallEvent(context);
}

export function reportLoginFailure(authMethod: AuthMethod, reason: unknown): void {
  emitLoginEvent(authMethod, false, reason);
}

/** Maps the auth webview's method ("oauth" | "apiKey") to the telemetry value. */
export function toAuthMethod(method: string | undefined): AuthMethod {
  return method === "oauth" ? "OAuth" : "APIKey";
}
