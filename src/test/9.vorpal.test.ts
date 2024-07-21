import { BottomBarPanel, EditorView, SettingsEditor, VSBrowser, WebDriver, Workbench, TextEditor } from "vscode-extension-tester";
import { expect } from "chai";
import { waitStatusBar } from "./utils/waiters";
 
 
import { promises as fsPromises } from 'fs';
import * as utils from "../test/utils/utils";
 
import path from "path";
import fs from "fs";
 
 
const testFileName = path.join(process.cwd(), "src", "test", "testFile.txt");
describe("Vorpal engine tests", () => {
  let settingsEditor: SettingsEditor;
  let bench: Workbench;
  let driver: WebDriver;
 
  before(async function () {
    // fs.unlinkSync(testFileName)
    this.timeout(8000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
    fs.writeFileSync(testFileName, "");
  });
 
  after(async () => {
    await new EditorView().closeAllEditors();
    // Delete the test file
    fs.unlinkSync(testFileName)
  });
 
  it("verify vorpal checkbox exists in the settings", async function () {
    await waitStatusBar();
    settingsEditor = await bench.openSettings();
    const vorpalCheckbox = await settingsEditor.findSetting(
      "Activate Vorpal Auto Scanning",
      "Checkmarx Vorpal"
    );
    let vorpalCheckboxValue = await vorpalCheckbox.getValue();
    expect(vorpalCheckboxValue).to.not.be.undefined;
  });
 
  it("vorpal starts when the Vorpal checkbox is True in settings", async function () {
    settingsEditor = await bench.openSettings();
    const vorpalCheckbox = await setVorpalTrueInSettings(); 
    let vorpalCheckboxValue = await vorpalCheckbox.getValue();
    expect(vorpalCheckboxValue).to.be.true;
    await sleep(3000);
    // utils.changeVorpalStatus(true);
    expect(utils.isInstallVorpal).to.be.true;
  });
 
  // it("vorpal starts when the apikey changes", async function () {});
  // it("vorpal stops listening when Vorpal is False in settings", async function () {});
 
 
 
  it("vorpal scan is triggered when a file is edited", async function () {
    await setVorpalTrueInSettings();
 
    const prevScanVorpalNum = utils.scanVorpalNum;
 
    await writeToFile(testFileName, "Hello, Vorpal!");
    // utils.increaseScanVorpalNum();
    await sleep(5000);
 
    expect(utils.scanVorpalNum).to.be.greaterThan(prevScanVorpalNum);
    expect(utils.isInstallVorpal).to.be.true;
 
    // Close the editor to clean up
    // await new Workbench().executeCommand('workbench.action.closeActiveEditor');
    await bench.executeCommand('workbench.action.closeActiveEditor');
      fs.unlinkSync(testFileName)
  });
 
 
 
    // it("vorpal scan is triggered when a file is opened", async function () {
    //   await setVorpalTrueInSettings();
    //   // Assuming there's a file named 'testFile.txt' in your workspace root
    //   const testFileUri = vscode.Uri.file(testFileName);
    //   const prevScamVorpalNum = scanVorpalNum;
    //   // Open the test file
    //    const document = await vscode.workspace.openTextDocument(testFileUri);
    //    await vscode.window.showTextDocument(document);
    //    expect(scanVorpalNum).to.be.greaterThan(prevScamVorpalNum);
    // });
    it("vorpal scan is not triggered when vorpal is False and the file is edited", async function () {});
    it("vorpal scan with an unsupported language", async function () {});
    it("try to install vorpal with no license", async function () {});
    it("scan an unsecured file with Vorpal, fix the vulnerability, the problem disappeared", async function () {});
   
 
    async function setVorpalTrueInSettings() {
      settingsEditor = await bench.openSettings();
      const vorpalCheckbox = await settingsEditor.findSetting(
        "Activate Vorpal Auto Scanning",
        "CheckmarxVorpal"
      );
      if (vorpalCheckbox === null) {
        throw new Error("Vorpal checkbox not found in settings");
      }
      console.log("before change the setting: " + await vorpalCheckbox.getValue());
      await vorpalCheckbox.setValue(true);
      console.log("after change the setting: " + await vorpalCheckbox.getValue());
      return vorpalCheckbox;
    }
  });
 
 
 
  async function writeToFile(filename: string, content: string): Promise<void> {
    // return fs.writeFile(filename, content, (err) => {
    //     if (err) {
    //         console.error('An error occurred:', err);
    //     } else {
    //         console.log('File written successfully');
    //     }
    // });
    try {
      await fsPromises.writeFile(filename, content);
      console.log('File written successfully');
    } catch (err) {
        console.error('An error occurred:', err);
    }
  }
 
  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
 
 

 