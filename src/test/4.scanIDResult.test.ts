import {
  By,
  CustomTreeSection,
  EditorView,
  InputBox,
  StatusBar,
  until,
  VSBrowser,
  WebDriver,
  WebView,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  delay,
  getDetailsView,
  getQuickPickSelector,
  getResults,
  initialize,
  quickPickSelector,
} from "./utils";
import {
  CX_CLEAR,
  CX_LOOK_SCAN,
  CX_SELECT_ALL,
  CX_SELECT_BRANCH,
  CX_SELECT_PROJECT,
  CX_SELECT_SCAN,
  CX_TEST_SCAN_PROJECT_NAME,
  VS_CLOSE_GROUP_EDITOR,
  VS_OPEN_FOLDER,
} from "./constants";

describe("Scan ID load results test", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await bench.executeCommand(CX_LOOK_SCAN);
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  it("should load results from scan ID", async function () {
    await bench.executeCommand(CX_LOOK_SCAN);
    let input = await new InputBox();
    await input.setText(process.env.CX_TEST_SCAN_ID);
    await input.confirm();
    driver.wait(
      until.elementLocated(
        By.linkText("Scan:  " + process.env.CX_TEST_SCAN_ID)
      ),
      15000
    );
  });
});
