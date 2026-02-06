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
  });

  after(async () => {
    await new EditorView().closeAllEditors();
    await bench.executeCommand(CX_CLEAR);
    // Wizard command execution
  });

  it("should load results using wizard", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    // Project selection
    const inputProject = await InputBox.create();
    // Add delay to ensure input box is ready
    await new Promise((res) => setTimeout(res, 1000));

    let projectName = await getQuickPickSelector(inputProject);
    await inputProject.confirm();

    // Branch selection
    const input = await InputBox.create();
    await new Promise((res) => setTimeout(res, 1000));
    await input.setText(CX_TEST_SCAN_BRANCH_NAME);
    let branchName = await getQuickPickSelector(input);
    await input.setText(branchName);
    await input.confirm();

    // Scan selection
    const inputScan = new InputBox();
    await new Promise((res) => setTimeout(res, 1000));
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
