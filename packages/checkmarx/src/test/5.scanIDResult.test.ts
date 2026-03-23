import {
  By,
  CustomTreeSection,
  EditorView,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  focusPanelAndCollapseOthers,
  getResults,
  initialize,
  loginWithMockToken,
  logoutIfVisible,
  openDetailsFrame,
  retryTest,
  selectDetailsTab,
  sleep,
} from "./utils/utils";
import {
  CHANGES_CONTAINER,
  CHANGES_LABEL,
  CHANGES_TAB_INPUT,
  CODEBASHING_HEADER,
  COMMENT_BOX,
  CX_CLEAR,
  CX_LOOK_SCAN,
  GENERAL_LABEL,
  GENERAL_TAB_INPUT,
  LEARN_MORE_LABEL,
  LEARN_TAB_INPUT,
  SAST_TYPE,
  SCAN_KEY_TREE_LABEL,
  UPDATE_BUTTON,
  WEBVIEW_TITLE,
} from "./utils/constants";
import { waitByClassName } from "./utils/waiters";
import { SCAN_ID } from "./utils/envs";

const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";

describe("Scan ID load results test", () => {
  let workbench: Workbench;
  let resultsTree: CustomTreeSection;
  let driver: WebDriver;

  // Retries a VS Code command up to `retries` times to absorb transient UI delays.
  async function runCommand(command: string, retries = 3): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await workbench.executeCommand(command);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retries) await sleep(2000);
      }
    }
    throw lastError;
  }

  // Authenticates with a mock token and clears any previous scan state.
  before(async function () {
    this.timeout(100000);
    workbench = new Workbench();
    driver = VSBrowser.instance.driver;
    await initialize();
    await loginWithMockToken(workbench, { executeCommandWithRetry: runCommand, waitMs: 3000 });
    await runCommand(CX_CLEAR);
  });

  // Logs out, clears state, and closes editors to prevent leaking state to later suites.
  after(async function () {
    this.timeout(60000);
    // Exit any webview frame before interacting with VS Code UI.
    try { await driver.switchTo().defaultContent(); } catch { /* ignore */ }
    try {
      await logoutIfVisible(workbench, driver, { executeCommandWithRetry: runCommand });
    } catch {
      // Keep teardown resilient.
    }
    await runCommand(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  // Loads a known scan by ID to populate the results tree for subsequent tests.
  it("should load results from scan ID", retryTest(async function () {
    this.timeout(60000);

    await workbench.executeCommand(CX_LOOK_SCAN);
    const scanIdInput = await InputBox.create();
    await sleep(1000);
    await scanIdInput.setText(SCAN_ID);
    await scanIdInput.confirm();
    await sleep(5000);
  }));

  // Full scenario: clears state, loads scan, opens a SAST vulnerability details page,
  // navigates to the Description tab, and verifies the Codebashing section is present.
  it("should verify codebashing link on Description tab of SAST vulnerability details", retryTest(async function () {
    this.timeout(180000);

    // Reset driver context in case a previous retry left it inside a webview frame.
    await driver.switchTo().defaultContent();

    // Step 1: Clear state and reload scan by ID.
    await runCommand(CX_CLEAR);
    await runCommand(CX_LOOK_SCAN);
    const scanIdInput = await InputBox.create();
    await sleep(1000);
    await scanIdInput.setText(SCAN_ID);
    await scanIdInput.confirm();
    await sleep(5000);

    // Step 2: Focus the results panel and initialise the tree.
    await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);
    resultsTree = await initialize();
    while (resultsTree === undefined) {
      resultsTree = await initialize();
    }

    // Step 3: Expand the scan root and locate the SAST engine node.
    const scanRoot = await resultsTree?.findItem(SCAN_KEY_TREE_LABEL);
    await scanRoot?.expand();
    await sleep(500);

    let sastItem = await scanRoot?.findChildItem(SAST_TYPE);
    if (sastItem === undefined) {
      await sleep(2000);
      sastItem = await scanRoot?.findChildItem(SAST_TYPE);
    }
    expect(sastItem, "SAST node not found").to.not.be.undefined;

    // Step 4: Expand the SAST node and fetch the first vulnerability item.
    await sastItem?.expand();
    await sleep(500);

    let vulnItems = await getResults(sastItem);
    while (!vulnItems || vulnItems.length === 0) {
      await sleep(1000);
      vulnItems = await getResults(sastItem);
    }

    // Step 5: Close open editors so no competing webview interferes with frame search,
    // then click the vulnerability immediately to avoid stale element references.
    await driver.switchTo().defaultContent();
    await new EditorView().closeAllEditors();

    const vulnLabel = await vulnItems[0].getLabel();
    await vulnItems[0].click();
    // Allow the details webview panel time to open and inject its HTML content.
    await sleep(5000);

    // Step 6: Enter the details webview frame.
    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Vulnerability details panel did not open").to.be.true;

    // Verify the panel title matches the clicked vulnerability.
    const panelTitle = await (await driver.findElement(By.id(WEBVIEW_TITLE))).getText();
    expect(panelTitle).to.equal(vulnLabel);

    // Step 7: Navigate to Description tab and verify the Codebashing section.
    await selectDetailsTab(driver,LEARN_TAB_INPUT);
    const codebashingSection = await driver.findElement(By.id(CODEBASHING_HEADER));
    expect(codebashingSection, "Codebashing section not found on Description tab").to.not.be.undefined;
    expect(await codebashingSection.getText()).to.not.be.empty;

    await driver.switchTo().defaultContent();
  }));

  // Verifies the Description tab is clickable and its label element is present.
  it("should click on details Learn More tab", async function () {
    this.timeout(60000);

    // Details panel stays open from the previous test — just reset driver context.
    await driver.switchTo().defaultContent();

    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Vulnerability details panel is not open").to.be.true;

    await selectDetailsTab(driver,LEARN_TAB_INPUT);
    const descriptionLabel = await driver.findElement(By.id(LEARN_MORE_LABEL));
    expect(descriptionLabel, "Description tab label not found").to.not.be.undefined;

    await driver.switchTo().defaultContent();
  });

  // Verifies the Triage tab is clickable and its form elements (update button, comment box) are present.
  it("should click on details Changes tab", async function () {
    this.timeout(60000);

    await driver.switchTo().defaultContent();

    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Vulnerability details panel is not open").to.be.true;

    await selectDetailsTab(driver,CHANGES_TAB_INPUT);
    // Wait for the Triage tab container to render before asserting child elements.
    await waitByClassName(driver, CHANGES_CONTAINER, 5000);

    const triageLabel = await driver.findElement(By.id(CHANGES_LABEL));
    expect(triageLabel, "Changes tab label not found").to.not.be.undefined;

    // Submit button triggers the state-change form.
    const updateButton = await driver.findElement(By.className(UPDATE_BUTTON));
    expect(updateButton, "Update button not found").to.not.be.undefined;
    await updateButton.click();

    // Comment box should appear after clicking the update button.
    const commentBox = await driver.findElement(By.id(COMMENT_BOX));
    expect(commentBox, "Comment box not found").to.not.be.undefined;
    await commentBox.click();

    await driver.switchTo().defaultContent();
  });

  // Verifies the General tab (default) is clickable and its label is present.
  it("should click on details General tab", async function () {
    this.timeout(60000);

    await driver.switchTo().defaultContent();

    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Vulnerability details panel is not open").to.be.true;

    // Navigate back to the General tab.
    await selectDetailsTab(driver,GENERAL_TAB_INPUT);
    const generalLabel = await driver.findElement(By.id(GENERAL_LABEL));
    expect(generalLabel, "General tab label not found").to.not.be.undefined;

    await driver.switchTo().defaultContent();
  });
});
