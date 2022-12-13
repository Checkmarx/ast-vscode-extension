// import {
//   By,
//   CustomTreeSection,
//   EditorView,
//   InputBox,
//   StatusBar,
//   until,
//   VSBrowser,
//   WebDriver,
//   WebView,
//   Workbench,
// } from "vscode-extension-tester";
// import { expect } from "chai";
// import {
//   delay,
//   getDetailsView,
//   getQuickPickSelector,
//   getResults,
//   initialize,
//   quickPickSelector,
// } from "./utils";
// import {
//   CX_CLEAR,
//   CX_LOOK_SCAN,
//   CX_SELECT_ALL,
//   CX_SELECT_BRANCH,
//   CX_SELECT_PROJECT,
//   CX_SELECT_SCAN,
//   CX_TEST_SCAN_PROJECT_NAME,
//   VS_CLOSE_GROUP_EDITOR,
//   VS_OPEN_FOLDER,
// } from "./constants";

// describe("WebView results detail test", () => {
//   let bench: Workbench;
//   let treeScans: CustomTreeSection;
//   let driver: WebDriver;

//   before(async function () {
//     this.timeout(100000);
//     bench = new Workbench();
//     driver = VSBrowser.instance.driver;
//     treeScans = await initialize();
//   });

//   after(async () => {
//     await new EditorView().closeAllEditors();
//     await bench.executeCommand(CX_CLEAR);
//   });

 
// });
