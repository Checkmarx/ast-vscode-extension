import {
  By,
  CustomTreeSection,
  EditorView,
  InputBox,
  until,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import sinon from 'sinon';
import { expect } from "chai";
// import {getProjectList} from "../utils/ast/ast";
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
import { waitByLinkText } from "./utils/waiters";
import { CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";

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
    treeScans = await initialize();
    // Execute project selection command
    await bench.executeCommand(CX_SELECT_PROJECT);
    let input = await InputBox.create();
    await input.setText(CX_TEST_SCAN_PROJECT_NAME);
    await waitByLinkText(driver, CX_TEST_SCAN_PROJECT_NAME, 5000);
    // Select from the pickers list
    let projectName = await getQuickPickSelector(input);
    await input.setText(projectName);
    await input.confirm();
    // Wait for project selection to be made
    let project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
    while (project === undefined) {
      project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
    }
    expect(project).is.not.undefined;
  });

  it("should select branch", async function () {
    let treeScans = await initialize();
    // Execute branch selection command
    await bench.executeCommand(CX_SELECT_BRANCH);
    let input = await InputBox.create();
    // Select from the pickers list
    let branchName = await getQuickPickSelector(input);
    await input.setText(branchName);
    await waitByLinkText(driver, branchName, 5000);
    await input.confirm();
    // Wait for branch selection to be made
    let branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
    while (branch === undefined) {
      branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
    }
    expect(branch).is.not.undefined;
  });

  it("should select scan", async function () {
    let treeScans = await initialize();
    // Execute scan selection command
    await bench.executeCommand(CX_SELECT_SCAN);
    let input = await InputBox.create();
    // Select from the pickers list
    let scanDate = await getQuickPickSelector(input);
    await input.setText(scanDate);
    await waitByLinkText(driver, scanDate, 5000);
    await input.confirm();
    // Wait for scan selection to be made
    let scan = await treeScans?.findItem(SCAN_KEY_TREE + scanDate);
    while (scan === undefined) {
      scan = await treeScans?.findItem(SCAN_KEY_TREE + scanDate);
    }
    expect(scan).is.not.undefined;
  });
});
