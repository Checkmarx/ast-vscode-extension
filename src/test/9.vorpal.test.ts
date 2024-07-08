import { EditorView, SettingsEditor, Workbench } from "vscode-extension-tester";
import { expect } from "chai";
import { initialize } from "./utils/utils";

describe("Vorpal engine tets", () => {
  let settingsEditor: SettingsEditor;
  let bench: Workbench;

  before(async function () {
    this.timeout(8000);
    bench = new Workbench();
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  it("verify vorpal toggle exists in the settings", async function () {
    settingsEditor = await bench.openSettings();
    const vorpalToggle = await settingsEditor.findSetting(
      "Activate Vorpal Auto Scanning",
      "CheckmarxVorpal"
    );
    expect(vorpalToggle).to.not.be.undefined;
  });
  it("vorpal starts when the Vorpal is turned on in settings", async function () {});
  it("vorpal starts when the apikey changes", async function () {});
  it("vorpal stops listening when Vorpal is turned off in settings", async function () {});
  it("vorpal scan is triggered when a file is edited", async function () {});
  it("vorpal scan is not triggered when vorpal is turned off and the file is edited", async function () {});
  it("vorpal scan with an unsupported language", async function () {});
  it("try to install vorpal with no license", async function () {});
  it("scan an unsecured file with Vorpal, fix the vulnerability, the problem disappeared", async function () {});

});
