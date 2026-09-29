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
  CHANGES_TAB_INPUT,
  COMMENT_BOX,
  CX_CLEAR,
  CX_LOOK_SCAN,
  SAST_TYPE,
  SCAN_KEY_TREE_LABEL,
  UPDATE_BUTTON,
  WEBVIEW_TITLE,
} from "./utils/constants";
import { waitByClassName } from "./utils/waiters";
import { SCAN_ID } from "./utils/envs";

// TC33: severity dropdown update is reflected in the vulnerability details.
// TC34: state dropdown update is reflected in the vulnerability details.
// TC35: a comment is submitted successfully alongside a state change.
//
// cxMock.triageUpdate returns 0, triageShow returns no history - so we verify
// the success notification and re-rendered dropdown, not the Change history.

const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";

// dropdown ids in the Triage tab
const SELECT_SEVERITY_ID = "select_severity";
const SELECT_STATE_ID = "select_state";

// Notification shown by triageSubmit on a successful update (messages.triageSubmitedSuccess).
const TRIAGE_SUCCESS_MESSAGE = "Feedback submitted successfully";

// picks a different option, fires change events, returns { ok, previous, chosen }
const SELECT_DIFFERENT_OPTION = `
  const select = document.getElementById(arguments[0]);
  if (!select) { return JSON.stringify({ ok: false, reason: 'select-missing' }); }
  const previous = select.value;
  let chosen = null;
  for (const option of select.options) {
    if (option.value !== previous) { chosen = option.value; break; }
  }
  if (chosen === null) { return JSON.stringify({ ok: false, reason: 'no-alternative-option' }); }
  select.value = chosen;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return JSON.stringify({ ok: true, previous, chosen });
`;

// Reads the currently selected value of a dropdown by id.
const READ_SELECTED_VALUE = `
  const select = document.getElementById(arguments[0]);
  return select ? select.value : null;
`;

// sets the comment box value and fires change events
const SET_COMMENT = `
  const box = document.getElementById('${COMMENT_BOX}');
  if (!box) { return false; }
  box.value = arguments[0];
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
`;

describe("SAST triage updates (TC33, TC34, TC35)", () => {
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

  // loads the mock scan by id
  async function loadScanById(): Promise<void> {
    await runCommand(CX_CLEAR);
    await runCommand(CX_LOOK_SCAN);
    const scanIdInput = await InputBox.create();
    await sleep(1000);
    await scanIdInput.setText(SCAN_ID);
    await scanIdInput.confirm();
    await sleep(5000);
  }

  // opens the first SAST vulnerability and leaves driver in the default context
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

  // enters the details frame and switches to the Triage tab
  async function openTriageTab(): Promise<void> {
    const isOpen = await openDetailsFrame(driver);
    expect(isOpen, "Vulnerability details panel is not open").to.be.true;
    await selectDetailsTab(driver, CHANGES_TAB_INPUT);
    await waitByClassName(driver, UPDATE_BUTTON, 5000);
  }

  // Clicks the Update button inside the triage form.
  async function clickUpdate(): Promise<void> {
    const updateButton = await driver.findElement(By.className(UPDATE_BUTTON));
    await updateButton.click();
  }

  // poll for the success notification (must run in default context, not webview)
  async function waitForTriageSuccess(timeoutMs: number): Promise<string> {
    const start = Date.now();
    const seen: string[] = [];
    while (Date.now() - start < timeoutMs) {
      const notifications = await new Workbench().getNotifications();
      for (const notification of notifications) {
        try {
          const message = await notification.getMessage();
          if (message.includes(TRIAGE_SUCCESS_MESSAGE)) {
            return message;
          }
          seen.push(message);
        } catch {
          // Notification was dismissed mid-read; ignore and keep polling.
        }
      }
      await sleep(500);
    }
    throw new Error(
      `Triage success notification never appeared. Notifications seen: ${seen.join(" | ") || "none"}`
    );
  }

  // clear leftovers from previous tests
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
      // No notification center open - nothing to clear.
    }
  }

  // load scan and open a SAST finding once; all three tests reuse it
  before(async function () {
    this.timeout(180000);
    workbench = new Workbench();
    driver = VSBrowser.instance.driver;
    await initialize();
    await loginWithMockToken(workbench, { executeCommandWithRetry: runCommand, waitMs: 3000 });
    await loadScanById();
    await openFirstSastVulnerabilityDetails();
  });

  // cleanup - triage mutations shouldn't leak
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

  // TC33: change severity, submit, check the dropdown reflects the new value
  it(
    "TC33 - should update the severity and reflect it in the vulnerability details",
    retryTest(async function () {
      this.timeout(90000);

      await driver.switchTo().defaultContent();
      await dismissAllNotifications();
      await openTriageTab();

      // pick a different severity and submit
      const change = JSON.parse(
        await driver.executeScript(SELECT_DIFFERENT_OPTION, SELECT_SEVERITY_ID)
      );
      expect(change.ok, `Could not select a new severity: ${change.reason}`).to.be.true;
      await clickUpdate();

      // confirm success notification
      await driver.switchTo().defaultContent();
      const message = await waitForTriageSuccess(20000);
      expect(message).to.include(TRIAGE_SUCCESS_MESSAGE);

      // re-rendered dropdown should show the new severity
      await openTriageTab();
      const reflected = await driver.executeScript(READ_SELECTED_VALUE, SELECT_SEVERITY_ID);
      expect(reflected).to.equal(
        change.chosen,
        "Severity dropdown should reflect the updated severity after submit"
      );

      await driver.switchTo().defaultContent();
    }, 2)
  );

  // TC34: change state, submit, check the dropdown reflects the new value
  it(
    "TC34 - should update the state and reflect it in the vulnerability details",
    retryTest(async function () {
      this.timeout(90000);

      await driver.switchTo().defaultContent();
      await dismissAllNotifications();
      await openTriageTab();

      // pick a different state and submit
      const change = JSON.parse(
        await driver.executeScript(SELECT_DIFFERENT_OPTION, SELECT_STATE_ID)
      );
      expect(change.ok, `Could not select a new state: ${change.reason}`).to.be.true;
      await clickUpdate();

      await driver.switchTo().defaultContent();
      const message = await waitForTriageSuccess(20000);
      expect(message).to.include(TRIAGE_SUCCESS_MESSAGE);

      // re-rendered dropdown should show the new state
      await openTriageTab();
      const reflected = await driver.executeScript(READ_SELECTED_VALUE, SELECT_STATE_ID);
      expect(reflected).to.equal(
        change.chosen,
        "State dropdown should reflect the updated state after submit"
      );

      await driver.switchTo().defaultContent();
    }, 2)
  );

  // TC35: comment + state change should submit successfully (comment alone is rejected)
  it(
    "TC35 - should accept a comment and submit it with a state change",
    retryTest(async function () {
      this.timeout(90000);

      await driver.switchTo().defaultContent();
      await dismissAllNotifications();
      await openTriageTab();

      // a comment alone is rejected - need a real change too
      const change = JSON.parse(
        await driver.executeScript(SELECT_DIFFERENT_OPTION, SELECT_STATE_ID)
      );
      expect(change.ok, `Could not select a new state: ${change.reason}`).to.be.true;

      // type the comment and verify the box retained it
      const commentText = `Automated triage comment ${Date.now()}`;
      const commentBoxFound = await driver.executeScript(SET_COMMENT, commentText);
      expect(commentBoxFound, "Comment box not found in the Triage tab").to.be.true;

      const typedComment = await driver.executeScript(
        `return document.getElementById('${COMMENT_BOX}').value;`
      );
      expect(typedComment).to.equal(commentText, "Comment box should retain the typed note");

      await clickUpdate();

      // success means the comment was submitted
      await driver.switchTo().defaultContent();
      const message = await waitForTriageSuccess(20000);
      expect(message).to.include(TRIAGE_SUCCESS_MESSAGE);
    }, 2)
  );
});
