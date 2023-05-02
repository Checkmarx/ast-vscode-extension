import {
  Workbench,
  EditorView,
  By,
  SettingsEditor,
  WebDriver,
  LinkSetting,
  VSBrowser,
  BottomBarPanel,
  until,
} from "vscode-extension-tester";
import { expect } from "chai";
import { CX_API_KEY_SETTINGS, CX_CATETORY, CX_KICS, CX_KICS_NAME } from "./utils/constants";
import { waitByLinkText, waitStatusBar } from "./utils/waiters";
import { API_KEY } from "./utils/envs";

describe("Extension settings tests", () => {
  let settingsEditor: SettingsEditor;
  let bench: Workbench;
  let driver: WebDriver;

  before(async function () {
    this.timeout(8000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  it("open settings and check if are empty", async () => {
    await waitStatusBar();
    settingsEditor = await bench.openSettings();
    let settings = (await settingsEditor.findSetting(
      CX_API_KEY_SETTINGS
    )) as LinkSetting;
    expect(settings).to.be.undefined;
  });

  it("should set the settings and check if values are populated", async function () {
    settingsEditor = await bench.openSettings();
    const apiKeyVal = await settingsEditor.findSetting(
      CX_API_KEY_SETTINGS,
      CX_CATETORY
    );
    // Set setting value
    await apiKeyVal.setValue("myvalue");
    await waitByLinkText(driver,API_KEY,90000);
    // Validate settings
    const apiKey = await apiKeyVal.getValue();
    expect(apiKey).to.equal("myvalue");
  });

  it("should check kics auto scan enablement on settings", async function () {
    let settingsWizard = await bench.openSettings();
    const setting = (await settingsWizard.findSetting(
      CX_KICS_NAME,
      CX_KICS
    )) as LinkSetting;
    let enablement = await setting.getValue();
    expect(enablement).to.equal(true);
  });
});
