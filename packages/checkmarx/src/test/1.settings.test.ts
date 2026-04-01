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
  ASCA_REALTIME_SCANNER_CONSTANTS,
} from "./utils/constants";
import { loginWithMockToken, logoutIfVisible } from "./utils/utils";
import { waitStatusBar } from "./utils/waiters";

describe("Extension settings tests", () => {
  let settingsEditor: SettingsEditor;
  let bench: Workbench;
  let driver: WebDriver;

  // Hides the bottom bar and injects a mock token before any test runs.
  before(async function () {
    this.timeout(15000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    const bottomBar = new BottomBarPanel();
    // Hide the bottom bar to prevent interference with settings UI tests.
    await bottomBar.toggle(false);
    await loginWithMockToken(bench);
  });

  // Logs out and closes editors so settings state does not leak to later suites.
  after(async function () {
    this.timeout(60000);
    try {
      await logoutIfVisible(bench, driver);
    } catch {
      // Keep teardown resilient so tests don't fail on cleanup edge-cases.
    }
    await new EditorView().closeAllEditors();
  });

  // Confirms that a non-existent setting key returns undefined.
  it("open settings and check if are empty", async function () {
    this.timeout(30000);
    await waitStatusBar();
    settingsEditor = await bench.openSettings();
    const settings = (await settingsEditor.findSetting(
      "fake setting"
    )) as LinkSetting;
    expect(settings).to.be.undefined;
  });

  // Verifies the KICS real-time scanner setting is enabled by default.
  it("should check kics real-time scan enablement on settings", async function () {
    this.timeout(30000);
    const settingsWizard = await bench.openSettings();
    const setting = (await settingsWizard.findSetting(
      CX_KICS_NAME,
      CX_KICS
    )) as LinkSetting;
    const enablement = await setting.getValue();
    expect(enablement).to.equal(true);
  });

  // Verifies the ASCA realtime scanner checkbox is present in settings.
  it("verify ASCA realtime scanning checkbox exists in the settings", async function () {
    this.timeout(30000);
    settingsEditor = await bench.openSettings();
    const ascaRealtimeCheckbox = await settingsEditor.findSetting(
      ASCA_REALTIME_SCANNER_CONSTANTS.activateAscaRealtimeScanner,
      ASCA_REALTIME_SCANNER_CONSTANTS.ascaRealtimeScanner
    );
    let ascaRealtimeCheckboxValue = await ascaRealtimeCheckbox.getValue();
    expect(ascaRealtimeCheckboxValue).to.not.be.undefined;
  });

  // Verifies the ASCA checkbox can be set to true and retains its value.
  it("ASCA realtime scanning starts when the checkbox is True in settings", async function () {
    this.timeout(30000);
    settingsEditor = await bench.openSettings();
    const ascaRealtimeCheckbox = await settingsEditor.findSetting(
      ASCA_REALTIME_SCANNER_CONSTANTS.activateAscaRealtimeScanner,
      ASCA_REALTIME_SCANNER_CONSTANTS.ascaRealtimeScanner
    );
    await ascaRealtimeCheckbox.setValue(true);
    let ascaRealtimeCheckboxValue = await ascaRealtimeCheckbox.getValue();
    expect(ascaRealtimeCheckboxValue).to.be.true;
  });
});
