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
  STEP_1,
  STEP_2,
  STEP_3,
} from "./utils/constants";
import { waitByLinkText } from "./utils/waiters";

describe("Wizard load results test", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await new Workbench().executeCommand(CX_SELECT_ALL);
  });

  after(async () => {
    await new EditorView().closeAllEditors();
    await bench.executeCommand(CX_CLEAR);
  });

  // it("should load results using wizard", async () => {
  //   // Wizard command execution
  //   await new Workbench().executeCommand(CX_SELECT_ALL);

  //   // Project selection
  //   const inputProject = await InputBox.create();
  //   await waitByLinkText(driver, STEP_1, 50000);
  //   await inputProject.setText("webgoat");
  //   await waitByLinkText(driver, "webgoat", 50000);
  //   let projectName = await getQuickPickSelector(inputProject);
  //   await inputProject.confirm();

  //   // Branch selection
  //   await waitByLinkText(driver, STEP_2, 50000);
  //   const inputBranch = new InputBox();
  //   let branchName = await getQuickPickSelector(inputBranch);
  //   await quickPickSelector(inputBranch);

  //   // Scan selection
  //   await waitByLinkText(driver, STEP_3, 50000);
  //   const inputScan = new InputBox();
  //   let scanDate = await getQuickPickSelector(inputScan);
  //   await quickPickSelector(inputScan);

  //   treeScans = await initialize();
  //   await waitByLinkText(driver, SCAN_KEY_TREE + scanDate, 50000);

  //   // Project tree item validation
  //   let project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
  //   while (project === undefined) {
  //     project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
  //   }
  //   expect(project).is.not.undefined;

  //   // Branch tree item validation
  //   let branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
  //   while (branch === undefined) {
  //     branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
  //   }
  //   expect(branch).is.not.undefined;

  //   // Scan tree item validation
  //   let scan = await treeScans?.findItem(SCAN_KEY_TREE + scanDate);
  //   while (scan === undefined) {
  //     scan = await treeScans?.findItem(SCAN_KEY_TREE + scanDate);
  //   }
  //   expect(scan).is.not.undefined;
  // });
});
