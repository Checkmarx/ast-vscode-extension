import {
  By,
  CustomTreeSection,
  EditorView,
  InputBox,
  until,
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
  CX_CLEAR,
  CX_LOOK_SCAN,
  GENERAL_TAB_INPUT,
  SCAN_KEY_TREE_LABEL,
  SCS_SECRET_DETECTION_Type,
  WEBVIEW_TITLE,
} from "./utils/constants";
import { SCAN_ID } from "./utils/envs";

// TC83: General tab shows a clickable file path link for Secret Detection findings.
// TC84: the link targets the correct file and line.
//
// The vulnerability's tree label encodes file+line, e.g. "Secret Detection (/secrets.go:12)".
// We capture that label and assert the link matches it - stays correct even if mock data changes.
// Note: actually opening the file needs it in the workspace; that's a manual/backend check.

const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";

// The anchor id rendered for the secret detection file path (see details.ts).
const FILE_PATH_LINK_ID = "ast-node-0";

const FRAME_WAIT_MS = 5000;

describe("Secret Detection file path link in General tab (TC83, TC84)", () => {
  let workbench: Workbench;
  let driver: WebDriver;
  let resultsTree: CustomTreeSection;

  // e.g. "Secret Detection (/secrets.go:12)" - source of truth for file/line assertions
  let secretLabel: string;

  // Retries a VS Code command to absorb transient UI delays.
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

  // parses file and line from a label like "Secret Detection (/secrets.go:12)"
  function parseFileAndLine(label: string): { file: string; line: string } {
    const match = label.match(/\(([^()]+):(\d+)\)\s*$/);
    if (!match) {
      throw new Error(`Could not parse file/line from secret label: "${label}"`);
    }
    return { file: match[1], line: match[2] };
  }

  // loads the scan, opens the first Secret Detection finding's details, returns its label
  async function openFirstSecretDetectionDetails(): Promise<string> {
    await runCommand(CX_CLEAR);
    await runCommand(CX_LOOK_SCAN);
    const scanIdInput = await InputBox.create();
    await sleep(1000);
    await scanIdInput.setText(SCAN_ID);
    await scanIdInput.confirm();
    await sleep(5000);

    await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);
    resultsTree = await initialize();
    while (resultsTree === undefined) {
      resultsTree = await initialize();
    }

    const scanRoot = await resultsTree?.findItem(SCAN_KEY_TREE_LABEL);
    await scanRoot?.expand();
    await sleep(500);

    let secretNode = await scanRoot?.findChildItem(SCS_SECRET_DETECTION_Type);
    if (secretNode === undefined) {
      await sleep(2000);
      secretNode = await scanRoot?.findChildItem(SCS_SECRET_DETECTION_Type);
    }
    expect(secretNode, "Secret detection node not found").to.not.be.undefined;

    await secretNode?.expand();
    await sleep(500);

    // getResults expands the first severity group and returns the actual findings.
    let vulnItems = await getResults(secretNode);
    while (!vulnItems || vulnItems.length === 0) {
      await sleep(1000);
      vulnItems = await getResults(secretNode);
    }

    const label = await vulnItems[0].getLabel();

    await driver.switchTo().defaultContent();
    await new EditorView().closeAllEditors();

    await vulnItems[0].click();
    await sleep(5000);

    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Secret detection details panel did not open").to.be.true;
    await driver.findElement(By.id(WEBVIEW_TITLE));
    await driver.switchTo().defaultContent();

    return label;
  }

  // enters details frame, switches to General tab and finds the file path link
  async function getGeneralTabFilePathLink() {
    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Secret detection details panel is not open").to.be.true;
    await selectDetailsTab(driver, GENERAL_TAB_INPUT);
    await driver.wait(until.elementLocated(By.id(FILE_PATH_LINK_ID)), FRAME_WAIT_MS);
    return driver.findElement(By.id(FILE_PATH_LINK_ID));
  }

  // clear toasts e.g. after clicking the file link
  async function dismissAllNotifications(): Promise<void> {
    try {
      const notifications = await new Workbench().getNotifications();
      for (const notification of notifications) {
        try {
          await notification.dismiss();
        } catch {
          // Already gone - ignore.
        }
      }
    } catch {
      // Nothing to dismiss.
    }
  }

  // open a secret finding once; both tests reuse it
  before(async function () {
    this.timeout(180000);
    workbench = new Workbench();
    driver = VSBrowser.instance.driver;
    await initialize();
    await loginWithMockToken(workbench, { executeCommandWithRetry: runCommand, waitMs: 3000 });
    secretLabel = await openFirstSecretDetectionDetails();
  });

  // cleanup after suite
  after(async function () {
    this.timeout(60000);
    try { await driver.switchTo().defaultContent(); } catch { /* ignore */ }
    await dismissAllNotifications();
    try {
      await logoutIfVisible(workbench, driver, { executeCommandWithRetry: runCommand });
    } catch {
      // Keep teardown resilient.
    }
    await runCommand(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  // TC83: General tab should show the file path as a link
  it(
    "TC83 - should display the clickable file path link in the General tab",
    retryTest(async function () {
      this.timeout(90000);

      await driver.switchTo().defaultContent();
      const link = await getGeneralTabFilePathLink();

      expect(await link.isDisplayed(), "File path link should be visible").to.be.true;
      expect((await link.getTagName()).toLowerCase(), "File path should be an anchor").to.equal("a");

      // link text should reference the file name
      const { file } = parseFileAndLine(secretLabel);
      const fileName = file.split("/").pop() as string;
      const linkText = (await link.getText()).trim();
      expect(linkText, `Link text should reference "${fileName}"`).to.contain(fileName);

      await driver.switchTo().defaultContent();
    }, 2)
  );

  // TC84: link must have the right data-line and be clickable
  it(
    "TC84 - should target the correct file and line and be clickable",
    retryTest(async function () {
      this.timeout(90000);

      await driver.switchTo().defaultContent();
      const link = await getGeneralTabFilePathLink();

      const { file, line } = parseFileAndLine(secretLabel);
      const fileName = file.split("/").pop() as string;

      // data-line must match the line from the tree label
      const dataLine = await link.getAttribute("data-line");
      expect(dataLine, "Link should target the vulnerability's line").to.equal(line);

      // And it should reference the correct file.
      const linkText = (await link.getText()).trim();
      expect(linkText, `Link should reference "${fileName}"`).to.contain(fileName);

      // link must be clickable
      await link.click();
      await sleep(1000);

      // mock doesn't have the file so a "not found" toast may appear - dismiss it
      await driver.switchTo().defaultContent();
      await dismissAllNotifications();
    }, 2)
  );
});
