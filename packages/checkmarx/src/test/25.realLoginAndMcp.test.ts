import {
  By,
  EditorView,
  VSBrowser,
  WebDriver,
  WebView,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { confirmLogoutToast, loginWithMockToken, sleep } from "./utils/utils";

// Real-tenant suite (needs CX_APIKEY, i.e. TEST=uiEndToEnd):
//  1. drives the authentication window like a user (type API key, click "Log in")
//  2. verifies the MCP configuration written after login holds the REAL values
//     (tenant host, real token) and not the mock placeholder.
// The token is only ever compared, never logged.

// Exact command palette label: extest only picks the entry whose label equals this text;
// anything else (a prefix or a command ID) presses Enter on the top fuzzy match, which VS Code
// ranks by recent use, so a different command can run.
const CX_AUTHENTICATION_COMMAND = "Checkmarx: Checkmarx: Show Authentication";
const AUTH_EDITOR_TITLE = "Checkmarx Authentication";
const MCP_AUTH_SETTING = "Checkmarx.MCP Authentication";
const MOCK_TOKEN = "FAKE_TOKEN_FROM_TEST";
// constants.getMcpServerName() for the Checkmarx One extension; "Checkmarx" is the pre-rename name,
// which the extension migrates and removes on every write.
const SERVER_NAME = "Checkmarx One Assist";
const LEGACY_SERVER_NAME = "Checkmarx";

const REAL_KEY = process.env.CX_APIKEY ?? "";

// extest keeps the test VS Code profile under <tmp>/test-resources/settings
const TEST_SETTINGS_FILE = path.join(os.tmpdir(), "test-resources", "settings", "User", "settings.json");
// Fallback location the extension writes when it cannot update settings.json (Windows/macOS/Linux)
function fallbackMcpJson(): string {
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "Code", "User", "mcp.json");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Code", "User", "mcp.json");
  }
  return path.join(home, ".config", "Code", "User", "mcp.json");
}

interface McpEntry {
  url?: string;
  serverUrl?: string;
  headers?: Record<string, string>;
}

// Parsed JSON of arbitrary shape (settings.json / mcp.json); callers read optional keys.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return undefined;
  }
}

// Updates the test profile settings.json (merge); `undefined` value removes the key.
function updateTestSettings(patch: Record<string, unknown>): void {
  const current = readJson(TEST_SETTINGS_FILE) ?? {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete current[key];
    } else {
      current[key] = value;
    }
  }
  fs.writeFileSync(TEST_SETTINGS_FILE, JSON.stringify(current, null, 2), "utf-8");
}

// Looks for the Checkmarx MCP server entry in settings.json ("mcp.servers") or the mcp.json fallback.
function findMcpEntry(): { entry: McpEntry; source: string } | undefined {
  const fromSettings = readJson(TEST_SETTINGS_FILE)?.mcp?.servers?.[SERVER_NAME];
  if (fromSettings) {
    return { entry: fromSettings, source: "settings.json" };
  }
  const fromFile = readJson(fallbackMcpJson())?.servers?.[SERVER_NAME];
  if (fromFile) {
    return { entry: fromFile, source: "mcp.json" };
  }
  return undefined;
}

// Server names only (never values, which hold tokens) from a settings/mcp JSON file.
function describeServers(file: string): string {
  if (!fs.existsSync(file)) {
    return `${file}: missing`;
  }
  const json = readJson(file);
  if (json === undefined) {
    return `${file}: not valid JSON`;
  }
  const servers = json.mcp?.servers ?? json.servers ?? json.mcpServers;
  return `${file}: servers=${JSON.stringify(Object.keys(servers ?? {}))}`;
}

// What the extension had to work with when no MCP entry appeared: which extensions VS Code has
// registered (the post-login install needs an AI assistant such as Copilot Chat) and which
// candidate config files exist. Prints names only.
function describeMcpSetup(): string {
  const lines: string[] = [];
  const extensionsDir = process.env.EXTENSIONS_FOLDER || path.join(os.homedir(), ".vscode", "extensions");
  const registry = path.join(extensionsDir, "extensions.json");
  const folders = fs.existsSync(extensionsDir) ? fs.readdirSync(extensionsDir) : [];
  lines.push(`extensions dir ${extensionsDir}: ${JSON.stringify(folders)}`);
  const registered = readJson(registry);
  lines.push(
    Array.isArray(registered)
      ? `extensions.json ids: ${JSON.stringify(registered.map((e: { identifier?: { id?: string } }) => e.identifier?.id))}`
      : `extensions.json: ${fs.existsSync(registry) ? "unreadable" : "missing"}`
  );
  const settings = readJson(TEST_SETTINGS_FILE);
  // "Checkmarx.MCP Authentication" etc. hold modes, not secrets; the "mcp" object is reported by name only.
  const settingKeys = Object.keys(settings ?? {}).filter((k) => /mcp|assist/i.test(k));
  lines.push(
    `settings.json: ${JSON.stringify(settingKeys.map((k) => (k === "mcp" ? k : `${k}=${JSON.stringify(settings[k])}`)))}`
  );
  for (const file of [TEST_SETTINGS_FILE, fallbackMcpJson(), path.join(os.homedir(), ".vscode", "mcp.json")]) {
    lines.push(describeServers(file));
  }
  return lines.join("\n");
}

async function waitForMcpEntry(timeoutMs: number): Promise<{ entry: McpEntry; source: string } | undefined> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = findMcpEntry();
    if (found) {
      return found;
    }
    await sleep(1000);
  }
  return undefined;
}

// Reads the claims we need from the real JWT (no signature check, no logging of the token).
function decodeClaims(token: string): { iss: string; host: string; tenant: string } {
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf-8"));
  const iss: string = payload.iss;
  const url = new URL(iss);
  return { iss, host: url.hostname, tenant: url.pathname.split("/").filter(Boolean).pop() ?? "" };
}

function removeMcpEntries(): void {
  updateTestSettings({ mcp: undefined });
  const fallback = fallbackMcpJson();
  const json = readJson(fallback);
  const names = [SERVER_NAME, LEGACY_SERVER_NAME].filter((n) => json?.servers?.[n]);
  if (names.length > 0) {
    for (const name of names) {
      delete json.servers[name];
    }
    fs.writeFileSync(fallback, JSON.stringify(json, null, 2), "utf-8");
  }
}

// The mcp.json fallback lives in the machine's real VS Code profile, not the test profile, so a local
// run would otherwise delete the developer's own entry. Snapshot it byte for byte (or its absence)
// and put it back after the suite.
let fallbackSnapshot: Buffer | null | undefined;
function snapshotFallbackMcpJson(): void {
  const file = fallbackMcpJson();
  fallbackSnapshot = fs.existsSync(file) ? fs.readFileSync(file) : null;
}
function restoreFallbackMcpJson(): void {
  if (fallbackSnapshot === undefined) {
    return;
  }
  const file = fallbackMcpJson();
  if (fallbackSnapshot === null) {
    fs.rmSync(file, { force: true });
  } else {
    fs.writeFileSync(file, fallbackSnapshot);
  }
}

// The legacy name must not survive a write, in either location.
function hasLegacyEntry(): boolean {
  return Boolean(
    readJson(TEST_SETTINGS_FILE)?.mcp?.servers?.[LEGACY_SERVER_NAME] ?? readJson(fallbackMcpJson())?.servers?.[LEGACY_SERVER_NAME]
  );
}

describe("Checkmarx real login and MCP configuration", function () {
  let bench: Workbench;
  let driver: WebDriver;

  async function openAuthenticationWebView(): Promise<WebView> {
    // Close leftover tabs (e.g. the Welcome webview after a login) so we switch into the auth frame, not theirs.
    try {
      await new EditorView().closeAllEditors();
    } catch {
      await clickModalDialogButton(/don'?t save|discard/i);
    }
    await bench.executeCommand(CX_AUTHENTICATION_COMMAND);
    await sleep(3000);
    await new EditorView().openEditor(AUTH_EDITOR_TITLE);
    const webView = new WebView();
    await webView.switchToFrame(10000);
    return webView;
  }

  async function safeSwitchBack(webView: WebView): Promise<void> {
    try {
      await webView.switchBack();
    } catch {
      // frame may already be detached
    }
  }

  async function waitForVisible(webView: WebView, id: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const els = await webView.findWebElements(By.id(id));
      if (els.length > 0 && (await els[0].isDisplayed())) {
        return;
      }
      await sleep(300);
    }
    throw new Error(`Timed out waiting for visible element: ${id}`);
  }

  async function isVisible(webView: WebView, id: string): Promise<boolean> {
    const els = await webView.findWebElements(By.id(id));
    return els.length > 0 && (await els[0].isDisplayed());
  }

  // Logs out through the window if the extension is currently logged in.
  async function ensureLoggedOut(webView: WebView): Promise<void> {
    let logoutConfirmed: boolean | undefined;
    if (await isVisible(webView, "logoutButton")) {
      const logout = await webView.findWebElement(By.id("logoutButton"));
      await logout.click();
      await safeSwitchBack(webView);
      // the confirmation can take a moment to appear: poll for it
      let confirmed = false;
      for (let i = 0; i < 15 && !confirmed; i++) {
        await sleep(1000);
        confirmed =
          (await confirmLogoutToast(driver, "Are you sure you want to log out?", 2000)) ||
          (await clickModalDialogButton(/yes|log ?out|confirm|ok/i));
      }
      logoutConfirmed = confirmed;
      await webView.switchToFrame(5000);
    }
    try {
      await waitForVisible(webView, "loginForm", 15000);
    } catch (e) {
      await safeSwitchBack(webView);
      const toasts = await driver.findElements(By.className("notification-toast"));
      const dialogs = await driver.findElements(By.css(".monaco-dialog-box"));
      const seen: string[] = [];
      for (const el of [...toasts, ...dialogs]) {
        try { seen.push((await el.getText()).replace(/s+/g, " ").slice(0, 200)); } catch { /* gone */ }
      }
      throw new Error(`Logout did not show the login form (confirmation clicked: ${logoutConfirmed}). Visible toasts/dialogs: ${JSON.stringify(seen)}`);
    }
  }

  // Clicks a button in a VS Code modal dialog whose label matches (best-effort).
  async function clickModalDialogButton(label: RegExp): Promise<boolean> {
    const buttons = await driver.findElements(By.css(".monaco-dialog-box .dialog-buttons .monaco-button"));
    for (const button of buttons) {
      try {
        if (label.test(await button.getText())) {
          await button.click();
          await sleep(1500);
          return true;
        }
      } catch {
        // try next
      }
    }
    return false;
  }

  // The page toggles forms via DOM state (there are no radio buttons any more).
  async function showApiKeyForm(): Promise<void> {
    await driver.executeScript(`
      const oauth = document.getElementById('oauthForm');
      const apiKey = document.getElementById('apiKeyForm');
      if (oauth) oauth.classList.add('hidden');
      if (apiKey) apiKey.classList.remove('hidden');
      const method = document.getElementById('authMethod');
      if (method) method.value = 'apiKey';
      const input = document.getElementById('apiKey');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `);
  }

  // Full user journey: logout -> API Key form -> type key -> Log in -> wait for authenticated state.
  async function loginWithApiKeyThroughWindow(): Promise<void> {
    const webView = await openAuthenticationWebView();
    try {
      await ensureLoggedOut(webView);
      await showApiKeyForm();

      const apiKeyInput = await webView.findWebElement(By.id("apiKey"));
      expect(await apiKeyInput.isDisplayed(), "API key field should be visible").to.equal(true);
      const authButton = await webView.findWebElement(By.id("authButton"));
      expect(await authButton.getAttribute("disabled"), "Log in is disabled while the key is empty").to.equal("true");

      await apiKeyInput.sendKeys(REAL_KEY);
      await driver.wait(async () => (await authButton.getAttribute("disabled")) === null, 10000, "Log in did not enable after typing the key");
      await authButton.click();

      // On success the panel closes itself and the Welcome tab opens. Leave the frame and poll tab titles.
      await safeSwitchBack(webView);
      const start = Date.now();
      let ok = false;
      while (Date.now() - start < 60000) {
        const titles = await new EditorView().getOpenEditorTitles();
        if (titles.includes("Welcome to Checkmarx") || !titles.includes(AUTH_EDITOR_TITLE)) {
          ok = true;
          break;
        }
        await sleep(1000);
      }
      if (!ok) {
        // still on the auth window: report whatever banner it shows
        await new EditorView().openEditor(AUTH_EDITOR_TITLE);
        await webView.switchToFrame(5000);
        const texts = await webView.findWebElements(By.id("messageText"));
        const banner = texts.length > 0 ? await texts[0].getText() : "(no banner)";
        throw new Error("Authenticated state was not reached after clicking Log in. Window says: " + banner);
      }
    } finally {
      await safeSwitchBack(webView);
    }
  }

  before(async function () {
    this.timeout(30000);
    if (!REAL_KEY) {
      this.skip();
    }
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    snapshotFallbackMcpJson();
    removeMcpEntries();
  });

  afterEach(async function () {
    removeMcpEntries();
  });

  after(async function () {
    this.timeout(60000);
    if (!REAL_KEY) {
      return;
    }
    try {
      updateTestSettings({ [MCP_AUTH_SETTING]: undefined });
      await loginWithMockToken(bench, { waitMs: 1000 });
      try {
        await new EditorView().closeAllEditors();
      } catch {
        // a dirty settings.json can raise a modal "save changes?" prompt
        await clickModalDialogButton(/don'?t save|discard/i);
        try { await new EditorView().closeAllEditors(); } catch { /* best effort */ }
      }
    } finally {
      // last, so the mock login above cannot rewrite it afterwards
      restoreFallbackMcpJson();
    }
  });

  it("should expose the API key login fields and enable Log in only when a key is typed", async function () {
    this.timeout(90000);
    const webView = await openAuthenticationWebView();
    try {
      await ensureLoggedOut(webView);
      await showApiKeyForm();
      const form = await webView.findWebElement(By.id("apiKeyForm"));
      expect(await form.getText()).to.include("Checkmarx One API Key");
      const authButton = await webView.findWebElement(By.id("authButton"));
      expect(await authButton.getAttribute("disabled")).to.equal("true");
      const input = await webView.findWebElement(By.id("apiKey"));
      await input.sendKeys("x");
      expect(await authButton.getAttribute("disabled")).to.equal(null);
    } finally {
      await safeSwitchBack(webView);
    }
  });

  it("should log in with the real API key and write a real Token Based MCP configuration", async function () {
    this.timeout(240000);
    const claims = decodeClaims(REAL_KEY);
    updateTestSettings({ [MCP_AUTH_SETTING]: "Token Based" });

    await loginWithApiKeyThroughWindow();

    const found = await waitForMcpEntry(90000);
    expect(
      found,
      `MCP entry for the Checkmarx server should be written after login (is MCP enabled for the tenant?)\n${found ? "" : describeMcpSetup()}`
    ).to.not.equal(undefined);
    const { entry } = found!;
    expect(hasLegacyEntry(), `legacy "${LEGACY_SERVER_NAME}" MCP entry should not be written`).to.equal(false);

    const url = entry.url ?? entry.serverUrl ?? "";
    expect(url).to.match(/^https:\/\//, "MCP url should be https");
    expect(url).to.include("/api/security-mcp/mcp");
    // multi-tenant issuer iam.checkmarx.* maps to ast.checkmarx.*; single-tenant uses the issuer host
    const expectedHost = claims.host.includes("iam.checkmarx") ? claims.host.replace("iam", "ast") : claims.host;
    expect(new URL(url).hostname).to.equal(expectedHost);

    const auth = entry.headers?.Authorization;
    expect(auth, "Authorization header should exist").to.be.a("string").and.not.equal("");
    expect(auth).to.not.equal(MOCK_TOKEN, "MCP must not hold the mock token");
    expect(auth).to.equal(REAL_KEY, "MCP Authorization must equal the logged-in API key");
    expect(entry.headers?.["cx-origin"], "cx-origin header should exist").to.be.a("string").and.not.equal("");
  });

  it("should write an OAuth MCP configuration with the real tenant URL and no embedded token", async function () {
    this.timeout(240000);
    const claims = decodeClaims(REAL_KEY);
    updateTestSettings({ [MCP_AUTH_SETTING]: "OAuth" });

    await loginWithApiKeyThroughWindow();

    const found = await waitForMcpEntry(90000);
    expect(found, `MCP entry for the Checkmarx server should be written after login\n${found ? "" : describeMcpSetup()}`).to.not.equal(undefined);
    const { entry } = found!;

    const url = entry.url ?? entry.serverUrl ?? "";
    expect(url).to.include("/api/security-mcp/mcp/");
    expect(url.endsWith(`/${claims.tenant}`), "URL should end with the real tenant name").to.equal(true);
    const serialized = JSON.stringify(entry);
    expect(serialized.includes(REAL_KEY), "OAuth mode must not embed the API key").to.equal(false);
    expect(serialized.includes(MOCK_TOKEN)).to.equal(false);
  });
});
