import { Workbench, EditorView, WebView, By, SettingsEditor, WebDriver, LinkSetting, VSBrowser, ActivityBar, StatusBar, BottomBarPanel, until } from 'vscode-extension-tester';
import { expect } from 'chai';
import { CX_API_KEY_SETTINGS, CX_CATETORY } from './constants';

describe('Extension settings tests', () => {

	let settingsEditor: SettingsEditor;
	let bench: Workbench;
    let statusbar:StatusBar;
    let driver: WebDriver;

    before(async function() {
        this.timeout(8000);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;
        const bottomBar = new BottomBarPanel();
        await bottomBar.toggle(false);
    });

    after(async () => {
        await new EditorView().closeAllEditors();
    });
    
    it('open settings and check if are empty', async () => {
        statusbar = new StatusBar();
        let chekmarx = await statusbar.getItem('Checkmarx kics auto scan');
        while(chekmarx!==undefined){
            chekmarx = await statusbar.getItem('Checkmarx kics auto scan');
        }
        settingsEditor = await bench.openSettings();
        let settings = await settingsEditor.findSetting(CX_API_KEY_SETTINGS) as LinkSetting;
        expect(settings).to.be.undefined;
    });

    it("should set the settings and check if values are populated", async function () {
        settingsEditor = await bench.openSettings();
        const apiKeyVal = await settingsEditor.findSetting(
        CX_API_KEY_SETTINGS, CX_CATETORY
        );
        // Set setting value
        await apiKeyVal.setValue(process.env.CX_API_KEY);
        driver.wait(
			until.elementLocated(
		  By.linkText(
            process.env.CX_API_KEY
		  )
		),
		90000
	  );
        // Validate settings
        const apiKey = await apiKeyVal.getValue();
        expect(apiKey).to.equal(process.env.CX_API_KEY);
  });
});