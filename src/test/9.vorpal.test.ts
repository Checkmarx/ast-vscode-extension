import { BottomBarPanel, EditorView, SettingsEditor, VSBrowser, WebDriver, Workbench } from "vscode-extension-tester";
import { expect } from "chai";
import { initialize } from "./utils/utils";
import { waitStatusBar } from "./utils/waiters";
import { CX_CATETORY, VS_OPEN_FOLDER } from "./utils/constants";
// import * as vscode from "vscode";
import path from "path";
import { isInstallVorpal, scanVorpalNum } from "../cx/cxMock";
import fs from "fs";


const testFileName = "testFile.txt";
describe("Vorpal engine tets", () => {
  let settingsEditor: SettingsEditor;
  let bench: Workbench;
  let driver: WebDriver;

  before(async function () {
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
    expect(vorpalCheckbox).to.not.be.undefined;
  });

  it("vorpal starts when the Vorpal checkbox is True in settings", async function () {
    const vorpalCheckbox = await setVorpalTrueInSettings();
    const vorpalCheckboxValue = await vorpalCheckbox.getValue();
    expect(vorpalCheckboxValue).to.equal("true");
    expect(isInstallVorpal).to.be.true;
  });
  
  it("vorpal starts when the apikey changes", async function () {});
  it("vorpal stops listening when Vorpal is False in settings", async function () {});
  it("vorpal scan is triggered when a file is edited", async function () {
    await setVorpalTrueInSettings();
    // Assuming there's a file named 'testFile.txt' in your workspace root
    // const testFileUri = vscode.Uri.file(testFileName);
    //  // Open the test file
    //  const document = await vscode.workspace.openTextDocument(testFileUri);
    //  await vscode.window.showTextDocument(document);
    //  const prevScanVorpalNum = scanVorpalNum;
    //  // Edit the file
    //  const edit = new vscode.WorkspaceEdit();
    //  edit.insert(testFileUri, new vscode.Position(0, 0), 'Hello, Vorpal!');
    //  await vscode.workspace.applyEdit(edit);
    //  expect(scanVorpalNum).to.be.greaterThan(prevScanVorpalNum);
     
  });
  it("vorpal scan is triggered when a file is opened", async function () {
    await setVorpalTrueInSettings();
    // Assuming there's a file named 'testFile.txt' in your workspace root
    // const testFileUri = vscode.Uri.file(testFileName);
    // const prevScamVorpalNum = scanVorpalNum; 
    // // Open the test file
    //  const document = await vscode.workspace.openTextDocument(testFileUri);
    //  await vscode.window.showTextDocument(document);
    //  expect(scanVorpalNum).to.be.greaterThan(prevScamVorpalNum);
  });
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
    await vorpalCheckbox.setValue("true");
    return vorpalCheckbox;
  }
});
