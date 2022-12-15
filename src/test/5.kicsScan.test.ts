// import {
//   BottomBarPanel,
//   TextEditor,
//   VSBrowser,
//   WebDriver,
//   Workbench,
// } from "vscode-extension-tester";
// import { expect } from "chai";
// import { delay } from "./utils/utils";
// import { FIVE_SECONDS} from "./constants";

// describe("KICS auto scan test", () => {
//   let bench: Workbench;
//   let driver: WebDriver;

//   before(async function () {
//     this.timeout(100000);
//     bench = new Workbench();
//     driver = VSBrowser.instance.driver;
//   });

//   it("should run kics auto scan", async function () {
// 	await delay(FIVE_SECONDS);

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
// });
