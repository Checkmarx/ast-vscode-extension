import {
  Workbench,
  EditorView,
  SettingsEditor,
  WebDriver,
  LinkSetting,
  VSBrowser,
  BottomBarPanel,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  CX_API_KEY_SETTINGS,
  CX_CATETORY,
  CX_KICS,
  CX_KICS_NAME,
} from "./utils/constants";
import { waitStatusBar } from "./utils/waiters";

import { constants } from "../utils/common/constants";

describe("Extension settings tests", () => {
  let settingsEditor: SettingsEditor;
  let bench: Workbench;
  let driver: WebDriver;

  before(async function () {
    this.timeout(15000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    const bottomBar = new BottomBarPanel();
    // Hide the bottom bar to prevent interference with tests
    await bottomBar.toggle(false);

    // Inject a mock token into secrets before running tests using the new command
    await bench.executeCommand("ast-results.mockTokenTest");
    // Short delay to allow the extension state to update
    await new Promise((res) => setTimeout(res, 2000));
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  it("open settings and check if are empty", async () => {
    await waitStatusBar();
    settingsEditor = await bench.openSettings();
    const settings = (await settingsEditor.findSetting(
      "fake setting"
    )) as LinkSetting;
    expect(settings).to.be.undefined;
  });

  it("should check kics real-time scan enablement on settings", async function () {
    const settingsWizard = await bench.openSettings();
    const setting = (await settingsWizard.findSetting(
      CX_KICS_NAME,
      CX_KICS
    )) as LinkSetting;
    const enablement = await setting.getValue();
    expect(enablement).to.equal(true);
  });

  it("verify ASCA realtime scanning checkbox exists in the settings", async function () {
    settingsEditor = await bench.openSettings();
    const ascaRealtimeCheckbox = await settingsEditor.findSetting(
      constants.activateAscaRealtimeScanner,
      constants.ascaRealtimeScanner
    );
    let ascaRealtimeCheckboxValue = await ascaRealtimeCheckbox.getValue();
    expect(ascaRealtimeCheckboxValue).to.not.be.undefined;
  });

  it("ASCA realtime scanning starts when the checkbox is True in settings", async function () {
    settingsEditor = await bench.openSettings();
    const ascaRealtimeCheckbox = await settingsEditor.findSetting(
      constants.activateAscaRealtimeScanner,
      constants.ascaRealtimeScanner
    );
    await ascaRealtimeCheckbox.setValue(true);
    let ascaRealtimeCheckboxValue = await ascaRealtimeCheckbox.getValue();
    expect(ascaRealtimeCheckboxValue).to.be.true;
  });
});
