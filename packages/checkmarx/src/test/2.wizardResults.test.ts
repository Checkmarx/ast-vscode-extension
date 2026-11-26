import {
  CustomTreeSection,
  EditorView,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  clickQuickPickItem,
  initialize,
  loginWithMockToken,
  logoutIfVisible,
  selectItem,
  waitForInputBox,
  waitForTreeItem,
} from "./utils/utils";
import {
  BRANCH_KEY_TREE,
  CX_CLEAR,
  CX_SELECT_ALL,
  PROJECT_KEY_TREE,
  SCAN_KEY_TREE,
} from "./utils/constants";
import { CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";

// Small sleep helper used for UI settling delays between steps.
async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Wizard load results test", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  // Retries a VS Code command up to `retries` times to absorb transient UI delays.
  async function executeCommandWithRetry(command: string, retries = 3): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await bench.executeCommand(command);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await wait(1500);
        }
      }
    }
    throw lastError;
  }

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await initialize();
    await loginWithMockToken(bench, {
      executeCommandWithRetry: executeCommandWithRetry,
      waitMs: 3000,
    });
    await executeCommandWithRetry(CX_CLEAR);
    await executeCommandWithRetry(CX_SELECT_ALL);
  });

  after(async function () {
    this.timeout(180000);
    try {
      await logoutIfVisible(bench, driver, {
        executeCommandWithRetry: executeCommandWithRetry,
      });
    } catch {
      // Keep teardown resilient.
    }
    await executeCommandWithRetry(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  it("should load results using wizard", async function () {
    this.timeout(180000);

    // Project selection
    const projectName = await selectItem(CX_TEST_SCAN_PROJECT_NAME);

    // Branch selection. The wizard lists every branch and VS Code filters client-side, so the
    // entry is clicked without typing. Until the branch step loads, the picker still lists the
    // project, so wait for a list without it.
    const branchName = await clickQuickPickItem(await waitForInputBox(), (_, all) => !all.includes(projectName));

    // Scan selection: entries start with a date (e.g. "2026/11/16 19:29:38 <id>"); until the scan
    // step loads, the picker still lists the branch.
    const scanDate = await clickQuickPickItem(new InputBox(), (text) => /^[0-9]{4}[/][0-9]{2}[/][0-9]{2} /.test(text));

    treeScans = await initialize();

    // Project tree item validation
    const project = await waitForTreeItem(treeScans, PROJECT_KEY_TREE + projectName);
    expect(project).is.not.undefined;

    // Branch tree item validation
    const branch = await waitForTreeItem(treeScans, BRANCH_KEY_TREE + branchName);
    expect(branch).is.not.undefined;

    const formattedId: string = scanDate.split(" ").slice(-2).join(" ");
    // Scan tree item validation
    const scan = await waitForTreeItem(treeScans, SCAN_KEY_TREE + formattedId);
    expect(scan).is.not.undefined;
  });
});
