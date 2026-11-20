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
  waitForTreeItem,
  waitForInputBox,
  clickQuickPickItem
} from "./utils/utils";
import {
  BRANCH_KEY_TREE,
  CX_CLEAR,
  CX_SELECT_ALL,
  PROJECT_KEY_TREE,
  SCAN_KEY_TREE,
  THIRTY_SECONDS,
} from "./utils/constants";
import { CX_TEST_SCAN_BRANCH_NAME, CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";

// Pickers open only after the tenant call returns (real tenant: up to ~15 s for projects).
const PICKER_OPEN_TIMEOUT_MS = THIRTY_SECONDS;

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
    this.timeout(180000); // Increase timeout to 60 seconds

    // Project selection
    const inputProject = await waitForInputBox(PICKER_OPEN_TIMEOUT_MS);
    // Add delay to ensure input box is ready
    await new Promise((res) => setTimeout(res, 1000));

    await inputProject.setText(CX_TEST_SCAN_PROJECT_NAME);
    let projectName = await getQuickPickSelector(inputProject);
    await clickQuickPickItem(inputProject, projectName);

    // Branch selection
    const input = await waitForInputBox(PICKER_OPEN_TIMEOUT_MS);
    await new Promise((res) => setTimeout(res, 1000));
    // wizard lists every branch of the project and VS Code filters client-side: no typing needed.
    // The branch list loads after the project step; until then the picker still shows the
    // project entry, so wait for a list that no longer contains it.
    let branchName = "";
    const branchDeadline = Date.now() + 60000;
    while (!branchName && Date.now() < branchDeadline) {
      try {
        const texts: string[] = [];
        for (const pick of await input.getQuickPicks()) {
          texts.push((await pick.getText()).trim());
        }
        if (texts.length > 0 && !texts.includes(projectName.trim())) {
          branchName = texts[0];
        }
      } catch {
        // list re-rendered while reading; retry
      }
      if (!branchName) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
    expect(branchName, "branch list should load in the wizard").to.not.equal("");
    await clickQuickPickItem(input, branchName);

    // Scan selection
    const inputScan = new InputBox();
    await new Promise((res) => setTimeout(res, 1000));
    // The scan list loads after the branch step: until then the picker still lists the branch,
    // so wait for an entry that starts with a date (e.g. "2026/11/16 19:29:38 <id>").
    let scanDate = "";
    const scanDeadline = Date.now() + 60000;
    while (!scanDate && Date.now() < scanDeadline) {
      try {
        for (const pick of await inputScan.getQuickPicks()) {
          const text = (await pick.getText()).trim();
          if (/^[0-9]{4}[/][0-9]{2}[/][0-9]{2} /.test(text)) {
            scanDate = text;
            break;
          }
        }
      } catch {
        // list re-rendered while reading; retry
      }
      if (!scanDate) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
    expect(scanDate, "scan list should load in the wizard").to.not.equal("");
    await clickQuickPickItem(inputScan, scanDate);

    treeScans = await initialize();

    // Project tree item validation
    let project = await waitForTreeItem(treeScans, PROJECT_KEY_TREE + projectName);
    expect(project).is.not.undefined;

    // Branch tree item validation
    let branch = await waitForTreeItem(treeScans, BRANCH_KEY_TREE + branchName);
    expect(branch).is.not.undefined;

    const scanDetailsparts: string[] = scanDate.split(" ");
    const formattedId: string = scanDetailsparts.slice(-2).join(" ");
    // Scan tree item validation
    let scan = await waitForTreeItem(treeScans, SCAN_KEY_TREE + formattedId);
    const maxAttempts = 30;
    let attempts = 0;
    while (scan === undefined && attempts < maxAttempts) {
      await new Promise((res) => setTimeout(res, 500));
      scan = await waitForTreeItem(treeScans, SCAN_KEY_TREE + formattedId);
      attempts++;
    }
    expect(scan).is.not.undefined;
  });
});
