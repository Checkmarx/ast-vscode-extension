import { EditorView, VSBrowser, WebDriver, Workbench } from "vscode-extension-tester";
import { expect } from "chai";
import { CX_CLEAR } from "./utils/constants";
import { initializeSCA, loginWithMockToken, logoutIfVisible } from "./utils/utils";

const SUITE_SETUP_TIMEOUT_MS = 100000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 60000;
const COMMAND_RETRY_DELAY_MS = 2000;

// Pauses execution between retry attempts.
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("SCA scan panel test", () => {
  let bench: Workbench;
  let driver: WebDriver;

  // Runs a VS Code command with retries to reduce transient UI failures.
  async function runCommandWithRetry(command: string, retries = 3): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await bench.executeCommand(command);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await sleep(COMMAND_RETRY_DELAY_MS);
        }
      }
    }
    throw lastError;
  }

  // Logs in once for the suite and starts from a clean tree state.
  before(async function () {
    this.timeout(SUITE_SETUP_TIMEOUT_MS);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;

    await loginWithMockToken(bench, {
      executeCommandWithRetry: runCommandWithRetry,
      waitMs: 3000,
    });
    await runCommandWithRetry(CX_CLEAR);
  });

  // Logs out and clears UI state so other tests are not affected.
  after(async function () {
    this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
    try {
      await logoutIfVisible(bench, driver, {
        executeCommandWithRetry: runCommandWithRetry,
      });
    } catch {
      // Keep teardown resilient.
    }
    await runCommandWithRetry(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  it("should show the SCA results tree", async function () {
    this.timeout(TEST_TIMEOUT_MS);

    const tree = await initializeSCA();
    expect(tree, "SCA results tree should be visible").to.not.be.undefined;
  });
});
