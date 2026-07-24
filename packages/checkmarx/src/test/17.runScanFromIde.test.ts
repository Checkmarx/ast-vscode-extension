import {
  EditorView,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  getQuickPickSelector,
  initialize,
  loginWithMockToken,
  logoutIfVisible,
  retryTest,
  selectItem,
  sleep,
  waitForNotificationWithTimeout,
} from "./utils/utils";
import {
  BRANCH_KEY_TREE,
  CX_CLEAR,
  CX_SELECT_BRANCH,
  CX_SELECT_PROJECT,
  CX_SELECT_SCAN,
  FIVE_SECONDS,
  LOCAL_BRANCH_CONSTANT,
  MESSAGES,
  PROJECT_KEY_TREE,
  SCAN_KEY_TREE_LABEL,
  THREE_SECONDS,
  TWO_SECONDS,
} from "./utils/constants";
import {
  CX_TEST_SCAN_BRANCH_NAME,
  CX_TEST_SCAN_PROJECT_NAME,
} from "./utils/envs";

// IDE-initiated scan flow: two paths from the Regression Test Plan.
//   1. Rescan an existing branch (project + branch already in CxOne)
//   2. Scan as a new branch ("scan my local branch")
// scanCreate is mocked - no real scan runs, nothing is written remotely.
// No git commands are executed; the workspace branch and local changes are untouched.

// VS Code command id behind the "Run Scan" header button.
const RUN_SCAN_COMMAND = "ast-results.createScan";

// match fragments, not full strings, so minor wording changes don't break tests
const BRANCH_MISMATCH_FRAGMENT = "Git branch doesn't match the selected Checkmarx branch";
const LOAD_RESULTS_FRAGMENT = "Do you want to load results";

// action order: "Yes" = 0, "No" = 1
const ACTION_YES = 0;
const ACTION_NO = 1;

const SUITE_SETUP_TIMEOUT_MS = 120000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 120000;

// scan poller ticks every 15s, so "load results" dialog appears ~15s after the last prompt
const LOAD_RESULTS_WAIT_MS = 30000;
const LOAD_RESULTS_TEST_TIMEOUT_MS = 180000;

describe("Running Scans from VS Code", () => {
  let workbench: Workbench;
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
        if (attempt < retries) {
          await sleep(TWO_SECONDS);
        }
      }
    }
    throw lastError;
  }

  // use exact label match because "scan my local branch" is always prepended to the Branch picker
  async function selectQuickPickByLabel(
    command: string,
    label: string
  ): Promise<boolean> {
    await runCommand(command);
    const input = await InputBox.create();
    await sleep(TWO_SECONDS); // let the picker open before typing
    await input.setText(label);
    await sleep(TWO_SECONDS); // let the picker re-filter its items

    const picks = await input.getQuickPicks();
    for (const pick of picks) {
      if ((await pick.getText()).trim() === label) {
        await pick.select();
        await sleep(TWO_SECONDS); // let the tree react to the selection
        return true;
      }
    }

    // Requested label not offered — close the picker without choosing anything.
    await input.cancel();
    return false;
  }

  // clear notifications between tests so prompts don't bleed across
  async function dismissAllNotifications(): Promise<void> {
    try {
      const notifications = await workbench.getNotifications();
      for (const notification of notifications) {
        try {
          await notification.dismiss();
        } catch {
          // Toast already gone — nothing to dismiss.
        }
      }
    } catch {
      // No notification center available — nothing to clean up.
    }
  }

  // clicks "Run Scan" and handles each prompt by clicking the action at `actionIndex`.
  // returns all message texts seen; use a longer `notificationTimeout` to catch
  // the "load results" dialog (~15s after the last sanity prompt).
  async function runScanHandlingPrompts(
    actionIndex: number,
    notificationTimeout = FIVE_SECONDS,
    maxPrompts = 6
  ): Promise<string[]> {
    await runCommand(RUN_SCAN_COMMAND);

    const messages: string[] = [];
    for (let i = 0; i < maxPrompts; i++) {
      const notification = await waitForNotificationWithTimeout(notificationTimeout);
      if (!notification) {
        break;
      }

      const message = await notification.getMessage();
      messages.push(message);

      const actions = await notification.getActions();
      if (actions.length === 0) {
        // Informational toast with no buttons — the flow has ended.
        break;
      }

      // clamp in case a prompt only has one button
      const safeIndex = Math.min(actionIndex, actions.length - 1);
      await actions[safeIndex].click();
      await sleep(TWO_SECONDS);

      // "load results" is the last prompt - stop here
      if (message.includes(LOAD_RESULTS_FRAGMENT)) {
        break;
      }
    }
    return messages;
  }

  // VS Code asks to open the parent-folder git repo. We need to say Yes so the
  // Git extension can detect the current HEAD for "scan my local branch".
  // No git mutation - just opens the existing repo for reading.
  async function acceptParentGitRepositoryPrompt(maxWaitMs = 20000): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const notifications = await workbench.getNotifications().catch(() => []);

      for (const notification of notifications) {
        let message = "";
        try {
          message = (await notification.getMessage()).toLowerCase();
        } catch {
          continue; // toast vanished mid-iteration
        }

        if (message.includes("git repository was found in the parent")) {
          // "Yes" opens it for this session; "Always" is an acceptable fallback.
          for (const action of ["Yes", "Always"]) {
            try {
              await notification.takeAction(action);
              await sleep(FIVE_SECONDS); // let the Git extension open & scan the repo
              return true;
            } catch {
              // Button label not present — try the next candidate.
            }
          }
        }
      }
      await sleep(1000);
    }
    return false;
  }

  // Authenticates with a mock token and clears any leftover project/branch state.
  before(async function () {
    this.timeout(SUITE_SETUP_TIMEOUT_MS);
    workbench = new Workbench();
    driver = VSBrowser.instance.driver;

    // say Yes to "open parent git repo" prompt so the Git extension detects HEAD
    await acceptParentGitRepositoryPrompt();

    // reload ensures Git extension picks up the HEAD if the prompt was missed
    await runCommand("workbench.action.reloadWindow");
    await sleep(FIVE_SECONDS);

    await loginWithMockToken(workbench, {
      executeCommandWithRetry: runCommand,
      waitMs: THREE_SECONDS,
    });
    await runCommand(CX_CLEAR);
  });

  // clear prompts between tests
  afterEach(async function () {
    this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
    await dismissAllNotifications();
  });

  // cleanup - no git restoration needed since this suite never touched git
  after(async function () {
    this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
    await dismissAllNotifications();
    try {
      await logoutIfVisible(workbench, driver, { executeCommandWithRetry: runCommand });
    } catch {
      // Keep teardown resilient.
    }
    await runCommand(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  // precondition for rescan: project, branch and a previous Scan node must all be in the tree
  it(
    "should select an existing project and branch as the basis for a rescan",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await runCommand(CX_SELECT_PROJECT);
      const projectName = await selectItem(CX_TEST_SCAN_PROJECT_NAME);

      const branchSelected = await selectQuickPickByLabel(
        CX_SELECT_BRANCH,
        CX_TEST_SCAN_BRANCH_NAME
      );
      expect(branchSelected, `Branch "${CX_TEST_SCAN_BRANCH_NAME}" should be selectable`).to.be.true;
      await sleep(THREE_SECONDS); // let the latest scan auto-load into the tree

      const tree = await initialize();
      const project = await tree?.findItem(PROJECT_KEY_TREE + projectName);
      const branch = await tree?.findItem(BRANCH_KEY_TREE + CX_TEST_SCAN_BRANCH_NAME);
      const scan = await tree?.findItem(SCAN_KEY_TREE_LABEL);

      expect(project, `Should show project ${projectName}`).is.not.undefined;
      expect(branch, `Should show branch ${CX_TEST_SCAN_BRANCH_NAME}`).is.not.undefined;
      // An existing branch carries previous scans — required before a rescan.
      expect(scan, "Existing branch should expose a previous scan to rescan").is.not.undefined;
    })
  );

  // mock project never matches this workspace, so the mismatch warning should always appear
  it(
    "should run a sanity check and warn when the workspace does not match the project",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await runCommand(CX_SELECT_PROJECT);
      await selectItem(CX_TEST_SCAN_PROJECT_NAME);
      await selectQuickPickByLabel(CX_SELECT_BRANCH, CX_TEST_SCAN_BRANCH_NAME);
      await sleep(TWO_SECONDS);

      // decline everything - we just want to confirm the warning appears
      const messages = await runScanHandlingPrompts(ACTION_NO);

      expect(messages, "Sanity check should raise the project-mismatch warning").to.include(
        MESSAGES.scanProjectNotMatch
      );
    })
  );

  // accept the mismatch warning - scan should continue past it
  it(
    "should let the user run the scan despite the mismatch warning",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await runCommand(CX_SELECT_PROJECT);
      await selectItem(CX_TEST_SCAN_PROJECT_NAME);
      await selectQuickPickByLabel(CX_SELECT_BRANCH, CX_TEST_SCAN_BRANCH_NAME);
      await sleep(TWO_SECONDS);

      // accept everything so the scan proceeds
      const messages = await runScanHandlingPrompts(ACTION_YES);

      expect(messages, "First the mismatch warning should appear").to.include(
        MESSAGES.scanProjectNotMatch
      );
      // Choosing "Yes" must advance the flow beyond the initial warning.
      const advancedPastWarning = messages.some(
        (message) =>
          message.includes(BRANCH_MISMATCH_FRAGMENT) ||
          message.includes(LOAD_RESULTS_FRAGMENT)
      );
      expect(
        advancedPastWarning,
        "Running anyway should advance the scan past the mismatch warning"
      ).to.be.true;
    })
  );

  // selecting "scan my local branch" creates a new Checkmarx branch - no previous Scan node
  it(
    "should switch the branch to 'scan my local branch' to scan as a new Checkmarx branch",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await runCommand(CX_SELECT_PROJECT);
      const projectName = await selectItem(CX_TEST_SCAN_PROJECT_NAME);

      // reads current HEAD without modifying git
      const localBranchSelected = await selectQuickPickByLabel(
        CX_SELECT_BRANCH,
        LOCAL_BRANCH_CONSTANT
      );
      expect(
        localBranchSelected,
        `"${LOCAL_BRANCH_CONSTANT}" option should be offered in the Branch picker`
      ).to.be.true;
      await sleep(THREE_SECONDS);

      const tree = await initialize();
      const project = await tree?.findItem(PROJECT_KEY_TREE + projectName);
      const branch = await tree?.findItem(BRANCH_KEY_TREE + LOCAL_BRANCH_CONSTANT);
      const scan = await tree?.findItem(SCAN_KEY_TREE_LABEL);

      expect(project, `Should show project ${projectName}`).is.not.undefined;
      expect(branch, `Should show "${LOCAL_BRANCH_CONSTANT}" branch node`).is.not.undefined;
      // A new (not-yet-scanned) Checkmarx branch has no scans to display.
      expect(scan, "A brand-new local branch should expose no previous scan").is.undefined;
    })
  );

  // a completed scan should prompt to load the new results
  it(
    "should run a scan on the local branch and offer to load the new results",
    retryTest(async function () {
      // scan poller ticks every 15s, so "load results" appears ~15s after the last prompt
      this.timeout(LOAD_RESULTS_TEST_TIMEOUT_MS);

      await runCommand(CX_SELECT_PROJECT);
      await selectItem(CX_TEST_SCAN_PROJECT_NAME);
      const localBranchSelected = await selectQuickPickByLabel(
        CX_SELECT_BRANCH,
        LOCAL_BRANCH_CONSTANT
      );
      expect(
        localBranchSelected,
        `"${LOCAL_BRANCH_CONSTANT}" option should be offered in the Branch picker`
      ).to.be.true;
      await sleep(TWO_SECONDS);

      // accept prompts and wait long enough for the poll cycle to complete
      const messages = await runScanHandlingPrompts(ACTION_YES, LOAD_RESULTS_WAIT_MS);

      expect(messages, "Run Scan should produce at least one prompt").to.have.length.greaterThan(0);
      const offeredToLoadResults = messages.some((message) =>
        message.includes(LOAD_RESULTS_FRAGMENT)
      );
      expect(
        offeredToLoadResults,
        "A completed scan should prompt to load the new results"
      ).to.be.true;
    })
  );
});
