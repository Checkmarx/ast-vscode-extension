import dotenv from "dotenv";
import {
  EditorView,
  Workbench,
  SettingsEditor,
  BottomBarPanel,
  CustomTreeSection,
} from "vscode-extension-tester";
import { expect } from "chai";
import { initialize } from "../test/utils/utils";
import {
  CX_CLEAR,
  CX_SELECT_PROJECT,
  CX_SELECT_BRANCH,
  CX_SELECT_SCAN,
  PROJECT_KEY_TREE,
  BRANCH_KEY_TREE,
} from "../test/utils/constants";
import {
  CX_TEST_PROJECT_NAME,
  CX_TEST_BRANCH_NAME,
  CX_TEST_SCAN_NAME,
} from "./utils/constants";

import {
  waitForElementToAppear,
  waitForInputBoxToOpen,
  selectItem,
} from "./utils/utils";
dotenv.config();


describe("Combined Tests: Welcome View, Settings, Project, Branch, and Scan Selection", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;

  before(async function () {
    this.timeout(15000);
    bench = new Workbench();
   // driver = VSBrowser.instance.driver;
    const bottomBar = new BottomBarPanel();
    // Hide the bottom bar to prevent interference with tests
    await bottomBar.toggle(false);

    // Inject a mock token into secrets before running tests using the new command
   await bench.executeCommand("ast-results.saveRealTokenTest");

    // Short delay to allow the extension state to update
    await new Promise((res) => setTimeout(res, 2000));
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  describe("Welcome view test", () => {
    before(async function () {
      this.timeout(100000);
      bench = new Workbench();
      await initialize();
    });

    after(async () => {
      await new EditorView().closeAllEditors();
    });

    it("open welcome view and check if exists", async function () {});
  });


  describe("Project, Branch, and Scan Selection Test", () => {
    before(async function () {
      this.timeout(100000);
      bench = new Workbench();

      await bench.executeCommand(CX_CLEAR);
    });

    it("should select project, branch, and scan", async function () {
      this.timeout(1500000);

      await bench.executeCommand(CX_SELECT_PROJECT);
      const projectInput = await waitForInputBoxToOpen();
      const projectName = await selectItem(projectInput, CX_TEST_PROJECT_NAME);

      await bench.executeCommand(CX_SELECT_BRANCH);
      const branchInput = await waitForInputBoxToOpen();
      const branchName = await selectItem(branchInput, CX_TEST_BRANCH_NAME);

      await bench.executeCommand(CX_SELECT_SCAN);
      const scanInput = await waitForInputBoxToOpen();
      await selectItem(scanInput, CX_TEST_SCAN_NAME);

      treeScans = await initialize();

      const project = await waitForElementToAppear(
        treeScans,
        PROJECT_KEY_TREE + projectName
      );
      expect(project).is.not.undefined;

      const branch = await waitForElementToAppear(
        treeScans,
        BRANCH_KEY_TREE + branchName
      );
      expect(branch).is.not.undefined;
    });
  });
});
