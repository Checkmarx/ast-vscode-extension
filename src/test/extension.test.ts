// import { expect } from "chai";
// import {
//   VSBrowser,
//   Workbench,
//   WebDriver,
//   LinkSetting,
//   InputBox,
//   By,
//   until,
//   WebView,
//   BottomBarPanel,
//   TextEditor,
//   EditorView, ActivityBar, ViewControl
// } from "vscode-extension-tester";
// import {
//   initialize,
//   getQuickPickSelector,
//   delay,
//   getResults,
//   validateSeverities,
//   quickPickSelector,
//   getDetailsView,
//   validateNestedGroupBy,
//   validateRootNode,
// } from "./utils";
// import {
//   MAX_TIMEOUT,
//   THIRTY_SECONDS,
//   FIFTY_SECONDS,
//   FIVE_SECONDS,
//   THREE_SECONDS,
//   TWO_SECONDS,
//   CX_API_KEY,
//   VS_CLOSE_EDITOR,
//   VS_OPEN_FOLDER,
//   CX_SELECT_PROJECT,
//   CX_SELECT_BRANCH,
//   CX_SELECT_SCAN,
//   CX_LOOK_SCAN,
//   CX_NAME,
//   CX_FILTER_INFO,
//   CX_FILTER_LOW,
//   CX_FILTER_MEDIUM,
//   CX_FILTER_HIGH,
//   CX_CLEAR,
//   CX_SELECT_ALL,
//   CX_GROUP_FILE,
//   CX_GROUP_LANGUAGE,
//   CX_GROUP_STATUS,
//   VS_CLOSE_GROUP_EDITOR,
//   CX_FILTER_NOT_EXPLOITABLE,
//   CX_FILTER_PROPOSED_NOT_EXPLOITABLE,
//   CX_FILTER_CONFIRMED,
//   CX_FILTER_TO_VERIFY,
//   CX_FILTER_URGENT,
//   CX_FILTER_NOT_IGNORED,
//   CX_GROUP_STATE,
//   CX_GROUP_QUERY_NAME,
//   CX_KICS_NAME,
//   CX_KICS,
//   CX_KICS_VALUE,
//   CX_API_KEY_SETTINGS,
//   CX_CATETORY,
//   TEN_SECONDS, UUID_REGEX_VALIDATION, CX_TEST_SCAN_PROJECT_NAME,
// } from "./constants";
// import {YES} from "../utils/common/constants";

// describe("UI tests", async function () {
//   this.timeout(MAX_TIMEOUT);
//   let bench: Workbench;
//   let driver: WebDriver;
//   before(async () => {
//     this.timeout(MAX_TIMEOUT);
//     bench = new Workbench();
//     driver = VSBrowser.instance.driver;
//     await delay(THREE_SECONDS);
//   });
  












//   });



//   it("should check kics auto scan enablement on settings", async function () {
//     this.timeout(MAX_TIMEOUT);
//     await delay(THREE_SECONDS);
//     let settingsWizard = await bench.openSettings();
//     await delay(THREE_SECONDS);
//     const setting = (await settingsWizard.findSetting(
//       CX_KICS_NAME,
//       CX_KICS
//     )) as LinkSetting;
//     const enablement = await setting.getValue();
//     expect(enablement).to.equal(true);
//     await delay(FIVE_SECONDS);
//   });

//   it("should run kics auto scan", async function () {
//     this.timeout(MAX_TIMEOUT);
//     await delay(FIVE_SECONDS);

//     // Open file
//     const appender = process.platform === "win32" ? "\\" : "/";
//     let tempPath = __dirname + appender + "testProj";
//     tempPath += appender+"insecure.php";
//     VSBrowser.instance.openResources(tempPath);
//     await delay(FIVE_SECONDS);

//     // Check if scan is running or ran
//     const bottomBar = new BottomBarPanel();
//     await bottomBar.toggle(true);
//     const problemsView = await bottomBar.openOutputView();
//     await problemsView.clearText();
//     await delay(FIVE_SECONDS);

//     // Save the file
//     const editor = new TextEditor();
//     await delay(FIVE_SECONDS);
//     await editor.save();
//     await delay(FIVE_SECONDS);
//     const problemsText = await problemsView.getText();

//     // Check scan did ran
//     // it should not run against files so it should be empty
//     expect(problemsText).to.contain('\n');

//   });

//   it("should fail to run kics auto scan", async function () {
//     this.timeout(MAX_TIMEOUT);
//     await delay(FIVE_SECONDS);

//     // Disable settings
//     let settingsWizard = await bench.openSettings();
//     await delay(THREE_SECONDS);
//     const setting = (await settingsWizard.findSetting(
//       CX_KICS_NAME,
//       CX_KICS
//     )) as LinkSetting;
//     setting.setValue(false);

//     // Clear the output
//     const bottomBar = new BottomBarPanel();
//     await bottomBar.toggle(true);
//     const problemsView = await bottomBar.openOutputView();
//     await problemsView.clearText();
//     await delay(FIVE_SECONDS);

//     // Save the file
//     const editor = new TextEditor();
//     await delay(FIVE_SECONDS);
//     await editor.save();

//     // Check scan did not ran
//     await delay(FIVE_SECONDS);
//     const problemsText = await problemsView.getText();
//     expect(problemsText).to.not.contain(CX_KICS_VALUE);
//   });

// });
