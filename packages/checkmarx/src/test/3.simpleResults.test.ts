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
  getQuickPickSelector,
  initialize,
  loginWithMockToken,
  logoutIfVisible,
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

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Individual pickers load results test", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

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

  async function selectProjectForTest(tree: CustomTreeSection): Promise<string> {
    await bench.executeCommand(CX_SELECT_PROJECT);
    const input = await InputBox.create();
    await wait(1000);
    await input.setText(CX_TEST_SCAN_PROJECT_NAME);
    const projectName = await getQuickPickSelector(input);
    await input.setText(projectName);
    await input.confirm();

    const project = await tree?.findItem(PROJECT_KEY_TREE + projectName);
    expect(project).is.not.undefined;
    return projectName;
  }

  async function selectBranchForTest(tree: CustomTreeSection): Promise<string> {
    await bench.executeCommand(CX_SELECT_BRANCH);
    const input = await InputBox.create();
    await wait(1000);
    await input.setText(CX_TEST_SCAN_BRANCH_NAME);
    const branchName = await getQuickPickSelector(input);
    await input.setText(branchName);
    await input.confirm();

    const branch = await tree?.findItem(BRANCH_KEY_TREE + branchName);
    expect(branch).is.not.undefined;
    return branchName;
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
    this.timeout(60000);
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
    this.timeout(60000); // Increase timeout to 60 seconds

    treeScans = await initialize();
    await selectProjectForTest(treeScans);
  });

  it("should select branch", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    const tree = await initialize();
    await selectBranchForTest(tree);
  });

  it("should select scan", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    const tree = await initialize();
    // Execute scan selection command
    await bench.executeCommand(CX_SELECT_SCAN);
    const input = await InputBox.create();
    // Add delay to ensure input box is ready
    await wait(1000);
    // Select from the pickers list
    const scanDate = await getQuickPickSelector(input);
    await input.setText(scanDate);
    await input.confirm();
    // Wait for scan selection to be made
    const scanDetailsparts: string[] = scanDate.split(" ");
    const formattedId: string = scanDetailsparts.slice(-2).join(" ");
    const scan = await tree?.findItem(SCAN_KEY_TREE + formattedId);
    expect(scan).is.not.undefined;
  });
});
