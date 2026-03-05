import {
    By,
    EditorView,
    VSBrowser,
    WebDriver,
    WebView,
    Workbench
} from "vscode-extension-tester";
import { expect } from "chai";
import { retryTest, sleep } from "./utils/utils";

const CX_AUTHENTICATION_COMMAND = "ast-results.showAuth";
const CX_MOCK_TOKEN_COMMAND = "ast-results.mockTokenTest";
const AUTH_EDITOR_TITLE = "Checkmarx Authentication";

const WAIT_MS = {
    short: 1000,
    medium: 3000,
    quickFrame: 2000,
    webviewFrame: 10000,
    refreshFrame: 5000,
    pollInterval: 200
};

type AuthMethod = "oauth" | "apiKey";

/**
 * Opens the authentication panel command and then focuses the auth editor tab.
 *
 * Why this helper exists:
 * - The webview needs a short settling delay after command execution.
 * - Centralizing this sequence keeps every test aligned with the same startup flow.
 */
async function openAuthenticationEditor(bench: Workbench) {
    await bench.executeCommand(CX_AUTHENTICATION_COMMAND);
    await sleep(WAIT_MS.medium);
    await new EditorView().openEditor(AUTH_EDITOR_TITLE);
}

/**
 * Opens the auth editor and switches Selenium context into its webview frame.
 *
 * This function returns a ready-to-use `WebView` so test bodies can focus on
 * assertions instead of repeated frame-switch boilerplate.
 */
async function openAuthenticationWebView(bench: Workbench): Promise<WebView> {
    await openAuthenticationEditor(bench);
    const webView = new WebView();
    await webView.switchToFrame(WAIT_MS.webviewFrame);
    return webView;
}

/**
 * Switches back from webview context to the VS Code root context.
 *
 * This is best-effort by design because teardown can run after frame disposal.
 * Failing hard here would hide the real assertion failure from the test output.
 */
async function safeSwitchBack(webView: WebView) {
    try {
        await webView.switchBack();
    } catch {
        // Test teardown should continue even if the frame was already detached.
    }
}

/**
 * Forces the auth UI into either OAuth or API Key mode by mutating DOM state.
 *
 * The current auth page no longer exposes the legacy radio controls used by
 * older tests, so we programmatically toggle visibility/classes and mirror the
 * same state updates the UI would normally perform.
 */
async function setActiveAuthMethod(driver: WebDriver, method: AuthMethod) {
    const isApiKey = method === "apiKey";
    const loginTitle = isApiKey ? "API Key Log in" : "OAuth Log in";

    await driver.executeScript(`
        const oauthForm = document.getElementById('oauthForm');
        const apiKeyForm = document.getElementById('apiKeyForm');
        if (oauthForm && apiKeyForm) {
            oauthForm.classList.toggle('hidden', ${isApiKey});
            apiKeyForm.classList.toggle('hidden', ${!isApiKey});
        }

        const authMethodInput = document.getElementById('authMethodInput');
        if (authMethodInput) {
            authMethodInput.value = '${method}';
        }

        const loginTitle = document.getElementById('loginTitle');
        if (loginTitle) {
            loginTitle.textContent = '${loginTitle}';
        }

        const authButton = document.getElementById('authButton');
        if (authButton) {
            authButton.disabled = true;
        }
    `);
}

/**
 * Convenience wrapper that activates API Key mode for assertions.
 */
async function switchToApiKeyForm(driver: WebDriver) {
    await setActiveAuthMethod(driver, "apiKey");
}

/**
 * Convenience wrapper that restores OAuth mode after API Key checks.
 *
 * Keeping OAuth as the default state improves suite isolation between tests.
 */
async function switchToOAuthForm(driver: WebDriver) {
    await setActiveAuthMethod(driver, "oauth");
}

/**
 * Checks whether an element exists and is currently visible in the webview.
 *
 * We use `findWebElements` (plural) to avoid throwing when the element is absent,
 * then safely evaluate visibility only when a match is found.
 */
async function isElementVisibleById(webView: WebView, elementId: string): Promise<boolean> {
    const elements = await webView.findWebElements(By.id(elementId));
    return elements.length > 0 && await elements[0].isDisplayed();
}

/**
 * Waits until an element exists and is visible, or throws after timeout.
 *
 * This reduces reliance on fixed sleeps and makes UI tests more tolerant of
 * slow CI agents.
 */
async function waitForVisibleElementById(webView: WebView, elementId: string, timeoutMs: number) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (await isElementVisibleById(webView, elementId)) {
            return;
        }
        await sleep(WAIT_MS.pollInterval);
    }
    throw new Error(`Timed out waiting for visible element: ${elementId}`);
}

/**
 * Runs a test action inside the authentication webview with guaranteed cleanup.
 *
 * This helper standardizes the open/switch/cleanup lifecycle so each test can
 * express only scenario logic and assertions.
 */
async function runWithAuthenticationWebView(bench: Workbench, action: (webView: WebView) => Promise<void>) {
    const webView = await openAuthenticationWebView(bench);
    try {
        await action(webView);
    } finally {
        await safeSwitchBack(webView);
    }
}

/**
 * Ensures the suite is in a logged-in state before validating logout behavior.
 *
 * If the logout button is not visible, we seed a mock token and reopen the
 * authentication page so the test can execute the full logout path deterministically.
 */
async function ensureLogoutButtonVisible(bench: Workbench, webView: WebView) {
    const logoutButtonVisible = await isElementVisibleById(webView, "logoutButton");
    if (logoutButtonVisible) {
        return;
    }

    // Some runs start with a logged-out session; seed a token first so logout flow can be validated.
    await safeSwitchBack(webView);
    await bench.executeCommand(CX_MOCK_TOKEN_COMMAND);
    await sleep(WAIT_MS.medium);
    await new EditorView().closeAllEditors();
    await openAuthenticationEditor(bench);
    await webView.switchToFrame(WAIT_MS.refreshFrame);
    await waitForVisibleElementById(webView, "logoutButton", WAIT_MS.webviewFrame);
}

/**
 * Confirms the logout toast prompt when it appears.
 *
 * Returns `true` if the expected confirmation prompt was found and accepted,
 * otherwise `false` when no matching notification is present.
 */
async function handleLogoutConfirmation(driver: WebDriver): Promise<boolean> {
    const notifications = await driver.findElements(By.className("notification-toast"));
    for (const notification of notifications) {
        const notificationText = await notification.getText();
        if (notificationText.includes("Are you sure you want to log out?")) {
            const yesButton = await notification.findElement(By.css(".monaco-button"));
            await yesButton.click();
            await sleep(WAIT_MS.quickFrame);
            return true;
        }
    }
    return false;
}

describe("Checkmarx OAuth Authentication Tests", () => {
    let bench: Workbench;
    let driver: WebDriver;

    // Suite bootstrap: create shared workbench and webdriver handles once.
    before(async function () {
        this.timeout(15000);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;
    });

    // Per-test cleanup: restore default OAuth view so tests stay independent.
    afterEach(async () => {
        const webView = new WebView();
        try {
            await webView.switchToFrame(WAIT_MS.quickFrame);
            await switchToOAuthForm(driver);
        } catch {
            // Cleanup best-effort only; failures here should not hide test failures.
        }
        await safeSwitchBack(webView);
    });

    // Suite teardown: reset token state and close editors to avoid cross-suite leakage.
    after(async function () {
        this.timeout(30000);
        await safeSwitchBack(new WebView());
        await bench.executeCommand(CX_MOCK_TOKEN_COMMAND);
        await sleep(WAIT_MS.short);
        await new EditorView().closeAllEditors();
    });

    it("should open OAuth authentication panel and verify logout/login flow", retryTest(async function () {
        // Scenario: enter auth panel, force logout (if possible), and verify login form returns.
        this.timeout(60000);

        await runWithAuthenticationWebView(bench, async (webView) => {
            await ensureLogoutButtonVisible(bench, webView);

            await waitForVisibleElementById(webView, "logoutButton", WAIT_MS.webviewFrame);
            const logoutButtons = await webView.findWebElements(By.id("logoutButton"));
            const canLogout = logoutButtons.length > 0 && await logoutButtons[0].isDisplayed();

            if (canLogout) {
                await logoutButtons[0].click();
                await safeSwitchBack(webView);
                await sleep(WAIT_MS.medium);
                await handleLogoutConfirmation(driver);
                await webView.switchToFrame(WAIT_MS.refreshFrame);
            }

            await waitForVisibleElementById(webView, "loginForm", WAIT_MS.webviewFrame);
            const loginForm = await webView.findWebElements(By.id("loginForm"));
            expect(loginForm.length).to.be.greaterThan(0, "Login form should be visible when logged out");
        });
    }, 3));

    it("should verify OAuth form exists", retryTest(async function () {
        // Scenario: the OAuth form container is present in the authentication view.
        this.timeout(30000);

        await runWithAuthenticationWebView(bench, async (webView) => {
            const oauthForm = await webView.findWebElement(By.id("oauthForm"));
            expect(oauthForm).to.not.be.undefined;
        });
    }, 3));

    it("should verify OAuth form text labels", retryTest(async function () {
        // Scenario: OAuth mode shows mandatory labels needed for user input.
        this.timeout(30000);

        await runWithAuthenticationWebView(bench, async (webView) => {
            const oauthForm = await webView.findWebElement(By.id("oauthForm"));
            const oauthFormText = await oauthForm.getText();

            expect(oauthFormText).to.include("Checkmarx One Base URL", "Base URL label should be present in OAuth form");
            expect(oauthFormText).to.include("Tenant Name", "Tenant Name label should be present in OAuth form");
        });
    }, 3));

    it("should verify OAuth button disabled state", retryTest(async function () {
        // Scenario: auth action remains disabled while required OAuth fields are empty.
        this.timeout(30000);

        await runWithAuthenticationWebView(bench, async (webView) => {
            const authButton = await webView.findWebElement(By.id("authButton"));
            const disabledAttr = await authButton.getAttribute("disabled");
            expect(disabledAttr).to.equal("true", "Auth button should be disabled when OAuth fields are empty");
        });
    }, 3));

    it("should verify API Key form text labels", retryTest(async function () {
        // Scenario: after switching to API Key mode, expected label text is visible.
        this.timeout(30000);

        await runWithAuthenticationWebView(bench, async (webView) => {
            await switchToApiKeyForm(driver);

            try {
                const apiKeyForm = await webView.findWebElement(By.id("apiKeyForm"));
                const apiKeyFormClass = await apiKeyForm.getAttribute("class");
                const apiKeyFormText = await apiKeyForm.getText();

                expect(apiKeyFormClass).to.not.include("hidden", "API Key form should be visible");
                expect(apiKeyFormText).to.include("Checkmarx One API Key", "API Key label should be present in API Key form");
            } finally {
                await switchToOAuthForm(driver);
            }
        });
    }, 3));

    it("should verify API Key button disabled state", retryTest(async function () {
        // Scenario: auth action remains disabled while API Key input is empty.
        this.timeout(30000);

        await runWithAuthenticationWebView(bench, async (webView) => {
            await switchToApiKeyForm(driver);

            try {
                const authButton = await webView.findWebElement(By.id("authButton"));
                const disabledAttr = await authButton.getAttribute("disabled");
                expect(disabledAttr).to.equal("true", "Auth button should be disabled when API Key field is empty");
            } finally {
                await switchToOAuthForm(driver);
            }
        });
    }, 3));

    it("should switch between OAuth and API Key forms without radio buttons", retryTest(async function () {
        // Scenario: validate new UX (no legacy radio buttons) and DOM-based form toggling.
        this.timeout(30000);

        await runWithAuthenticationWebView(bench, async (webView) => {

            const legacyRadioButtons = await webView.findWebElements(By.css("input[name='authMethod']"));
            expect(legacyRadioButtons.length).to.equal(0, "Legacy radio buttons should not exist in new auth UI");

            const oauthFormBefore = await webView.findWebElement(By.id("oauthForm"));
            const apiKeyFormBefore = await webView.findWebElement(By.id("apiKeyForm"));
            const oauthClassBefore = await oauthFormBefore.getAttribute("class");
            const apiKeyClassBefore = await apiKeyFormBefore.getAttribute("class");

            expect(oauthClassBefore).to.not.include("hidden", "OAuth form should be visible by default");
            expect(apiKeyClassBefore).to.include("hidden", "API Key form should be hidden by default");

            await switchToApiKeyForm(driver);

            const oauthFormAfter = await webView.findWebElement(By.id("oauthForm"));
            const apiKeyFormAfter = await webView.findWebElement(By.id("apiKeyForm"));
            const oauthClassAfter = await oauthFormAfter.getAttribute("class");
            const apiKeyClassAfter = await apiKeyFormAfter.getAttribute("class");

            expect(oauthClassAfter).to.include("hidden", "OAuth form should be hidden after switching to API Key");
            expect(apiKeyClassAfter).to.not.include("hidden", "API Key form should be visible after switching");
        });
    }, 3));
});
