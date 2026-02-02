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
  quickPickSelector,
  waitForInputBoxReady,
  safeSetText,
  safeConfirm,
  sleep,
} from "./utils/utils";
import {
  BRANCH_KEY_TREE,
  CX_CLEAR,
  CX_SELECT_ALL,
  PROJECT_KEY_TREE,
  SCAN_KEY_TREE,
} from "./utils/constants";
import { CX_TEST_SCAN_BRANCH_NAME, CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";

describe("Wizard load results test", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await bench.executeCommand(CX_CLEAR);
    await bench.executeCommand(CX_SELECT_ALL);
    // Wait for command to complete and InputBox to be ready
    await sleep(2000);
  });

  after(async function () {
    this.timeout(10000); // Increase timeout for cleanup
    await new EditorView().closeAllEditors();
    await bench.executeCommand(CX_CLEAR);
    // Wizard command execution
  });

  it("should load results using wizard", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    // Project selection
    const inputProject = await waitForInputBoxReady(15000);
    let projectName = await getQuickPickSelector(inputProject);
    await safeConfirm(inputProject);

    // Branch selection
    const input = await waitForInputBoxReady(15000);
    await safeSetText(input, CX_TEST_SCAN_BRANCH_NAME);
    let branchName = await getQuickPickSelector(input);
    await safeSetText(input, branchName);
    await safeConfirm(input);

    // Scan selection
    const inputScan = await waitForInputBoxReady(15000);
    let scanDate = await getQuickPickSelector(inputScan);
    await quickPickSelector(inputScan);

    treeScans = await initialize();

    // Project tree item validation
    let project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
    expect(project).is.not.undefined;

    // Branch tree item validation
    let branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
    expect(branch).is.not.undefined;

    const scanDetailsparts: string[] = scanDate.split(" ");
    const formattedId: string = scanDetailsparts.slice(-2).join(" ");
    // Scan tree item validation
    let scan = await treeScans?.findItem(SCAN_KEY_TREE + formattedId);
    const maxAttempts = 30;
    let attempts = 0;
    while (scan === undefined && attempts < maxAttempts) {
      await new Promise((res) => setTimeout(res, 500));
      scan = await treeScans?.findItem(SCAN_KEY_TREE + formattedId);
      attempts++;
    }
    expect(scan).is.not.undefined;
  });
});
