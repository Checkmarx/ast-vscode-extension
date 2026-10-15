import {
  By,
  EditorView,
  VSBrowser,
  WebDriver,
  WebView,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  confirmLogoutToast,
  loginWithMockToken,
  retryTest,
  sleep,
} from "./utils/utils";

// TC04: OAuth login with invalid Base URL/Tenant shows an error banner.
// TC02: Invalid API Key shows the "API Key validation failed" banner.
//
// Failures tested:
//   - malformed Base URL     -> "Could not connect to server. Please check your Base URI."
//   - non-http(s) protocol   -> "Invalid URL protocol. Please use http:// or https://"
//   - unreachable https host -> generic "Authentication failed:" banner
//   - invalid API Key        -> "API Key validation failed. Please check your key."

const CX_AUTHENTICATION_COMMAND = "ast-results.showAuth";
const AUTH_EDITOR_TITLE = "Checkmarx Authentication";

// all OAuth failures use this prefix
const AUTH_FAILED_PREFIX = "Authentication failed:";

// exact banner shown when an API Key is rejected
const API_KEY_VALIDATION_FAILED = "API Key validation failed. Please check your key.";

const WAIT_MS = {
  short: 1000,
  medium: 3000,
  quickFrame: 2000,
  webviewFrame: 10000,
  refreshFrame: 5000,
  pollInterval: 200,
  // The error banner appears after the connect-progress notification resolves.
  validation: 20000,
};

describe("Checkmarx OAuth invalid authentication (TC04)", () => {
  let bench: Workbench;
  let driver: WebDriver;

  // Opens the auth panel command, then focuses its editor tab (needs a settle delay).
  async function openAuthenticationEditor(): Promise<void> {
    await bench.executeCommand(CX_AUTHENTICATION_COMMAND);
    await sleep(WAIT_MS.medium);
    await new EditorView().openEditor(AUTH_EDITOR_TITLE);
  }

  // Opens the auth editor and switches Selenium into its webview frame.
  async function openAuthenticationWebView(): Promise<WebView> {
    await openAuthenticationEditor();
    const webView = new WebView();
    await webView.switchToFrame(WAIT_MS.webviewFrame);
    return webView;
  }

  // frame may already be detached on teardown
  async function safeSwitchBack(webView: WebView): Promise<void> {
    try {
      await webView.switchBack();
    } catch {
      // Ignore: the frame can be detached during teardown.
    }
  }

  async function isElementVisibleById(webView: WebView, id: string): Promise<boolean> {
    const elements = await webView.findWebElements(By.id(id));
    return elements.length > 0 && (await elements[0].isDisplayed());
  }

  // poll instead of fixed sleep to handle slow CI
  async function waitForVisibleElementById(webView: WebView, id: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await isElementVisibleById(webView, id)) {
        return;
      }
      await sleep(WAIT_MS.pollInterval);
    }
    throw new Error(`Timed out waiting for visible element: ${id}`);
  }

  // error banner appears async - poll for the expected text
  async function waitForMessageText(webView: WebView, expectedText: string, timeoutMs: number): Promise<string> {
    const startTime = Date.now();
    let lastText = "";
    while (Date.now() - startTime < timeoutMs) {
      if (await isElementVisibleById(webView, "messageBox")) {
        const messageTextElements = await webView.findWebElements(By.id("messageText"));
        if (messageTextElements.length > 0) {
          lastText = await messageTextElements[0].getText();
          if (lastText.includes(expectedText)) {
            return lastText;
          }
        }
      }
      await sleep(WAIT_MS.pollInterval);
    }
    throw new Error(`Timed out waiting for message text "${expectedText}". Last seen: "${lastText}"`);
  }

  // OAuth fields only show when logged out - must log out first
  async function ensureLoggedOut(webView: WebView): Promise<void> {
    const logoutButtons = await webView.findWebElements(By.id("logoutButton"));
    const isLoggedIn = logoutButtons.length > 0 && (await logoutButtons[0].isDisplayed());

    if (isLoggedIn) {
      await logoutButtons[0].click();
      await safeSwitchBack(webView);
      await sleep(WAIT_MS.medium);
      await confirmLogoutToast(driver, "Are you sure you want to log out?", WAIT_MS.quickFrame);
      await webView.switchToFrame(WAIT_MS.refreshFrame);
    }

    await waitForVisibleElementById(webView, "loginForm", WAIT_MS.webviewFrame);
  }

  // Forces the auth UI into OAuth mode (the page toggles forms via DOM state).
  async function activateOAuthForm(): Promise<void> {
    await driver.executeScript(`
      const oauthForm = document.getElementById('oauthForm');
      const apiKeyForm = document.getElementById('apiKeyForm');
      if (oauthForm) oauthForm.classList.remove('hidden');
      if (apiKeyForm) apiKeyForm.classList.add('hidden');
      const authMethodInput = document.getElementById('authMethodInput');
      if (authMethodInput) authMethodInput.value = 'oauth';
    `);
  }

  // Forces the auth UI into API Key mode (mirror of activateOAuthForm).
  async function activateApiKeyForm(): Promise<void> {
    await driver.executeScript(`
      const oauthForm = document.getElementById('oauthForm');
      const apiKeyForm = document.getElementById('apiKeyForm');
      if (apiKeyForm) apiKeyForm.classList.remove('hidden');
      if (oauthForm) oauthForm.classList.add('hidden');
      const authMethodInput = document.getElementById('authMethodInput');
      if (authMethodInput) authMethodInput.value = 'apiKey';
    `);
  }

  // sets the API Key field and returns the auth button's disabled attribute (null = enabled)
  async function setApiKeyAndReadButtonState(webView: WebView, apiKey: string): Promise<string | null> {
    await driver.executeScript(
      `const input = document.getElementById('apiKey');
       if (input) {
         input.value = arguments[0];
         input.dispatchEvent(new Event('input', { bubbles: true }));
       }`,
      apiKey
    );
    const authButton = await webView.findWebElement(By.id("authButton"));
    return await authButton.getAttribute("disabled");
  }

  // force-enables the button (inline validation would block malformed URLs) then clicks Sign in
  async function submitOAuthCredentials(webView: WebView, baseUri: string, tenant: string): Promise<void> {
    await driver.executeScript(
      `const url = document.getElementById('baseUri');
       if (url) { url.value = arguments[0]; }
       const tenant = document.getElementById('tenant');
       if (tenant) { tenant.value = arguments[1]; }
       const authButton = document.getElementById('authButton');
       if (authButton) { authButton.disabled = false; }`,
      baseUri,
      tenant
    );
    const authButton = await webView.findWebElement(By.id("authButton"));
    await authButton.click();
  }

  // Runs `action` inside the auth webview with the form ready and guaranteed cleanup.
  async function withOAuthLoginForm(action: (webView: WebView) => Promise<void>): Promise<void> {
    const webView = await openAuthenticationWebView();
    try {
      await ensureLoggedOut(webView);
      await activateOAuthForm();
      await action(webView);
    } finally {
      await safeSwitchBack(webView);
    }
  }

  // API Key form version of withOAuthLoginForm
  async function withApiKeyLoginForm(action: (webView: WebView) => Promise<void>): Promise<void> {
    const webView = await openAuthenticationWebView();
    try {
      await ensureLoggedOut(webView);
      await activateApiKeyForm();
      await action(webView);
    } finally {
      await safeSwitchBack(webView);
    }
  }

  // mock CLI always succeeds, so we fire the validation-error event directly to test the banner
  async function simulateExtensionValidationError(messageText: string): Promise<void> {
    await driver.executeScript(
      `window.dispatchEvent(new MessageEvent('message', {
         data: { type: 'validation-error', message: arguments[0] }
       }));`,
      messageText
    );
  }

  // confirms the banner has the error class and the expected text
  async function expectErrorBanner(webView: WebView, expectedFragment: string): Promise<void> {
    const messageText = await waitForMessageText(webView, expectedFragment, WAIT_MS.validation);
    expect(messageText).to.include(
      expectedFragment,
      "Invalid OAuth credentials should surface the matching failure message"
    );

    const messageBox = await webView.findWebElement(By.id("messageBox"));
    const messageBoxClass = await messageBox.getAttribute("class");
    expect(messageBoxClass).to.include(
      "error-message",
      "Message box should be styled as an error for invalid OAuth credentials"
    );
  }

  before(async function () {
    this.timeout(15000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
  });

  // restore mock login and close editors
  after(async function () {
    this.timeout(30000);
    await safeSwitchBack(new WebView());
    await loginWithMockToken(bench, { waitMs: WAIT_MS.short });
    await new EditorView().closeAllEditors();
  });

  // malformed URL - no protocol/host - fails before any network request
  it(
    "should reject a malformed Base URL with a connection error",
    retryTest(async function () {
      this.timeout(60000);

      await withOAuthLoginForm(async (webView) => {
        await submitOAuthCredentials(webView, "invalid-base-url", "some-tenant");
        await expectErrorBanner(webView, `${AUTH_FAILED_PREFIX} Could not connect to server`);
      });
    }, 3)
  );

  // ftp:// scheme rejected before any network call
  it(
    "should reject a Base URL with an unsupported protocol",
    retryTest(async function () {
      this.timeout(60000);

      await withOAuthLoginForm(async (webView) => {
        await submitOAuthCredentials(webView, "ftp://example.com", "some-tenant");
        await expectErrorBanner(webView, `${AUTH_FAILED_PREFIX} Invalid URL protocol`);
      });
    }, 3)
  );

  // unreachable host (.invalid TLD never resolves) - assert generic failure banner
  it(
    "should fail authentication for an unreachable Base URL and Tenant",
    retryTest(async function () {
      this.timeout(60000);

      await withOAuthLoginForm(async (webView) => {
        await submitOAuthCredentials(
          webView,
          "https://nonexistent-checkmarx-host.invalid",
          "nonexistent-tenant"
        );
        await expectErrorBanner(webView, AUTH_FAILED_PREFIX);
      });
    }, 3)
  );

  // non-empty key un-disables the button, then we fire the rejection event and check the banner
  it(
    "should reject an invalid API Key with an authentication error banner",
    retryTest(async function () {
      this.timeout(60000);

      await withApiKeyLoginForm(async (webView) => {
        // non-empty key enables the button (null = enabled)
        const disabledAttr = await setApiKeyAndReadButtonState(webView, "invalid-api-key");
        expect(disabledAttr).to.be.null;

        await simulateExtensionValidationError(API_KEY_VALIDATION_FAILED);
        await expectErrorBanner(webView, API_KEY_VALIDATION_FAILED);
      });
    }, 3)
  );
});
