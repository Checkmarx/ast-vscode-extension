import {
  Workbench,
  EditorView,
  SettingsEditor,
  WebDriver,
  VSBrowser,
  BottomBarPanel,
} from "vscode-extension-tester";
import { expect } from "chai";
import { waitStatusBar } from "./utils/waiters";
 
describe("Vorpal engine tests", () => {
  let settingsEditor: SettingsEditor;
  let bench: Workbench;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
  });
 
  after(async () => {
    await new EditorView().closeAllEditors();
  });
 
  it("verify vorpal checkbox exists in the settings", async function () {
    await waitStatusBar();
    settingsEditor = await bench.openSettings();
    const vorpalCheckbox = await settingsEditor.findSetting(
      "ActivateVorpalAutoScanning",
      "Checkmarx Vorpal"
    );
    let vorpalCheckboxValue = await vorpalCheckbox.getValue();
    expect(vorpalCheckboxValue).to.not.be.undefined;
  });
 
  // it("vorpal starts when the Vorpal checkbox is True in settings", async function () {});
  // it("vorpal starts when the apikey changes", async function () {});
  // it("vorpal stops listening when Vorpal is False in settings", async function () {});
  // it("vorpal scan is triggered when a file is edited", async function () {});
  // it("vorpal scan is triggered when a file is opened", async function () {});
  // it("vorpal scan is not triggered when vorpal is False and the file is edited", async function () {});
  // it("vorpal scan with an unsupported language", async function () {});
  // it("try to install vorpal with no license", async function () {});
  // it("scan an unsecured file with Vorpal, fix the vulnerability, the problem disappeared", async function () {});
});