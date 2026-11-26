import * as vscode from "vscode";
import { AuthMethod } from "../models/telemetryEvent";
import { constants } from "../utils/common/constants";
import { emitLoginEvent, emitStoredLoginFailure } from "./telemetryService";
import { flushPendingInstallEvent } from "./installationTracker";

interface PendingLoginFailure {
  authMethod: AuthMethod;
  loginTimestamp: string;
}

/**
 * Helpers for the auth views of both extensions. Call only for interactive sign-ins,
 * never for the silent credential check at startup.
 */

export async function reportLoginSuccess(context: vscode.ExtensionContext, authMethod: AuthMethod): Promise<void> {
  emitLoginEvent(authMethod, true);
  // The first successful login is also when a pending install event can be sent.
  await flushPendingInstallEvent(context);
  void flushPendingLoginFailure(context);
}

/** Keeps only the latest failed login. It is sent after the next successful login. */
export function reportLoginFailure(context: vscode.ExtensionContext, authMethod: AuthMethod): void {
  const pending: PendingLoginFailure = { authMethod, loginTimestamp: new Date().toISOString() };
  void context.globalState.update(constants.getPendingLoginFailureKey(), pending);
}

async function flushPendingLoginFailure(context: vscode.ExtensionContext): Promise<void> {
  const key = constants.getPendingLoginFailureKey();
  const pending = context.globalState.get<PendingLoginFailure>(key);
  if (!pending) {
    return;
  }
  const delivered = await emitStoredLoginFailure(pending.authMethod, pending.loginTimestamp);
  if (delivered) {
    await context.globalState.update(key, undefined);
  }
}

/** Maps the auth webview's method ("oauth" | "apiKey") to the telemetry value. */
export function toAuthMethod(method: string | undefined): AuthMethod {
  return method === "oauth" ? "OAuth" : "APIKey";
}
