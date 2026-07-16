import {
  EditorView,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  loginWithMockToken,
  logoutIfVisible,
  retryTest,
  selectItem,
  sleep,
} from "./utils/utils";
import {
  CX_CLEAR,
  CX_SELECT_BRANCH,
  CX_SELECT_PROJECT,
  THREE_SECONDS,
  TWO_SECONDS,
} from "./utils/constants";
import { CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";

// Verify the Branch picker only shows branches for the selected project.
// test-proj-21 has "main"/"branch1"..., test-proj-3 has "develop"/"release-1.0"/"feature-login".

const SECOND_PROJECT_NAME = "test-proj-3";

// a branch unique to each project
const PROJECT_21_BRANCH = "branch1";
const PROJECT_3_BRANCH = "develop";

const SUITE_SETUP_TIMEOUT_MS = 100000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 90000;

describe("Branch filter is scoped to the selected project", () => {
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
        if (attempt < retries) await sleep(TWO_SECONDS);
      }
    }
    throw lastError;
  }

  // selects the project, reads all branch labels from the picker, then cancels
  async function getBranchLabelsForProject(projectName: string): Promise<string[]> {
    // The branch list is scoped to the active project, so pick the project first.
    await runCommand(CX_SELECT_PROJECT);
    await selectItem(projectName);
    await sleep(TWO_SECONDS);

    // open the picker and collect all branch labels
    await runCommand(CX_SELECT_BRANCH);
    const input = await InputBox.create();
    await sleep(TWO_SECONDS); // let the picker finish loading its items

    const picks = await input.getQuickPicks();
    const labels: string[] = [];
    for (const pick of picks) {
      labels.push((await pick.getText()).trim());
    }

    // Close the quick-pick without selecting a branch.
    await input.cancel();
    await sleep(TWO_SECONDS);
    return labels;
  }

  // auth and clear state
  before(async function () {
    this.timeout(SUITE_SETUP_TIMEOUT_MS);
    workbench = new Workbench();
    driver = VSBrowser.instance.driver;
    await loginWithMockToken(workbench, {
      executeCommandWithRetry: runCommand,
      waitMs: THREE_SECONDS,
    });
    await runCommand(CX_CLEAR);
  });

  // cleanup after suite
  after(async function () {
    this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
    try {
      await logoutIfVisible(workbench, driver, { executeCommandWithRetry: runCommand });
    } catch {
      // best effort on teardown
    }
    await runCommand(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  it(
    "should display only the branches that belong to the selected project",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      // Project test-proj-21: should show its own branches, not test-proj-3's.
      const project21Branches = await getBranchLabelsForProject(CX_TEST_SCAN_PROJECT_NAME);
      expect(project21Branches, `${CX_TEST_SCAN_PROJECT_NAME} should list "main"`)
        .to.include("main");
      expect(project21Branches, `${CX_TEST_SCAN_PROJECT_NAME} should list its own branches`)
        .to.include(PROJECT_21_BRANCH);
      expect(
        project21Branches,
        `${CX_TEST_SCAN_PROJECT_NAME} must not show ${SECOND_PROJECT_NAME}'s branches`
      ).to.not.include(PROJECT_3_BRANCH);

      // Project test-proj-3: should show its own branches, not test-proj-21's.
      const project3Branches = await getBranchLabelsForProject(SECOND_PROJECT_NAME);
      expect(project3Branches, `${SECOND_PROJECT_NAME} should list its own branches`)
        .to.include(PROJECT_3_BRANCH);
      expect(
        project3Branches,
        `${SECOND_PROJECT_NAME} must not show ${CX_TEST_SCAN_PROJECT_NAME}'s branches`
      ).to.not.include(PROJECT_21_BRANCH);
    })
  );
});
