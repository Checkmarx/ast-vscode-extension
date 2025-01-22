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
  CX_API_KEY_SETTINGS,
  CX_CATETORY,
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

const CxApiKey = process.env.CX_APIKEY;

describe("Combined Tests: Welcome View, Settings, Project, Branch, and Scan Selection", () => {
  let bench: Workbench;
  let settingsEditor: SettingsEditor;
  let treeScans: CustomTreeSection;

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

  describe("Extension settings tests", () => {
    before(async function () {
      this.timeout(8000);
      bench = new Workbench();

      const bottomBar = new BottomBarPanel();
      await bottomBar.toggle(false);
    });

    after(async () => {
      await new EditorView().closeAllEditors();
    });

    it("should set the settings and check if values are populated", async function () {
      this.timeout(100000);
      settingsEditor = await bench.openSettings();
      const apiKeyVal = await settingsEditor.findSetting(
        CX_API_KEY_SETTINGS,
        CX_CATETORY
      );

      expect(apiKeyVal).to.not.be.undefined;

      await apiKeyVal.setValue(CxApiKey);

      const apiKey = await apiKeyVal.getValue();
      expect(apiKey).to.equal(CxApiKey);
    });
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
