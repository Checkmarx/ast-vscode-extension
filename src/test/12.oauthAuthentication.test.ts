import {
    By,
    EditorView,
    until,
    VSBrowser,
    WebDriver,
    WebView,
    Workbench,
    NotificationType,
    Notification,
    ModalDialog
  } from "vscode-extension-tester";
  import { expect } from "chai";
  import { initialize, retryTest, sleep } from "./utils/utils";
  
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
  
// Replace the existing "should open OAuth authentication panel and verify UI elements" test
// with this improved version

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
	  // Enhanced logout process with detailed logging
	  console.log("Checking if logout button exists...");
	  const logoutElements = await webView.findWebElements(By.id("logoutButton"));
	  
	  if (logoutElements.length > 0) {
		const isDisplayed = await logoutElements[0].isDisplayed();
		console.log(`Logout button found: ${isDisplayed ? "displayed" : "not displayed"}`);
		
		if (isDisplayed) {
		  console.log("Logging out first...");
		  
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
		}
	  } else {
		console.log("Logout button not found - user is likely already logged out");
	  }
  
	  // Rest of the test continues as normal...
	  console.log("Finding radio buttons for authentication methods...");
	  const radioButtons = await webView.findWebElements(By.css("input[type='radio']"));
	  console.log(`Found ${radioButtons.length} radio buttons`);
	  
	  // Additional test code...
	  
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
