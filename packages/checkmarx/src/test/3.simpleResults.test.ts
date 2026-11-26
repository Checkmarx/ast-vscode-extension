import {
  EditorView,
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
  CX_SELECT_BRANCH,
  CX_SELECT_PROJECT,
  CX_SELECT_SCAN,
  PROJECT_KEY_TREE,
  SCAN_KEY_TREE,
} from "./utils/constants";
import { CX_TEST_SCAN_BRANCH_NAME, CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";

// Small sleep helper used for UI settling delays between steps.
async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Individual pickers load results test", () => {
  let bench: Workbench;
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
          await wait(2000);
        }
      }
    }
    throw lastError;
  }

  async function selectForTest(command: string, text: string, treeKey: string): Promise<void> {
    await bench.executeCommand(command);
    const selected = await selectItem(text);
    const item = await waitForTreeItem(await initialize(), treeKey + selected);
    expect(item).is.not.undefined;
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

  it("should select project", async function () {
    this.timeout(180000);
    await selectForTest(CX_SELECT_PROJECT, CX_TEST_SCAN_PROJECT_NAME, PROJECT_KEY_TREE);
  });

  it("should select branch", async function () {
    this.timeout(180000);
    await selectForTest(CX_SELECT_BRANCH, CX_TEST_SCAN_BRANCH_NAME, BRANCH_KEY_TREE);
  });

  it("should select scan", async function () {
    this.timeout(180000);

    await bench.executeCommand(CX_SELECT_SCAN);
    // first (latest) scan
    const scanDate = await clickQuickPickItem(await waitForInputBox());
    const formattedId: string = scanDate.split(" ").slice(-2).join(" ");
    const scan = await waitForTreeItem(await initialize(), SCAN_KEY_TREE + formattedId);
    expect(scan).is.not.undefined;
  });
});
