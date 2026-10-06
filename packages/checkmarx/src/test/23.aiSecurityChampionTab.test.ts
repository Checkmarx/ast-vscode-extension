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
  sleep,
} from "./utils/utils";
import {
  CX_CLEAR,
  CX_LOOK_SCAN,
  SAST_TYPE,
  SCAN_KEY_TREE_LABEL,
  WEBVIEW_TITLE,
} from "./utils/constants";
import { SCAN_ID } from "./utils/envs";

// TC37: Verify the "AI Security Champion" tab is available for SAST vulnerabilities.
//   1. Open a SAST vulnerability from a scan with SAST results.
//   2. The "AI Security Champion" tab should be present in the details panel
//      and clicking it should reveal its content ("Start Remediation").
//
// TC44: Verify the "AI Security Champion" tab is available for IaC vulnerabilities.
//   1. Open an IaC vulnerability from a scan with IaC results.
//   2. The "AI Security Champion" tab should be present in the details panel
//      and clicking it should reveal its content (the suggested question cards).

const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";

// AI Security Champion tab markers (see html.tab() in
// packages/core/src/utils/interface/details.ts). The tab id/label are shared
// across result types; only the rendered content differs per engine.
const AI_TAB_INPUT = "ai-tab";
const AI_TAB_LABEL = "ai-label";
const AI_TAB_LABEL_TEXT = "AI Security Champion";

// SAST AI tab content marker (html.guidedRemediationSastTab()).
const AI_TAB_START_REMEDIATION_BUTTON = "startSastChat";

// IaC AI tab content marker (html.guidedRemediationTab()).
const AI_TAB_IAC_CARDS_CONTAINER = "cards-container";

// The results tree groups by "typeLabel" first, which for IaC/KICS results comes
// straight from the result's own "label" field ("IaC Security" in the mock scan
// data - see cxMock.ts getResults()), not the raw "kics" type/engine name.
const IAC_TREE_LABEL = "IaC Security";

const SUITE_SETUP_TIMEOUT_MS = 100000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 120000;

describe("AI Security Champion tab for SAST vulnerabilities (TC37)", () => {
  let workbench: Workbench;
  let resultsTree: CustomTreeSection;
  let driver: WebDriver;

  // command palette is flaky - retry a few times
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

  // loads the mock scan by id (this scan has SAST results)
  async function loadScanById(): Promise<void> {
    await runCommand(CX_CLEAR);
    await runCommand(CX_LOOK_SCAN);
    const scanIdInput = await InputBox.create();
    await sleep(1000);
    await scanIdInput.setText(SCAN_ID);
    await scanIdInput.confirm();
    await sleep(5000);
  }

  // opens the first SAST vulnerability details panel and leaves driver in the default context
  async function openFirstSastVulnerabilityDetails(): Promise<void> {
    await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);
    resultsTree = await initialize();
    while (resultsTree === undefined) {
      resultsTree = await initialize();
    }

    const scanRoot = await resultsTree?.findItem(SCAN_KEY_TREE_LABEL);
    await scanRoot?.expand();
    await sleep(500);

    let sastItem = await scanRoot?.findChildItem(SAST_TYPE);
    if (sastItem === undefined) {
      await sleep(2000);
      sastItem = await scanRoot?.findChildItem(SAST_TYPE);
    }
    expect(sastItem, "SAST node not found").to.not.be.undefined;

    await sastItem?.expand();
    await sleep(500);

    let vulnItems = await getResults(sastItem);
    while (!vulnItems || vulnItems.length === 0) {
      await sleep(1000);
      vulnItems = await getResults(sastItem);
    }

    // close editors so the frame search lands on our details panel
    await driver.switchTo().defaultContent();
    await new EditorView().closeAllEditors();

    await vulnItems[0].click();
    await sleep(5000);

    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Vulnerability details panel did not open").to.be.true;
    // confirm we're on the right panel before leaving the frame
    await driver.findElement(By.id(WEBVIEW_TITLE));
    await driver.switchTo().defaultContent();
  }

  // auth, clear state, load a SAST scan and open the first vulnerability
  before(async function () {
    this.timeout(SUITE_SETUP_TIMEOUT_MS);
    workbench = new Workbench();
    driver = VSBrowser.instance.driver;
    await initialize();
    await loginWithMockToken(workbench, {
      executeCommandWithRetry: runCommand,
      waitMs: 3000,
    });
    await loadScanById();
    await openFirstSastVulnerabilityDetails();
  });

  // cleanup after suite
  after(async function () {
    this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
    try { await driver.switchTo().defaultContent(); } catch { /* ignore */ }
    try {
      await logoutIfVisible(workbench, driver, { executeCommandWithRetry: runCommand });
    } catch {
      // best effort on teardown
    }
    await runCommand(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  it(
    "TC37 - should show the AI Security Champion tab for a SAST vulnerability",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      const isOpen = await openDetailsFrame(driver);
      expect(isOpen, "Vulnerability details panel is not open").to.be.true;

      // the tab (radio input + label) should be present in the DOM
      const tabInput = await driver.findElement(By.id(AI_TAB_INPUT));
      expect(tabInput, "AI Security Champion tab input not found").to.not.be.undefined;

      const tabLabel = await driver.findElement(By.id(AI_TAB_LABEL));
      expect(
        (await tabLabel.getText()).trim(),
        "AI Security Champion tab should be labelled correctly"
      ).to.equal(AI_TAB_LABEL_TEXT);

      // click the tab and confirm its content renders
      await tabLabel.click();
      await sleep(1000);

      const startRemediationButton = await driver.findElement(
        By.id(AI_TAB_START_REMEDIATION_BUTTON)
      );
      expect(
        startRemediationButton,
        "AI Security Champion tab content (Start Remediation) did not render"
      ).to.not.be.undefined;
      expect(await startRemediationButton.isDisplayed()).to.be.true;

      await driver.switchTo().defaultContent();
    })
  );
});

describe("AI Security Champion tab for IaC vulnerabilities (TC44)", () => {
  let workbench: Workbench;
  let resultsTree: CustomTreeSection;
  let driver: WebDriver;

  // command palette is flaky - retry a few times
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

  // loads the mock scan by id (this scan has IaC results)
  async function loadScanById(): Promise<void> {
    await runCommand(CX_CLEAR);
    await runCommand(CX_LOOK_SCAN);
    const scanIdInput = await InputBox.create();
    await sleep(1000);
    await scanIdInput.setText(SCAN_ID);
    await scanIdInput.confirm();
    await sleep(5000);
  }

  // opens the first IaC vulnerability details panel and leaves driver in the default context
  async function openFirstIacVulnerabilityDetails(): Promise<void> {
    await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);
    resultsTree = await initialize();
    while (resultsTree === undefined) {
      resultsTree = await initialize();
    }

    const scanRoot = await resultsTree?.findItem(SCAN_KEY_TREE_LABEL);
    await scanRoot?.expand();
    await sleep(500);

    let iacItem = await scanRoot?.findChildItem(IAC_TREE_LABEL);
    if (iacItem === undefined) {
      await sleep(2000);
      iacItem = await scanRoot?.findChildItem(IAC_TREE_LABEL);
    }
    expect(iacItem, "IaC node not found").to.not.be.undefined;

    await iacItem?.expand();
    await sleep(500);

    let vulnItems = await getResults(iacItem);
    while (!vulnItems || vulnItems.length === 0) {
      await sleep(1000);
      vulnItems = await getResults(iacItem);
    }

    // close editors so the frame search lands on our details panel
    await driver.switchTo().defaultContent();
    await new EditorView().closeAllEditors();

    await vulnItems[0].click();
    await sleep(5000);

    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Vulnerability details panel did not open").to.be.true;
    // confirm we're on the right panel before leaving the frame
    await driver.findElement(By.id(WEBVIEW_TITLE));
    await driver.switchTo().defaultContent();
  }

  // auth, clear state, load an IaC scan and open the first vulnerability
  before(async function () {
    this.timeout(SUITE_SETUP_TIMEOUT_MS);
    workbench = new Workbench();
    driver = VSBrowser.instance.driver;
    await initialize();
    await loginWithMockToken(workbench, {
      executeCommandWithRetry: runCommand,
      waitMs: 3000,
    });
    await loadScanById();
    await openFirstIacVulnerabilityDetails();
  });

  // cleanup after suite
  after(async function () {
    this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
    try { await driver.switchTo().defaultContent(); } catch { /* ignore */ }
    try {
      await logoutIfVisible(workbench, driver, { executeCommandWithRetry: runCommand });
    } catch {
      // best effort on teardown
    }
    await runCommand(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  it(
    "TC44 - should show the AI Security Champion tab for an IaC vulnerability",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      const isOpen = await openDetailsFrame(driver);
      expect(isOpen, "Vulnerability details panel is not open").to.be.true;

      // the tab (radio input + label) should be present in the DOM
      const tabInput = await driver.findElement(By.id(AI_TAB_INPUT));
      expect(tabInput, "AI Security Champion tab input not found").to.not.be.undefined;

      const tabLabel = await driver.findElement(By.id(AI_TAB_LABEL));
      expect(
        (await tabLabel.getText()).trim(),
        "AI Security Champion tab should be labelled correctly"
      ).to.equal(AI_TAB_LABEL_TEXT);

      // click the tab and confirm its content renders
      await tabLabel.click();
      await sleep(1000);

      const cardsContainer = await driver.findElement(
        By.id(AI_TAB_IAC_CARDS_CONTAINER)
      );
      expect(
        cardsContainer,
        "AI Security Champion tab content (suggested questions) did not render"
      ).to.not.be.undefined;
      expect(await cardsContainer.isDisplayed()).to.be.true;

      await driver.switchTo().defaultContent();
    })
  );
});
