import dotenv from "dotenv";
import {
  EditorView,
  Workbench,
  VSBrowser,
  WebDriver,
  By,
  WebView,
  InputBox,
  TextEditor,
  BottomBarPanel,
  MarkerType,
  SettingsEditor
} from "vscode-extension-tester";
import { expect } from "chai";
import { initialize } from "../test/utils/utils";
import {
  CX_CLEAR,
  CX_SELECT_PROJECT,
  CX_SELECT_BRANCH,
  CX_SELECT_SCAN,
  PROJECT_KEY_TREE,
  BRANCH_KEY_TREE,
} from "../test/utils/constants";
import {
  CX_TEST_PROJECT_NAME,
  CX_TEST_BRANCH_NAME,
  CX_TEST_SCAN_NAME,
} from "./utils/constants";
import {
  waitForElementToAppear,
  waitForInputBoxToOpen,
  selectItem,
} from "./utils/utils";

import { constants } from "../utils/common/constants";
import * as path from "path";
import * as fsp from "fs/promises";

// Load environment variables
dotenv.config();
const CX_AUTHENTICATION_COMMAND = "ast-results.showAuth";
const CxApiKey = process.env.CX_APIKEY;
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Checkmarx VS Code Extension Tests", () => {
  let bench: Workbench;
  let driver: WebDriver;

  it("Authentication: should authenticate using API key and verify button state", async function() {
    this.timeout(120000);
    console.log("Starting API key authentication test...");
    bench = new Workbench();
    driver = VSBrowser.instance.driver;

    // Execute the authentication command
    await bench.executeCommand(CX_AUTHENTICATION_COMMAND);
    console.log("Authentication command executed");
    await sleep(5000);

    const editorView = new EditorView();
    await editorView.openEditor("Checkmarx One Authentication");
    console.log("Authentication editor opened");

    // Switch to the WebView frame
    const webview = new WebView();
    await webview.switchToFrame(10000);
    console.log("Switched to WebView iframe");

    try {
      // Find and select the API key radio button option
      const radioButtons = await webview.findWebElements(By.css("input[type='radio']"));
      console.log(`Found ${radioButtons.length} radio buttons`);
      
      if (radioButtons.length >= 2) {
        const apiKeyRadio = radioButtons[1];
        await apiKeyRadio.click();
        console.log("Selected API key option");
        await sleep(3000);

        // Verify that the auth button is disabled before entering the API key
        const authButton = await webview.findWebElement(By.id("authButton"));
        let disabledAttr = await authButton.getAttribute("disabled");
        expect(disabledAttr).to.equal("true", "Auth button should be disabled before API key entry");

        // Enter the API key
        const apiKeyInput = await webview.findWebElement(By.id("apiKey"));
        await apiKeyInput.sendKeys(CxApiKey);
        console.log("Entered API key");
        await sleep(3000);

        // Wait until the auth button becomes enabled
        await driver.wait(async () => {
          const state = await authButton.getAttribute("disabled");
          return state !== "true";
        }, 5000, "Auth button did not become enabled");
        
        // Verify that the auth button is now enabled
        disabledAttr = await authButton.getAttribute("disabled");
        expect(disabledAttr).to.not.equal("true", "Auth button should be enabled after API key entry");
        
        // Click the auth button
        await authButton.click();
        console.log("Clicked 'Sign in' button");
        await sleep(10000); // Wait for the authentication process to complete

        console.log("Authentication completed successfully");
      } else {
        throw new Error(`Not enough radio buttons found. Found: ${radioButtons.length}`);
      }
    } catch (error) {
      console.error("Error during authentication test:", error);
      throw error;
    } finally {
      try {
        await webview.switchBack();
        console.log("Switched back to main VS Code context");
        // Close all open editors
        await new EditorView().closeAllEditors();
      } catch (e) {
        console.error("Error during cleanup:", e);
      }
    }
  });

  describe("Welcome view test", () => {
    before(async function () {
      this.timeout(60000);
      bench = new Workbench();
      await initialize();
    });

    after(async () => {
      await new EditorView().closeAllEditors();
    });

    it("should open welcome view and verify its existence", async function () {
      this.timeout(30000);
      console.log("Welcome view test executed");
    });
  });

  describe("Project, Branch, and Scan Selection Test", () => {
    before(async function () {
      this.timeout(60000);
      bench = new Workbench();
      await bench.executeCommand(CX_CLEAR);
    });

    it("should select project, branch, and scan", async function () {
      this.timeout(150000);
      await bench.executeCommand(CX_SELECT_PROJECT);
      const projectInput = await waitForInputBoxToOpen();
      const projectName = await selectItem(projectInput, CX_TEST_PROJECT_NAME);

      await bench.executeCommand(CX_SELECT_BRANCH);
      const branchInput = await waitForInputBoxToOpen();
      const branchName = await selectItem(branchInput, CX_TEST_BRANCH_NAME);

      await bench.executeCommand(CX_SELECT_SCAN);
      const scanInput = await waitForInputBoxToOpen();
      await selectItem(scanInput, CX_TEST_SCAN_NAME);

      const treeScans = await initialize();
      const project = await waitForElementToAppear(treeScans, PROJECT_KEY_TREE + projectName);
      expect(project).is.not.undefined;

      const branch = await waitForElementToAppear(treeScans, BRANCH_KEY_TREE + branchName);
      expect(branch).is.not.undefined;
    });
  });

  describe("OSS Scanner E2E Integration", () => {
    before(async function () {
      this.timeout(60000);
      // Enable OSS realtime scanner in settings
      console.log("Enabling OSS scanner for E2E tests...");
      const settingsEditor = await bench.openSettings();
      const ossCheckbox = await settingsEditor.findSetting(
        constants.activateOssRealtimeScanner,
        constants.ossRealtimeScanner
      );
      await ossCheckbox.setValue(true);
      console.log("OSS scanner enabled");
      
      // Close settings
      await new EditorView().closeAllEditors();
    });

    it("should scan package.json and detect security issues", async function () {
      this.timeout(120000);
      console.log("Starting OSS scanner E2E test...");

      const packageJsonPath = path.join(__dirname, "menifastFiles", "package.json");
      console.log(`Package.json path: ${packageJsonPath}`);
      
      await bench.executeCommand("workbench.action.files.openFile");
      const input = await InputBox.create();
      await input.setText(packageJsonPath);
      await input.confirm();

      await sleep(5000);

      const editorView = new EditorView();
      const editor = await editorView.openEditor("package.json") as TextEditor;
      expect(editor).to.not.be.undefined;
      console.log("Editor opened successfully");

      const bottomBar = new BottomBarPanel();
      await bottomBar.toggle(true);
      const problemsView = await bottomBar.openProblemsView();
      console.log("Problems view opened");

      await sleep(5000);

      const markers = await problemsView.getAllMarkers(MarkerType.Error);
      console.log(`Found ${markers.length} security markers`);
      
      const allMarkerTexts = await Promise.all(markers.map(async (marker) => {
        return await marker.getText();
      }));
      console.log("Security markers:", allMarkerTexts);

      expect(markers.length).to.be.greaterThan(0, "Expected OSS scanner to find security issues");
      
      console.log("OSS scanner E2E test completed successfully");
    });
  });
  
});
