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

describe("Checkmarx OAuth Authentication Tests", () => {
    let bench: Workbench;
    let driver: WebDriver;

    before(async function () {
        this.timeout(15000);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;
    });

    after(async () => {
        // Inject a mock token into secrets before running tests using the new command
        await bench.executeCommand("ast-results.mockTokenTest");
        // Short delay to allow the extension state to update
        await new Promise((res) => setTimeout(res, 3000));
        await new EditorView().closeAllEditors();
    });

    it("should open OAuth authentication panel and verify UI elements", retryTest(async function () {
        console.log("========== Starting OAuth authentication test ==========");

        // Execute the authentication command
        await bench.executeCommand(CX_AUTHENTICATION_COMMAND);
        console.log("Authentication command executed");
        await sleep(5000);

        const editorView = new EditorView();
        await editorView.openEditor("Checkmarx One Authentication");
        console.log("Authentication editor opened");

        // Switch to the WebView frame
        const webView = new WebView();
        await webView.switchToFrame(10000);
        console.log("Switched to WebView iframe");

        try {
            // Check if user is logged in
            console.log("Checking if logout button exists...");
            let logoutElements = await webView.findWebElements(By.id("logoutButton"));
            const isLoggedIn = logoutElements.length > 0 && await logoutElements[0].isDisplayed();

            // If not logged in, inject a mock token to create a logged-in state
            if (!isLoggedIn) {
                console.log("User is not logged in - injecting mock token and reopening panel");
                await webView.switchBack();
                await bench.executeCommand("ast-results.mockTokenTest");
                await sleep(3000);
                await new EditorView().closeAllEditors();
                await bench.executeCommand(CX_AUTHENTICATION_COMMAND);
                await sleep(3000);
                await new EditorView().openEditor("Checkmarx One Authentication");
                await webView.switchToFrame(5000);
                logoutElements = await webView.findWebElements(By.id("logoutButton"));
                
                // Verify that we now have a logout button
                const isLoggedInNow = logoutElements.length > 0 && await logoutElements[0].isDisplayed();
                console.log(`User logged in after token injection: ${isLoggedInNow}`);
                if (!isLoggedInNow) {
                    console.log("Warning: Failed to log in user with mock token");
                }
            } else {
                console.log("User is already logged in");
            }

            // Now proceed with logout (should work whether we were already logged in or just injected a token)
            console.log("Proceeding with logout test...");
            logoutElements = await webView.findWebElements(By.id("logoutButton"));
            if (logoutElements.length > 0 && await logoutElements[0].isDisplayed()) {
                console.log("Logging out user...");
                
                // Switch back to main frame before clicking logout
                await webView.switchBack();
                
                // Switch back to WebView frame to click the logout button
                await webView.switchToFrame(5000);
                
                await logoutElements[0].click();
                console.log("Clicked logout button");
                
                // Switch back to main frame to handle the dialog
                await webView.switchBack();
                await sleep(3000); // Longer wait time
                
                // Try all possible confirmation methods and log detailed information
                await handleLogoutConfirmation(driver);
                
                // Switch back to WebView
                await webView.switchToFrame(5000);
            } else {
                console.log("Error: Logout button not found even after token injection");
            }

            // Verify we're now logged out by checking the state of the form
            console.log("Verifying logged out state...");
            const loginForm = await webView.findWebElements(By.id("loginForm"));
            expect(loginForm.length).to.be.greaterThan(0, "Login form should be visible when logged out");
            
            // Verify radio buttons
            console.log("Finding radio buttons for authentication methods...");
            const radioButtons = await webView.findWebElements(By.css("input[type='radio']"));
            console.log(`Found ${radioButtons.length} radio buttons`);
            expect(radioButtons.length).to.be.at.least(2, "Should have at least 2 radio buttons (OAuth and API Key)");

            // First, verify OAuth form fields
            console.log("Selecting OAuth radio button...");
            const oauthRadio = await webView.findWebElement(By.css("input[name='authMethod'][value='oauth']"));
            await driver.executeScript("arguments[0].click();", oauthRadio);
            await sleep(1000);
            
            console.log("Verifying OAuth form fields...");
            const oauthForm = await webView.findWebElement(By.id("oauthForm"));
            expect(oauthForm).to.not.be.undefined;
            
            const oauthFormText = await oauthForm.getText();
            console.log(`OAuth form text: ${oauthFormText}`);
            
            expect(oauthFormText).to.include("Checkmarx One Base URL:", "Base URL label should be present in OAuth form");
            expect(oauthFormText).to.include("Tenant Name:", "Tenant Name label should be present in OAuth form");
            
            // Verify OAuth form input fields
            const baseUriInput = await oauthForm.findElement(By.id("baseUri"));
            expect(baseUriInput).to.not.be.undefined;
            
            const tenantInput = await oauthForm.findElement(By.id("tenant"));
            expect(tenantInput).to.not.be.undefined;
            
            // Verify button state for OAuth (should be disabled when empty)
            const authButton = await webView.findWebElement(By.id("authButton"));
            let disabledAttr = await authButton.getAttribute("disabled");
            expect(disabledAttr).to.equal("true", "Auth button should be disabled when OAuth fields are empty");
            
            // Now, verify API Key form fields
            console.log("Selecting API Key radio button...");
            const apiKeyRadio = await webView.findWebElement(By.css("input[name='authMethod'][value='apiKey']"));
            await driver.executeScript("arguments[0].click();", apiKeyRadio);
            await sleep(1000);
            
            console.log("Verifying API Key form fields...");
            const apiKeyForm = await webView.findWebElement(By.id("apiKeyForm"));
            expect(apiKeyForm).to.not.be.undefined;
            
            const apiKeyFormText = await apiKeyForm.getText();
            console.log(`API Key form text: ${apiKeyFormText}`);
            
            expect(apiKeyFormText).to.include("Checkmarx One API Key:", "API Key label should be present in API Key form");
            
            // Verify API Key input field
            const apiKeyInput = await apiKeyForm.findElement(By.id("apiKey"));
            expect(apiKeyInput).to.not.be.undefined;
            
            // Verify button state for API Key (should be disabled when empty)
            disabledAttr = await authButton.getAttribute("disabled");
            expect(disabledAttr).to.equal("true", "Auth button should be disabled when API Key field is empty");
            
            console.log("OAuth UI verification completed successfully");
        } finally {
            try {
                await webView.switchBack();
            } catch (switchError) {
                console.log("Error switching back:", switchError);
            }

            try {
                await new EditorView().closeAllEditors();
            } catch (closeError) {
                console.log("Error closing editors:", closeError);
            }
        }
    }, 3));

    // Optimized function for handling logout confirmation
    async function handleLogoutConfirmation(driver) {
        try {
            // Search directly for notifications - this is the approach that works
            const notifications = await driver.findElements(By.className("notification-toast"));
            console.log(`Found ${notifications.length} notifications`);

            for (const notification of notifications) {
                // Check if this is the logout confirmation notification
                const notificationText = await notification.getText();

                if (notificationText.includes("Are you sure you want to log out?")) {
                    console.log("Found logout confirmation notification");

                    // Find the Yes button within this notification
                    const yesButton = await notification.findElement(By.css(".monaco-button"));
                    const buttonText = await yesButton.getText();

                    if (buttonText === "Yes") {
                        console.log("Clicking 'Yes' button in logout confirmation");
                        await yesButton.click();
                        await sleep(2000);
                        return true;
                    }
                }
            }

            console.log("Could not find logout confirmation notification");
        } catch (error) {
            console.log("Error handling logout confirmation:", error);
        }

        return false;
    }
});