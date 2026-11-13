# AST-184025: VS Code Dev Assist analytics events

This document describes how the VS Code extensions and the JavaScript wrapper will emit the analytics events needed for the Dev Assist ROI and usage dashboard. It covers the Checkmarx One extension and the Checkmarx Developer Assist extension.

- **Epic:** [AST-184025](https://checkmarx.atlassian.net/browse/AST-184025), VS Code IDE: emit event data for the Analytics and Gainsight dashboard
- **Technical design:** [Enhance Dev Assist Analytics Dashboard: Technical Design](https://checkmarx.atlassian.net/wiki/spaces/AID/pages/10325360800)
- **Depends on:** [AST-182268](https://checkmarx.atlassian.net/browse/AST-182268) (AST-CLI common metrics) and [AST-184024](https://checkmarx.atlassian.net/browse/AST-184024) (Realtime Scanner API)

## 1. How an event travels

```
VS Code extension ──► JS wrapper ──► cx telemetry ai ──► POST /api/realtime-scanner/log ──► RabbitMQ
 (IDE fields)          (CLI args)     (adds sessionId,        (adds tenantId, userId       (routing key
                                       uniqueId,               from the JWT; checks         per event)
                                       machineUniqueId)        the feature flag)
```

Each layer adds only the fields it can know:

| Field | Set by |
|---|---|
| `agent`, `agentVersion`, `cxPluginVersion`, `pluginType`, `repoUrl` | VS Code extension (common envelope) |
| `type`, `subType`, `engine`, `problemSeverity`, `totalCount`, `aiProvider`, `status`, `statusResult`, `eventAttributes.*` | VS Code extension (depends on the event) |
| `sessionId`, `uniqueId`, `machineUniqueId` | AST-CLI |
| `tenantId`, `userId`, `eventId` | Realtime Scanner API |

The feature flags (`DEV_ASSIST_ANALYTICS_ENABLED` and `USAGE_DEV_ASSIST_API_ENABLED`) are checked on the server. The IDE always emits events and does not check either flag.

## 2. Current state

These findings come from the code at the time of writing.

### JS wrapper (`ast-cli-javascript-wrapper` v0.0.166, CLI 2.3.69)

- There is one method: `telemetryAIEvent(aiProvider, eventType, subType, engine, problemSeverity, scanType, status, totalCount)`.
- It always sends every flag, even when the value is an empty string.
- `--agent` is not a parameter. `initializeCommands()` adds it from `CxConfig.agentName` to every command.
- The bundled CLI 2.3.69 supports only `--agent, --ai-provider, --engine, --problem-severity, --scan-type, --status, --sub-type, --total-count, --type`.

### VS Code extension (`packages/core`)

| Area | Current behavior | Location |
|---|---|---|
| Scan events | One CLI process is spawned **per severity**, so up to 5 per scan. Severities with zero findings are skipped. | `realtimeScanners/scanners/common.ts` `logScanResults` |
| Engine coverage | ASCA, Secrets and IaC send scan events. **OSS and Containers send none.** | `*ScannerService.ts` |
| Click events | `fixWithAIChat`, `viewDetails`, `ignorePackage` and `ignoreAll` are sent **before** the action runs. `aiProvider` is the IDE name, not the AI assistant. | `commands/openAIChatCommand.ts` `logUserEvent` |
| Agent name | `"<IDE>_<extensionVersion>"`, for example `VS Code_2.74.0`, sent on every CLI call | `cx/cx.ts` `getBaseAstConfiguration` |
| IDE version | `vscode.version` is never read | — |
| Login events | None | `authenticationWebview.ts` (both packages) |
| Install events | None. No `installationId` exists. | — |
| Repo URL | Only `owner/repo` is derived; the raw remote URL is never read | `utils/utils.ts` `getRepositoryFullName` |
| Dead code | `sendAIFixOutcomeTelemetry` computes `agent` and `subTypeData` and never uses them. Nothing in production calls it. | `cx/cx.ts` |
| Unit mock | The wrapper mock has no `telemetryAIEvent` | `unit/mocks/cxWrapper-mock.ts` |

## 3. Changes in the JS wrapper

1. **Constants.** Add `AGENT_VERSION`, `CX_PLUGIN_VERSION`, `PLUGIN_TYPE`, `STATUS_RESULT`, `REPO_URL` and `EVENT_ATTRIBUTES` to `CxConstants.ts`. Use the final flag names from AST-182268.
2. **New method.** Add a method that takes an options object. Keep `telemetryAIEvent` unchanged so other plugins that call it keep working.

   ```ts
   export interface TelemetryEventOptions {
     aiProvider?: string; eventType?: string; subType?: string; engine?: string;
     problemSeverity?: string; scanType?: string; status?: string; totalCount?: number;
     agent?: string; agentVersion?: string; cxPluginVersion?: string; pluginType?: string;
     statusResult?: string; repoUrl?: string;
     eventAttributes?: Record<string, string>;
   }

   telemetryEvent(opts: TelemetryEventOptions): Promise<CxCommandOutput>
   ```

   - Send a flag only when its value is set.
   - Serialize `eventAttributes` as `key=value;key=value`. Replace any `;` or `=` inside a value with `_` (see 6.1).
   - Send the event's `--agent` value **instead of** the `--agent` from `CxConfig`, not as well as it. Cobra keeps the last value of a repeated flag, so sending both is unreliable.
3. **CLI version.** Move to the first AST-CLI release that has the new flags. Use the `update-cli.yml` workflow or `.github/scripts/update_cli.sh <tag>`. Before that release exists, build a dev wrapper with the `cliTag` input of `release.yml`.
4. **Tests.**
   - Add a unit test of the generated arguments. It must check that empty values are left out and that attributes are serialized correctly.
   - Extend the integration tests in `TelemetryTest.test.ts` with one case per event type.
5. **Release** wrapper `0.0.167`.

## 4. Changes in the VS Code extension

### 4.1 One telemetry service

Add `packages/core/src/services/telemetryService.ts`. It replaces `setUserEventDataForLogs`, `setUserEventDataForDetectionLogs` and `sendAIFixOutcomeTelemetry`.

- `buildEnvelope()` works out these values once and caches them:
  - `agent`: the IDE name from `getIdeInfo()`: `VS Code`, `Cursor`, `Windsurf`, `Devin` or `Kiro`. See 4.2.
  - `agentVersion`: the IDE version from `getIdeVersion()`. See 4.2 ([AST-188318](https://checkmarx.atlassian.net/browse/AST-188318)).
  - `cxPluginVersion`: the version in the extension's `package.json`
  - `pluginType`: `IDE`
  - `repoUrl`: see 4.10
- `emit(event)` sends the event without waiting for the result:
  - It never throws and never shows anything to the user.
  - It logs failures at `debug` level in the "Checkmarx" output channel.
- Add the service to the `CxPlatform` interface and to `CxMock`.
- Do **not** change the `CxConfig.agentName` value used by other CLI calls, as the epic requires.

### 4.2 Supported IDEs

Both extensions run in VS Code and in the IDEs built on it. **Every event in this document must work in all of them, and must say which IDE it came from.** No event may be limited to VS Code.

| IDE | `vscode.env.appName` contains | `agent` | `installationId` prefix | Native AI assistant (`aiProvider`) |
|---|---|---|---|---|
| VS Code (Stable and Insiders) | `Visual Studio Code` | `VS Code` | `vscode` | none: uses the Copilot, Claude or Codex extension |
| Cursor | `Cursor` | `Cursor` | `cursor` | `Cursor` |
| Windsurf, Windsurf - Next | `Windsurf` | `Windsurf` | `windsurf` | `Cascade` |
| Devin, Devin - Next | `Devin` | `Devin` | `devin` | `Cascade` |
| Kiro | `Kiro` | `Kiro` | `kiro` | `Kiro` |

#### One IDE helper

Today IDE detection is copied in several places, and the copies don't agree: `cx.ts` `getBaseAstConfiguration`, `cx.ts` `setUserEventDataForLogs`, `cx.ts` `sendAIFixOutcomeTelemetry`, `mcpSettingsInjector.ts` `getCxOrigin`, and `openAIChatCommand.ts` `openChatWithPrompt`. Windsurf, for example, is "Windsurf" in one place and "Cascade" in another.

Add one helper, `packages/core/src/utils/ideInfo.ts`:

```ts
export type IdeKind = "vscode" | "cursor" | "windsurf" | "devin" | "kiro";

export interface IdeInfo {
  kind: IdeKind;
  agent: string;              // "VS Code" | "Cursor" | "Windsurf" | "Devin" | "Kiro"
  installPrefix: string;      // "vscode" | "cursor" | "windsurf" | "devin" | "kiro"
  nativeAiProvider?: string;  // "Cursor" | "Cascade" | "Kiro"; undefined for VS Code
}

export function getIdeKind(): IdeKind {
  // Order matters: it matches getBaseAstConfiguration today, so
  // "Windsurf - Next" and "Devin - Next" resolve correctly.
  if (isIDE(constants.kiroAgent)) { return "kiro"; }
  if (isIDE(constants.cursorAgent)) { return "cursor"; }
  if (isIDE(constants.devinAgent) || isIDE(constants.devinNextAgent)) { return "devin"; }
  if (isIDE(constants.windsurfAgent) || isIDE(constants.windsurfNextAgent)) { return "windsurf"; }
  return "vscode";   // also covers VS Code Insiders and any other unknown fork
}

export function getIdeInfo(): IdeInfo { /* table lookup on getIdeKind() */ }
export function getIdeVersion(): string { /* see "IDE version" below */ }
```

- Every caller that needs to know the IDE uses `getIdeKind()`.
- Callers that send a value **outside** analytics keep their own strings: the `--agent` header from `getBaseAstConfiguration` (`VS Code_2.74.0`, and so on) and the MCP origin from `getCxOrigin` (`VsCode`, and so on). Only the detection logic is shared; the values those callers send don't change.
- An unknown fork is reported as `VS Code`. Adding a new IDE later means adding one row to the table and one check to `getIdeKind()`.

#### IDE version (`agentVersion`)

**Why this is needed.** The extension API `vscode.version` reports the version of the VS Code *engine*. In VS Code that is the real product version. A fork keeps its own version number, but reports the engine it is built on to extensions, so that extension compatibility checks (`engines.vscode`) keep working. If we send `vscode.version` from a fork:
- the dashboard shows `1.128.0` for a Cursor user who is actually running Cursor `3.27.22`;
- every Cursor release built on the same engine looks identical;
- different IDEs can report the same number, so a version is meaningless without the `agent` next to it.

Analytics and support need the version the user actually sees in Help → About, for example to find which Cursor releases a problem affects.

**Where the real version is.** Every VS Code-based IDE ships a `product.json` in its install folder. `vscode.env.appRoot` points to that folder (`…/resources/app`). The file holds the product name and versions, but **each fork uses different field names**. These values come from the `product.json` files installed on a Windows machine on 2026-11-12:

| IDE | Its own version (Help → About) | Engine version | Field for its own version | Field for the engine version |
|---|---|---|---|---|
| VS Code | `1.146.0` | same | `version` | `version` |
| Cursor | `3.27.22` | `1.128.0` | `version` | `vscodeVersion` |
| Kiro | `1.4.86` | `1.131.0` | `version` | `vsCodeVersion` (note the capital C) |
| Devin | `3.11.238` | `1.126.0` | `windsurfVersion` | `version` (**the opposite of Cursor and Kiro**) |
| Windsurf | to be checked (not installed); probably like Devin | | probably `windsurfVersion` | probably `version` |

So no single field works everywhere. Reading `version` would be right for Cursor and Kiro and wrong for Devin.

**Implementation**, in `utils/ideInfo.ts`:

```ts
// Field that holds the IDE's own version in product.json, per IDE.
const OWN_VERSION_FIELD: Record<IdeKind, string> = {
  vscode: "version",
  cursor: "version",
  kiro: "version",
  devin: "windsurfVersion",
  windsurf: "windsurfVersion",   // confirm on a Windsurf install
};

let cachedIdeVersion: string | undefined;

export function getIdeVersion(): string {
  if (cachedIdeVersion !== undefined) { return cachedIdeVersion; }
  let version = vscode.version;                       // safe default
  try {
    const productPath = path.join(vscode.env.appRoot, "product.json");
    const product = JSON.parse(fs.readFileSync(productPath, "utf8"));
    const value = product[OWN_VERSION_FIELD[getIdeKind()]];
    if (typeof value === "string" && /^\d+\.\d+/.test(value)) { version = value; }
  } catch {
    // unreadable or missing file: keep vscode.version
  }
  cachedIdeVersion = version;
  return version;
}
```

- The file is read **once** per session. It is a small local file, so this has no noticeable cost.
- The fallback is `vscode.version`. A fork that renames its field, or a sandboxed install that can't read the file, still sends a usable value, never an empty one.
- The version check (`/^\d+\.\d+/`) stops a non-version string from being sent.

**Still to check:**
- Confirm the field on a Windsurf install.
- In each fork, log `vscode.version` once, to confirm it really returns the engine version (expected: Cursor `1.128.0`, Kiro `1.131.0`, Devin `1.126.0`).
- Re-check the fields when a fork ships a major update. The unit test pins the field table, so a change shows up as one line to update.

#### Each event in each IDE

| Event | What changes by IDE | What is the same everywhere |
|---|---|---|
| Install | `installationId` prefix. Each IDE has its own `globalState`, so VS Code and Cursor on the same machine get **separate** IDs and separate install events. That is correct, because they are separate installs. | The pending-event logic |
| Login | Only the envelope (`agent`, `agentVersion`) | Same auth webviews and `authService` in every IDE. The OAuth browser flow must be checked in each IDE. |
| Scan | Only the envelope | Same 5 realtime scanners |
| Remediation | `aiProvider`. In a fork with **Prefer Native AI Assistant** on (the default), it is the native assistant from the table. If that setting is off, or in VS Code, it is the extension actually used: `Copilot`, `Claude` or `Codex`. | `vulnerabilityId`, `remediationMode` |
| Repository URL | Forks ship the built-in `vscode.git` extension, but a user can disable it. In that case `repoUrl` is empty. | Same sanitizing |

#### Testing matrix

Each IDE gets a manual check on Windows, macOS and Linux: VS Code, VS Code Insiders, Cursor, Windsurf, Windsurf - Next, Devin, Kiro. For each one:
- [ ] A clean install sends one install event with the right prefix.
- [ ] A login sends `agent` and `agentVersion` correctly, for both OAuth and API key where the extension supports them.
- [ ] One scan per engine sends one event.
- [ ] "Fix with AI" sends the right `aiProvider`, with **Prefer Native AI Assistant** both on and off.
- [ ] `repoUrl` is filled in for a git workspace and empty without git.

Unit tests stub `vscode.env.appName` with every value in the table, including `Windsurf - Next`, `Devin - Next` and `Visual Studio Code - Insiders`. They check `getIdeKind()`, the envelope, the install prefix and `aiProvider`.

### 4.3 Events: summary

| Event | `type` / `subType` | Trigger | Event-specific fields |
|---|---|---|---|
| Install | `install` / `installation` | First activation that finds no `installationId` | `eventAttributes.installationId`, `eventAttributes.installationTimestamp` |
| Login | `authentication` / `authentication` | The user signs in interactively with OAuth or an API key | `eventAttributes.authMethod`, `eventAttributes.loginTimestamp`, `status`, `statusResult` |
| Scan | `Scan` / `scantriggerd` | A realtime scan finishes or fails, on any engine | `engine`, `problemSeverity`, `totalCount`, `statusResult`, `repoUrl`, `eventAttributes.apiVersion` |
| Remediation | `click` / `fixWithAIChat` | "Fix with AI" sends the prompt to an assistant | `aiProvider`, `engine`, `problemSeverity`, `repoUrl`, `eventAttributes.vulnerabilityId`, `eventAttributes.remediationMode` |

### 4.4 Shared types and service API

New file `packages/core/src/models/telemetryEvent.ts`:

```ts
export type TelemetryStatus = "Success" | "Failure";

export interface TelemetryEvent {
  type: "install" | "authentication" | "Scan" | "click";
  subType: string;
  engine?: string;
  problemSeverity?: string;
  totalCount?: number;
  aiProvider?: string;
  status: TelemetryStatus;
  statusResult?: string;
  repoUrl?: string;
  eventAttributes?: Record<string, string>;
}
```

The `telemetryService` (see 4.1) exposes two methods:

```ts
// Fire-and-forget. Used by scan and click events. Never throws.
emit(event: TelemetryEvent): void;

// Same, but resolves to true only when the CLI exits with code 0.
// Used where the caller must know the event was delivered (pending install / login queue).
emitAndWait(event: TelemetryEvent): Promise<boolean>;
```

Both merge in the common envelope (`agent`, `agentVersion`, `cxPluginVersion`, `pluginType`) and call `wrapper.telemetryEvent(...)`. Before anything is sent, `statusResult` is truncated to 256 characters and stripped of anything that looks like a token or key.

### 4.5 Install event: implementation

**New `globalState` keys** in `utils/common/constants.ts`. Each extension gets its own key, following the pattern of `getLastAuthMethodKey()`:

```ts
getInstallationIdKey: (): string =>
  getExtensionType() === 'checkmarx' ? 'cxInstallationId' : 'cxInstallationIdDevAssist',
getPendingInstallEventKey: (): string =>
  getExtensionType() === 'checkmarx' ? 'cxPendingInstallEvent' : 'cxPendingInstallEventDevAssist',
```

**New file `packages/core/src/services/installationTracker.ts`:**

```ts
import * as crypto from "crypto";   // v4 UUID; falls back to randomBytes where crypto.randomUUID is missing (Node < 14.17)

interface PendingInstallEvent { installationId: string; installationTimestamp: string; }

// Called on every activation. Does nothing after the first run.
export async function ensureInstallationId(context: vscode.ExtensionContext): Promise<void> {
  const key = constants.getInstallationIdKey();
  if (context.globalState.get<string>(key)) { return; }

  const installationId = `${getIdePrefix()}-${generateUuidV4()}`;   // e.g. vscode-7f3a9b2c-...
  const pending: PendingInstallEvent = { installationId, installationTimestamp: new Date().toISOString() };
  await context.globalState.update(key, installationId);
  await context.globalState.update(constants.getPendingInstallEventKey(), pending);
}

// Sends the pending install event if there is one. Clears it only when delivery succeeded.
export async function flushPendingInstallEvent(context: vscode.ExtensionContext): Promise<void> {
  const pendingKey = constants.getPendingInstallEventKey();
  const pending = context.globalState.get<PendingInstallEvent>(pendingKey);
  if (!pending) { return; }

  const delivered = await telemetryService.emitAndWait({
    type: "install",
    subType: "installation",
    status: "Success",
    statusResult: "Plugin installed successfully.",
    eventAttributes: { ...pending },
  });
  if (delivered) { await context.globalState.update(pendingKey, undefined); }
}
```

`getIdePrefix()` returns `getIdeInfo().installPrefix` from 4.2: `vscode`, `cursor`, `windsurf`, `devin` or `kiro`. Each IDE keeps its own `globalState`, so every IDE on a machine gets its own `installationId`.

**Where it is called:**

| Location | Change |
|---|---|
| `activate/activateCore.ts`, before `authService.validateAndUpdateState()` (line 49) | `await ensureInstallationId(context);` |
| `activate/activateCore.ts`, after `validateAndUpdateState()` | `if (isValid) { void flushPendingInstallEvent(context); }`. Not awaited, so activation isn't slowed down. |
| After each successful interactive login (see 4.6) | `void flushPendingInstallEvent(context);` |

**Behavior notes**
- The event time is when the event is *sent*, which may be days after the install. The real install time goes in `eventAttributes.installationTimestamp`, which the CLI example in the design already includes.
- Updating the extension keeps `globalState`, so an upgrade is **not** counted as an install.
- Users who already have the extension get an `installationId` on their first activation after this release, so they appear as new installs once. Tell Analytics about this before rollout.
- There is no failure case: if activation fails, no event can be sent anyway.

### 4.6 Login event: implementation

**New helper** in `telemetryService`:

```ts
emitLogin(authMethod: "OAuth" | "APIKey", success: boolean, reason?: string, errorCode?: string): void
```

- On success: `status=Success`, `statusResult="Authentication successful."`
- On failure: `status=Failure`, `statusResult="Authentication failed. Reason: <reason>, Error Code: <errorCode|N/A>"`
- `eventAttributes = { authMethod, loginTimestamp: new Date().toISOString() }`

**Hook points**

| File | Branch | Emit |
|---|---|---|
| `packages/checkmarx/src/webview/authenticationWebview.ts` | OAuth, `token !== ""` (≈ line 382) | `emitLogin("OAuth", true)` and `flushPendingInstallEvent` |
| same | OAuth, `token === ""` (≈ line 389) | `emitLogin("OAuth", false, "Token validation failed")` |
| same | API key, `!isValid` (≈ line 411) | `emitLogin("APIKey", false, "API Key validation failed")` |
| same | API key, success after `saveLastAuthMethod('apiKey')` (≈ line 428) | `emitLogin("APIKey", true)` and `flushPendingInstallEvent` |
| same | outer `catch` (≈ line 448) | `emitLogin(message.authMethod === "oauth" ? "OAuth" : "APIKey", false, error.message)` |
| `packages/project-ignite/src/webview/authenticationWebview.ts` | API key, `!isValid` (≈ line 266) / success (≈ line 286) / `catch` (≈ line 287) | same as the Checkmarx One API-key rows |
| `packages/checkmarx/src/views/checkmarxAuthViewProvider.ts` | User clicks sign-in with saved OAuth credentials: `tryAutoAuthenticateOAuth()` success (≈ line 366), `reAuthenticateWithStoredOAuth()` success (≈ line 393) | `emitLogin("OAuth", true)` |

**Not emitted:** the silent check at startup (`authService.validateAndUpdateState`, called from `activateCore`), token refreshes, and logout.

**Ordering:** `authService.validateApiKey(...)` stores the key before it validates it, so the credential is already in place when the success event is sent. `saveToken` does not need to be awaited (awaiting it would delay the sign-in UI).

**Sending failed logins.** A failed login is sent **directly, best-effort**, like any other event. There is no queue. The CLI needs a valid credential to send it, so in practice a failure is delivered only when a valid credential is still stored. After a failed API-key login the key has already been deleted, so that failure is not delivered. This is the accepted limitation until the backend offers another way to receive these events.

**Security:** never put the API key, token or full error object in `statusResult`. Use `error.message` only, run it through the sanitizer from 4.4, and add unit tests that prove a key in an error message is removed.

### 4.7 Scan event: implementation

**Rewrite `realtimeScanners/scanners/common.ts`:**

```ts
const LABELS = ["Critical", "High", "Medium", "Low", "Info"] as const;
type Label = typeof LABELS[number];
const TO_LABEL: Record<string, Label> = {
  critical: "Critical", malicious: "Critical",   // OSS/Containers "Malicious" counts as Critical (to be confirmed)
  high: "High", medium: "Medium", low: "Low",
  info: "Info", unknown: "Info",                 // "Unknown" reported as Info (to be confirmed)
};

export function logScanResults(engine: string, severities: string[], filePath: string): void {
  const counts: Record<Label, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
  for (const s of severities) {
    const label = TO_LABEL[(s ?? "unknown").toLowerCase()];
    if (label) { counts[label]++; }               // "OK" (no vulnerability) is not counted
  }
  const total = LABELS.reduce((sum, l) => sum + counts[l], 0);
  if (total === 0 && !SEND_ZERO_FINDING_SCANS) { return; }   // SEND_ZERO_FINDING_SCANS = true (see 6.2, 5c)

  telemetryService.emit({
    type: "Scan",
    subType: "scantriggerd",
    engine,
    problemSeverity: LABELS.find(l => counts[l] > 0) ?? "",   // highest severity found (to be confirmed)
    totalCount: total,
    status: "Success",
    statusResult: LABELS.map(l => `${l}=${counts[l]}`).join(", "),  // "Critical=1, High=0, ..."
    repoUrl: getRepositoryRemoteUrl(filePath),
    eventAttributes: { apiVersion: "v2" },
  });
}

export function logScanFailure(engine: string, error: unknown, filePath: string): void {
  telemetryService.emit({
    type: "Scan", subType: "scantriggerd", engine, status: "Failure",
    statusResult: `Scan failed. Reason: ${sanitize(error)}, Error Code: N/A`,
    repoUrl: getRepositoryRemoteUrl(filePath),
  });
}
```

**Changes in each scanner**

| Scanner | Success: call `logScanResults` | Failure: call `logScanFailure` |
|---|---|---|
| ASCA, `ascaScannerService.ts` | Line 122: `fullScanResults.scanDetails.map(r => r.severity)` | the `catch` (line 125), and the `fullScanResults.error` early return (line 107) |
| Secrets, `secretsScannerService.ts` | Line 133: `fullScanResults.map(r => r.severity)` | the scanner's `catch` |
| IaC, `iacScannerService.ts` | Line 154: `fullScanResults.map(r => r.severity)` | the scanner's `catch` |
| **OSS**, `ossScannerService.ts` (new) | After `updateProblems` (line 186): `(fullScanResults ?? scanResults).map(p => p.status)` | the `catch` (line 188) |
| **Containers**, `containersScannerService.ts` (new) | After `updateProblems` (line 184): `this.lastFullScanResults.map(i => i.status)` | the `catch` (line 185) |

**Notes**
- Counts include ignored findings, as they do today, because every engine passes its full, unfiltered result set.
- For OSS and Containers the count is per package or image, not per CVE. That matches what the user sees in the editor. Tell Analytics.
- Engine names are sent in the casing the design uses: `Asca`, `Oss`, `Secrets`, `IaC`, `Containers`. Define them once in `constants.ts`.
- Scans that are skipped (unsupported file, scanner disabled, not authenticated) send nothing. They return before the `try` block.
- Result: one telemetry CLI process per scan instead of up to five.

### 4.8 Remediation event: implementation

**Problem today:** `logUserEvent("click", openAIChat, item)` runs as the first line of the `openAIChat` command (`openAIChatCommand.ts` line 494). At that point the assistant hasn't been chosen yet, and `aiProvider` is the IDE name.

**Change:**

1. Make `openChatWithPrompt(...)` return the assistant it actually used: `Promise<string | null>`.
   - Native IDE paths (≈ lines 284-300), used in a fork when **Prefer Native AI Assistant** is on: `getIdeInfo().nativeAiProvider`, which is `Cursor`, `Cascade` (Windsurf, Windsurf - Next, Devin, Devin - Next) or `Kiro`.
   - Extension path (≈ line 360), used in VS Code, or in a fork when that setting is off: `selectedAssistant`, which is `Copilot`, `Claude` or `Codex`.
   - No assistant available (≈ line 367): `null`.
   - Replace the inline `isIDE(...)` chain at the top of `openChatWithPrompt` with `getIdeKind()` from 4.2.
2. In the `openAIChat` command, remove the early `logUserEvent` call and emit **after** `openChatWithPrompt`:

```ts
let aiProvider: string | null = null;
let failure: string | undefined;
try {
  aiProvider = await this.openChatWithPrompt(question, fileContext);
  if (!aiProvider) { failure = "No AI assistant available"; }
} catch (e) {
  failure = sanitize(e);
  throw e;
} finally {
  telemetryService.emit({
    type: "click",
    subType: constants.openAIChat,                 // "fixWithAIChat"
    engine: getEngine(item),
    problemSeverity: getSeverity(item),
    aiProvider: aiProvider ?? "",
    status: failure ? "Failure" : "Success",
    statusResult: failure
      ? `Remediation failed. Reason: ${failure}, Error Code: N/A`
      : "Remediation completed successfully.",
    repoUrl: getRepositoryRemoteUrl(item.filePath),
    eventAttributes: {
      vulnerabilityId: getVulnerabilityId(item),
      remediationMode: "DevAssist",
    },
  });
}
```

`getEngine` and `getSeverity` are the current `logUserEvent` logic, moved into small helpers so the other click events can reuse them. "Success" here means the prompt reached the assistant; it doesn't mean the fix was applied. The design treats `fixWithAIChat` as the accept signal (§10 point 2).

**`getVulnerabilityId(item)`**, a new helper next to the hover-data type guards:

| Engine | Type guard | Value sent | Example |
|---|---|---|---|
| ASCA | `isAscaHoverData` | `String(item.ruleId ?? item.ruleName)` | `3` |
| IaC | `isIacHoverData` | `item.similarityId` | `a1b2c3…` |
| Secrets | `isSecretsHoverData` | `item.title` (no rule id exists) | `generic-api-key` |
| Containers | `isContainersHoverData` | `${item.imageName}:${item.imageTag}` | `nginx:1.19` |
| OSS | default | `${item.packageName}@${item.version}` | `lodash@4.17.20` |

For OSS and Containers, the alternative is the CVE list (`item.vulnerabilities.map(v => v.cve).join(",")`). It is still **to be confirmed** with Analytics. `package@version` is the default because one package can have dozens of CVEs.

**Other click events:** `viewDetails` (line 523), `ignorePackage` (line 550) and `ignoreAll` (line 690) keep their current trigger, before the action runs. They switch from `cx.setUserEventDataForLogs` to `telemetryService.emit`, which adds the common envelope and `repoUrl`. Their `aiProvider` keeps its current value so the existing analytics don't change.

### 4.9 Implementation checklist

- [ ] `utils/ideInfo.ts` (`getIdeKind`, `getIdeInfo`, `getIdeVersion`); replace the duplicated IDE detection in `cx.ts`, `mcpSettingsInjector.ts` and `openAIChatCommand.ts`, without changing the header or MCP origin values they send
- [ ] `models/telemetryEvent.ts`, `services/telemetryService.ts` (`emit`, `emitAndWait`, `emitLogin`, sanitizer)
- [ ] `constants.ts`: installation and pending keys, engine names
- [ ] `services/installationTracker.ts`, wired into `activateCore.ts`
- [ ] Login hooks in both `authenticationWebview.ts` files and `checkmarxAuthViewProvider.ts`
- [ ] `common.ts` rewrite; `logScanResults` and `logScanFailure` in all 5 scanners
- [ ] `openChatWithPrompt` returns the assistant; the `openAIChat` event moves after it; `getVulnerabilityId`
- [ ] Remove `setUserEventDataForLogs`, `setUserEventDataForDetectionLogs` and `sendAIFixOutcomeTelemetry` from `cx.ts` and `cxMock.ts`
- [ ] Unit tests for every item above

### 4.10 Repository URL

- Add `getRepositoryRemoteUrl(fileUri)` to `utils/utils.ts`. It uses the built-in `vscode.git` API.
- In a multi-root workspace, pick the repository that contains the scanned file.
- Prefer the `origin` remote. If there is none, use the first remote.
- **Remove credentials from the URL** before sending it. For example, `https://user:token@host/...` becomes `https://host/...`.
- Convert SSH remotes to HTTPS form: `git@host:org/repo.git` becomes `https://host/org/repo`.
- If git is not available, leave `repoUrl` empty. The field is optional.
- Turn on the git extension listener in Dev Assist as well. Today it runs only in Checkmarx One.

### 4.11 Wrapper dependency

Bump `@checkmarx/ast-cli-javascript-wrapper` to `0.0.167` in `packages/core/package.json`.

### 4.12 Tests

All unit tests go in `packages/core/src/unit/`:
- Add `telemetryEvent` to `mocks/cxWrapper-mock.ts`.
- `buildEnvelope` returns the right agent for each IDE. Stub `vscode.env.appName` and `vscode.version`.
- `logScanResults` sends a single event with the correct `statusResult`.
- `installationId` is created once and stays the same across activations. The pending install event is sent after login.
- Login events report the correct `authMethod`, success or failure.
- Remediation events use the selected assistant and the right `vulnerabilityId` for each engine.
- `getRepositoryRemoteUrl` removes credentials and converts SSH remotes.

## 5. Order of work

1. Confirm the CLI contract with the AST-182268 owner. Nothing else can start until this is done.
2. Wrapper: new method, CLI bump, tests, release.
3. VS Code: telemetry service, the shared IDE helper (4.2) and the common envelope, including `agentVersion`.
4. VS Code: one scan event per scan, plus OSS and Containers.
5. VS Code: remediation event fields.
6. VS Code: login events.
7. VS Code: install event.
8. VS Code: repository URL (after the POC).
9. Testing in every supported IDE (VS Code, VS Code Insiders, Cursor, Windsurf, Windsurf - Next, Devin, Kiro) on Windows, macOS and Linux, using the matrix in 4.2.

Steps 3 to 8 can be built against a dev wrapper that uses a pre-release CLI.

## 6. Decisions and open questions

Each question below has the approach we are implementing now. Every one of these values lives in a single constant or helper, so changing a decision later is a small change.

### 6.1 CLI flag names and attribute escaping: provisional

The AST-CLI work (AST-182268) is still in progress, so the flag names can change later. Until then:
- **Flag names:** use kebab-case, matching the existing flags: `--agent-version`, `--cx-plugin-version`, `--plugin-type`, `--status-result`, `--repo-url` and `--event-attributes`. They are defined only in the wrapper's `CxConstants.ts`, so renaming one is a one-line change.
- **Escaping:** don't invent an escaping scheme. Before serializing, the wrapper **replaces** any `;` or `=` in an attribute value with `_`. The values we send never legitimately contain either character: they are IDs, enum values, timestamps, `package@version` and `image:tag`.
- If the CLI team chooses a different format, such as JSON for `--event-attributes`, only the wrapper's serializer changes.

### 6.2 Recommended approaches

| # | Question | Approach we are taking | Why | Who confirms |
|---|---|---|---|---|
| 2 | Does `--agent` on `telemetry ai` set the payload only, or also the request header? | **It sets only the payload** (see the note below). `telemetryEvent` sends `--agent "VS Code"` (the IDE name only) and `--agent-version <IDE version>`. `CxConfig.agentName` stays `VS Code_2.74.0` for every other command, so no header changes anywhere. | Gives the payload values the design wants, and meets the epic's rule not to change the header | AST-CLI owner: one debug run to confirm |
| 3 | How are failed logins sent without a token? | **Send them directly, best-effort, with no queue.** A failure is delivered only when a valid credential is still stored, so most failed API-key logins are not delivered. | Keeps the client simple and adds no stored state. Reporting every failure needs a backend change, such as an endpoint that accepts these events without a user token. | Design owner |
| 4 | What should `agentVersion` be in forks? | **The fork's own version, falling back to `vscode.version`.** Read it once from `product.json` under `vscode.env.appRoot`, using the field found in the POC for each fork. If the field is missing or unreadable, send `vscode.version`. | The design defines `agentVersion` as "IDE or Agent Version". A Cursor user expects to see the Cursor version, and the fallback keeps the field filled. | Analytics |
| 4a | Is Devin sent as `Devin` or `Windsurf`? | **Send `Devin`.** | It is a separate product with its own app name. Analytics can merge Devin into Windsurf later, but they can't split a merged value back out. Analytics adds `Devin` to the agent list. | Analytics |
| 4b | Is `aiProvider = Cascade` right for Windsurf and Devin? | **Yes: send the native assistant's own name**: `Cursor`, `Cascade` or `Kiro`. | The current telemetry already sends `Cascade`, so historical data stays consistent. It is also the name the user sees. Analytics adds `Cascade` and `Kiro` to the provider list. | Analytics |
| 5a | What goes in `problemSeverity` for a single scan event? | **The highest severity found**, or empty when there are no findings. | Dashboards can filter scans by their worst finding, and `statusResult` still has the full breakdown. | Analytics |
| 5b | Is `Unknown` reported as `Info`? | **Yes.** OSS and Containers `Malicious` counts as `Critical`, and `OK` is not counted. | The design's severity list has no `Unknown`, and malicious packages are at least as serious as critical ones. | Analytics |
| 5c | Are scans with zero findings sent? | **Yes.** They are sent with `totalCount=0` and `statusResult="Critical=0, High=0, …"`, controlled by one constant. | Active-developer and engagement metrics (FR-04) need every scan, not only scans that found something. A clean scan is also an ROI signal. Watch the event volume after rollout; it is still at most one CLI process per scan. | Analytics |
| 6 | Is the subType spelled `scantriggerd`? | **Use the value the Realtime Scanner API already uses for detection events.** The design marks it as *Existing*. Ask the API owner for the exact string and keep it in one constant. Until then, use `scantriggerd`, as the design says. | A spelling mismatch would silently break the routing to the detection key. Fixing it once data is flowing is harder than fixing it now. | Realtime Scanner API owner |
| 7 | Is `vulnerabilityId` for OSS and Containers the CVE list or `package@version`? | **`package@version` for OSS and `image:tag` for Containers.** | One "Fix with AI" action fixes one package or image, and that is also what the prompt sends. The ID is stable and short. A CVE list can be dozens of entries long and changes as new CVEs are published. If CVEs are needed later, they can be added as a separate `cveIds` attribute. | Analytics |

**Note on question 2.** This comes from reading the code of ast-cli `origin/main`:
- `--agent` is declared on the root command (`root.go:109`) and bound to viper's `AgentNameKey` (`root.go:162`). That key sets the `User-Agent` header in `client.go` `setAgentNameAndOrigin`.
- `telemetry ai` declares its **own** local `--agent` flag (`telemetry.go:42`). In Cobra, a command's own flag hides the inherited flag of the same name. So on this command, `--agent` fills only the payload's `agent` field (`telemetry.go:56`).
- The header falls back to the CLI default. That is how it already behaves today, so nothing the epic forbids changes.
- To confirm, run `cx telemetry ai ... --agent "VS Code" --debug` behind a proxy and check the request headers.

## 7. Out of scope

- The logout, uninstall and disable events. The design doc says the IDE cannot capture them.
- Calculating metrics, the dashboard UI, and the Gainsight integration.
- Self-healing remediation. It is emitted by the CLI agent hooks, not by the IDE.
