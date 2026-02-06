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

describe.skip("Checkmarx OAuth Authentication Tests", () => {
    let bench: Workbench;
    let driver: WebDriver;

    before(async function () {
        this.timeout(15000);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;
    });

    after(async () => {
        await bench.executeCommand("ast-results.mockTokenTest");
        await sleep(3000);
        await new EditorView().closeAllEditors();
    });

    it("should open OAuth authentication panel and verify logout/login flow", retryTest(async function () {
        await bench.executeCommand(CX_AUTHENTICATION_COMMAND);
        await sleep(5000);

        const editorView = new EditorView();
        await editorView.openEditor("Checkmarx One Authentication");

        const webView = new WebView();
        await webView.switchToFrame(10000);

        let logoutElements = await webView.findWebElements(By.id("logoutButton"));
        const isLoggedIn = logoutElements.length > 0 && await logoutElements[0].isDisplayed();

        if (!isLoggedIn) {
            await webView.switchBack();
            await bench.executeCommand("ast-results.mockTokenTest");
            await sleep(3000);
            await new EditorView().closeAllEditors();
            await bench.executeCommand(CX_AUTHENTICATION_COMMAND);
            await sleep(3000);
            await new EditorView().openEditor("Checkmarx One Authentication");
            await webView.switchToFrame(5000);
            logoutElements = await webView.findWebElements(By.id("logoutButton"));
        }

        logoutElements = await webView.findWebElements(By.id("logoutButton"));
        if (logoutElements.length > 0 && await logoutElements[0].isDisplayed()) {
            await webView.switchBack();
            await webView.switchToFrame(5000);
            await logoutElements[0].click();
            await webView.switchBack();
            await sleep(3000);
            await handleLogoutConfirmation(driver);
            await webView.switchToFrame(5000);
        }

        const loginForm = await webView.findWebElements(By.id("loginForm"));
        expect(loginForm.length).to.be.greaterThan(0, "Login form should be visible when logged out");
    }, 3));

    it("should verify radio buttons exist", retryTest(async function () {
        const webView = new WebView();
        await webView.switchToFrame(10000);

        const radioButtons = await webView.findWebElements(By.css("input[type='radio']"));
        expect(radioButtons.length).to.be.at.least(2, "Should have at least 2 radio buttons (OAuth and API Key)");

        await webView.switchBack();
    }, 3));

    it("should verify OAuth form exists", retryTest(async function () {
        const webView = new WebView();
        await webView.switchToFrame(10000);

        const oauthRadio = await webView.findWebElement(By.css("input[name='authMethod'][value='oauth']"));
        await driver.executeScript("arguments[0].click();", oauthRadio);
        await sleep(1000);

        const oauthForm = await webView.findWebElement(By.id("oauthForm"));
        expect(oauthForm).to.not.be.undefined;

        await webView.switchBack();
    }, 3));

    it("should verify OAuth form text labels", retryTest(async function () {
        const webView = new WebView();
        await webView.switchToFrame(10000);

        const oauthForm = await webView.findWebElement(By.id("oauthForm"));
        const oauthFormText = await oauthForm.getText();

        expect(oauthFormText).to.include("Checkmarx One Base URL:", "Base URL label should be present in OAuth form");
        expect(oauthFormText).to.include("Tenant Name:", "Tenant Name label should be present in OAuth form");

        await webView.switchBack();
    }, 3));

    it("should verify OAuth button disabled state", retryTest(async function () {
        const webView = new WebView();
        await webView.switchToFrame(10000);

        const authButton = await webView.findWebElement(By.id("authButton"));
        const disabledAttr = await authButton.getAttribute("disabled");
        expect(disabledAttr).to.equal("true", "Auth button should be disabled when OAuth fields are empty");

        await webView.switchBack();
    }, 3));

    it("should verify API Key form text labels", retryTest(async function () {
        const webView = new WebView();
        await webView.switchToFrame(10000);

        const apiKeyRadio = await webView.findWebElement(By.css("input[name='authMethod'][value='apiKey']"));
        await driver.executeScript("arguments[0].click();", apiKeyRadio);
        await sleep(1000);

        const apiKeyForm = await webView.findWebElement(By.id("apiKeyForm"));
        const apiKeyFormText = await apiKeyForm.getText();

        expect(apiKeyFormText).to.include("Checkmarx One API Key:", "API Key label should be present in API Key form");

        await webView.switchBack();
    }, 3));

    it("should verify API Key button disabled state", retryTest(async function () {
        const webView = new WebView();
        await webView.switchToFrame(10000);

        const authButton = await webView.findWebElement(By.id("authButton"));
        const disabledAttr = await authButton.getAttribute("disabled");
        expect(disabledAttr).to.equal("true", "Auth button should be disabled when API Key field is empty");

        await webView.switchBack();
    }, 3));

    async function handleLogoutConfirmation(driver) {
        const notifications = await driver.findElements(By.className("notification-toast"));
        for (const notification of notifications) {
            const notificationText = await notification.getText();
            if (notificationText.includes("Are you sure you want to log out?")) {
                const yesButton = await notification.findElement(By.css(".monaco-button"));
                await yesButton.click();
                await sleep(2000);
                return true;
            }
        }
        return false;
    }
});
