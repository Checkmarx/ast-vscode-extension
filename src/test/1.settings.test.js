"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
const constants_1 = require("./utils/constants");
const waiters_1 = require("./utils/waiters");
const envs_1 = require("./utils/envs");
describe("Extension settings tests", () => {
    let settingsEditor;
    let bench;
    let driver;
    before(async function () {
        this.timeout(8000);
        bench = new vscode_extension_tester_1.Workbench();
        driver = vscode_extension_tester_1.VSBrowser.instance.driver;
        const bottomBar = new vscode_extension_tester_1.BottomBarPanel();
        await bottomBar.toggle(false);
    });
    after(async () => {
        await new vscode_extension_tester_1.EditorView().closeAllEditors();
    });
    it("open settings and check if are empty", async () => {
        await (0, waiters_1.waitStatusBar)();
        settingsEditor = await bench.openSettings();
        const settings = (await settingsEditor.findSetting(constants_1.CX_API_KEY_SETTINGS));
        (0, chai_1.expect)(settings).to.be.undefined;
    });
    it("should set the settings and check if values are populated", async function () {
        settingsEditor = await bench.openSettings();
        const apiKeyVal = await settingsEditor.findSetting(constants_1.CX_API_KEY_SETTINGS, constants_1.CX_CATETORY);
        // Set setting value
        await apiKeyVal.setValue(envs_1.API_KEY);
        await (0, waiters_1.waitByLinkText)(driver, envs_1.API_KEY, 90000);
        // Validate settings
        const apiKey = await apiKeyVal.getValue();
        (0, chai_1.expect)(apiKey).to.equal(envs_1.API_KEY);
    });
    it("should check kics auto scan enablement on settings", async function () {
        const settingsWizard = await bench.openSettings();
        const setting = (await settingsWizard.findSetting(constants_1.CX_KICS_NAME, constants_1.CX_KICS));
        const enablement = await setting.getValue();
        (0, chai_1.expect)(enablement).to.equal(true);
    });
});
//# sourceMappingURL=1.settings.test.js.map