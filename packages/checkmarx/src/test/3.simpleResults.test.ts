import {
  CustomTreeSection,
  EditorView,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { getQuickPickSelector, initialize } from "./utils/utils";
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

describe("Individual pickers load results test", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await bench.executeCommand(CX_SELECT_SCAN);
  });

  after(async () => {
    await new EditorView().closeAllEditors();
    await bench.executeCommand(CX_CLEAR);
  });

  it("should select project", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    treeScans = await initialize();
    // Execute project selection command
    await bench.executeCommand(CX_SELECT_PROJECT);
    const input = await InputBox.create();
    // Add delay to ensure input box is ready
    await new Promise((res) => setTimeout(res, 1000));
    await input.setText(CX_TEST_SCAN_PROJECT_NAME);
    // Select from the pickers list
    let projectName = await getQuickPickSelector(input);
    await input.setText(projectName);
    await input.confirm();
    // Wait for project selection to be made
    let project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
    expect(project).is.not.undefined;
  });

  it("should select branch", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    let treeScans = await initialize();
    // Execute branch selection command
    await bench.executeCommand(CX_SELECT_BRANCH);
    let input = await InputBox.create();
    // Add delay to ensure input box is ready
    await new Promise((res) => setTimeout(res, 1000));
    // Select from the pickers list
    await input.setText(CX_TEST_SCAN_BRANCH_NAME);
    let branchName = await getQuickPickSelector(input);
    await input.setText(branchName);
    await input.confirm();
    // Wait for branch selection to be made
    let branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
    expect(branch).is.not.undefined;
  });

  it("should select scan", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    let treeScans = await initialize();
    // Execute scan selection command
    await bench.executeCommand(CX_SELECT_SCAN);
    let input = await InputBox.create();
    // Add delay to ensure input box is ready
    await new Promise((res) => setTimeout(res, 1000));
    // Select from the pickers list
    let scanDate = await getQuickPickSelector(input);
    await input.setText(scanDate);
    await input.confirm();
    // Wait for scan selection to be made
    const scanDetailsparts: string[] = scanDate.split(" ");
    const formattedId: string = scanDetailsparts.slice(-2).join(" ");
    let scan = await treeScans?.findItem(SCAN_KEY_TREE + formattedId);
    expect(scan).is.not.undefined;
  });
});
