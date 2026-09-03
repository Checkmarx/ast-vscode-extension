import {
  Workbench,
  EditorView,
  SettingsEditor,
  WebDriver,
  LinkSetting,
  TextSetting,
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
  AI_SECURITY_CHAMPION_SETTINGS_CONSTANTS,
  OSS_REALTIME_SCANNER_CONSTANTS,
  SECRET_DETECTION_REALTIME_SCANNER_CONSTANTS,
  CONTAINERS_REALTIME_SCANNER_CONSTANTS,
  IAC_REALTIME_SCANNER_CONSTANTS,
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

  // TC94: Verifies the AI Security Champion Custom Model field keeps the last
  // value the user entered, even after the Settings editor is closed and reopened.
  it("should retain the last entered Custom Model value after reopening settings", async function () {
    this.timeout(30000);
    settingsEditor = await bench.openSettings();
    const customModelSetting = (await settingsEditor.findSetting(
      AI_SECURITY_CHAMPION_SETTINGS_CONSTANTS.customModelTitle,
      AI_SECURITY_CHAMPION_SETTINGS_CONSTANTS.customModelCategory
    )) as TextSetting;
    expect(customModelSetting, "Custom Model setting not found").to.not.be.undefined;

    const uniqueModelName = `automation-model-${Date.now()}`;
    await customModelSetting.setValue(uniqueModelName);

    // Reopen the Settings editor fresh, simulating the user leaving and returning.
    await new EditorView().closeAllEditors();
    settingsEditor = await bench.openSettings();
    const reopenedSetting = (await settingsEditor.findSetting(
      AI_SECURITY_CHAMPION_SETTINGS_CONSTANTS.customModelTitle,
      AI_SECURITY_CHAMPION_SETTINGS_CONSTANTS.customModelCategory
    )) as TextSetting;
    const persistedValue = await reopenedSetting.getValue();

    expect(persistedValue).to.equal(uniqueModelName);

    // Reset to default so this test doesn't leak state to later suites.
    await reopenedSetting.setValue("");
  });

  // Verifies the OSS-Realtime scanner checkbox exists and its value persists once set.
  it("verify OSS-Realtime scanning checkbox exists and persists when set to True", async function () {
    this.timeout(30000);
    settingsEditor = await bench.openSettings();
    const ossRealtimeCheckbox = await settingsEditor.findSetting(
      OSS_REALTIME_SCANNER_CONSTANTS.activateOssRealtimeScanner,
      OSS_REALTIME_SCANNER_CONSTANTS.ossRealtimeScanner
    );
    expect(ossRealtimeCheckbox, "OSS-Realtime checkbox not found").to.not.be.undefined;

    await ossRealtimeCheckbox.setValue(true);
    const ossRealtimeCheckboxValue = await ossRealtimeCheckbox.getValue();
    expect(ossRealtimeCheckboxValue).to.be.true;
  });

  // Verifies the Secret Detection Realtime scanner checkbox exists and its value persists once set.
  it("verify Secret Detection Realtime scanning checkbox exists and persists when set to True", async function () {
    this.timeout(30000);
    settingsEditor = await bench.openSettings();
    const secretRealtimeCheckbox = await settingsEditor.findSetting(
      SECRET_DETECTION_REALTIME_SCANNER_CONSTANTS.activateSecretDetectionRealtimeScanner,
      SECRET_DETECTION_REALTIME_SCANNER_CONSTANTS.secretDetectionRealtimeScanner
    );
    expect(secretRealtimeCheckbox, "Secret Detection Realtime checkbox not found").to.not.be.undefined;

    await secretRealtimeCheckbox.setValue(true);
    const secretRealtimeCheckboxValue = await secretRealtimeCheckbox.getValue();
    expect(secretRealtimeCheckboxValue).to.be.true;
  });

  // Verifies the Containers Realtime scanner checkbox exists and its value persists once set.
  it("verify Containers Realtime scanning checkbox exists and persists when set to True", async function () {
    this.timeout(30000);
    settingsEditor = await bench.openSettings();
    const containersRealtimeCheckbox = await settingsEditor.findSetting(
      CONTAINERS_REALTIME_SCANNER_CONSTANTS.activateContainersRealtimeScanner,
      CONTAINERS_REALTIME_SCANNER_CONSTANTS.containersRealtimeScanner
    );
    expect(containersRealtimeCheckbox, "Containers Realtime checkbox not found").to.not.be.undefined;

    await containersRealtimeCheckbox.setValue(true);
    const containersRealtimeCheckboxValue = await containersRealtimeCheckbox.getValue();
    expect(containersRealtimeCheckboxValue).to.be.true;
  });

  // Verifies the IAC Realtime scanner checkbox exists and its value persists once set.
  it("verify IAC Realtime scanning checkbox exists and persists when set to True", async function () {
    this.timeout(30000);
    settingsEditor = await bench.openSettings();
    const iacRealtimeCheckbox = await settingsEditor.findSetting(
      IAC_REALTIME_SCANNER_CONSTANTS.activateIacRealtimeScanner,
      IAC_REALTIME_SCANNER_CONSTANTS.iacRealtimeScanner
    );
    expect(iacRealtimeCheckbox, "IAC Realtime checkbox not found").to.not.be.undefined;

    await iacRealtimeCheckbox.setValue(true);
    const iacRealtimeCheckboxValue = await iacRealtimeCheckbox.getValue();
    expect(iacRealtimeCheckboxValue).to.be.true;
  });

  // Verifies the KICS real-time scanning setting can be toggled off and back on,
  // extending the existing "enabled by default" check with a full roundtrip.
  it("should toggle KICS real-time scanning off and back on", async function () {
    this.timeout(30000);
    settingsEditor = await bench.openSettings();
    const kicsSetting = (await settingsEditor.findSetting(
      CX_KICS_NAME,
      CX_KICS
    )) as LinkSetting;

    await kicsSetting.setValue(false);
    expect(await kicsSetting.getValue()).to.equal(false);

    await kicsSetting.setValue(true);
    expect(await kicsSetting.getValue()).to.equal(true);
  });
});
