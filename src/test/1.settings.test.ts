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
        await apiKeyVal.setValue("eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI0N2Y1NDZlNS02YjFlLTQ0NjgtOGM0Yi0zNjdmNDcwNzMxZTYifQ.eyJpYXQiOjE2NjkyMjc5MjcsImp0aSI6ImVhNThiYjhhLTI2ZDYtNGU4ZC1hZWVmLTdjZTVmMTBiYTk3YiIsImlzcyI6Imh0dHBzOi8vZGV1LmlhbS5jaGVja21hcngubmV0L2F1dGgvcmVhbG1zL2N4X2FzdF9yZF9nYWxhdGljYV9jYW5hcnkiLCJhdWQiOiJodHRwczovL2RldS5pYW0uY2hlY2ttYXJ4Lm5ldC9hdXRoL3JlYWxtcy9jeF9hc3RfcmRfZ2FsYXRpY2FfY2FuYXJ5Iiwic3ViIjoiOWY1YTExZjMtNjE0NS00MjZkLWI4MTktNTg0ZjcwYzYyMTlmIiwidHlwIjoiT2ZmbGluZSIsImF6cCI6ImFzdC1hcHAiLCJzZXNzaW9uX3N0YXRlIjoiN2MzOTNjMGQtNWY3ZC00N2U1LWJhNWItMTQ0YTM1ZDMzYmVhIiwic2NvcGUiOiIgb2ZmbGluZV9hY2Nlc3MiLCJzaWQiOiI3YzM5M2MwZC01ZjdkLTQ3ZTUtYmE1Yi0xNDRhMzVkMzNiZWEifQ.d2ClaxjllvyKtTMZBxRweRxmJLdfKWEVtvBbEPozEkc" + "");
        driver.wait(
			until.elementLocated(
		  By.linkText(
			"eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI0N2Y1NDZlNS02YjFlLTQ0NjgtOGM0Yi0zNjdmNDcwNzMxZTYifQ.eyJpYXQiOjE2NjkyMjc5MjcsImp0aSI6ImVhNThiYjhhLTI2ZDYtNGU4ZC1hZWVmLTdjZTVmMTBiYTk3YiIsImlzcyI6Imh0dHBzOi8vZGV1LmlhbS5jaGVja21hcngubmV0L2F1dGgvcmVhbG1zL2N4X2FzdF9yZF9nYWxhdGljYV9jYW5hcnkiLCJhdWQiOiJodHRwczovL2RldS5pYW0uY2hlY2ttYXJ4Lm5ldC9hdXRoL3JlYWxtcy9jeF9hc3RfcmRfZ2FsYXRpY2FfY2FuYXJ5Iiwic3ViIjoiOWY1YTExZjMtNjE0NS00MjZkLWI4MTktNTg0ZjcwYzYyMTlmIiwidHlwIjoiT2ZmbGluZSIsImF6cCI6ImFzdC1hcHAiLCJzZXNzaW9uX3N0YXRlIjoiN2MzOTNjMGQtNWY3ZC00N2U1LWJhNWItMTQ0YTM1ZDMzYmVhIiwic2NvcGUiOiIgb2ZmbGluZV9hY2Nlc3MiLCJzaWQiOiI3YzM5M2MwZC01ZjdkLTQ3ZTUtYmE1Yi0xNDRhMzVkMzNiZWEifQ.d2ClaxjllvyKtTMZBxRweRxmJLdfKWEVtvBbEPozEkc" + ""
		  )
		),
		90000
	  );
        // Validate settings
        const apiKey = await apiKeyVal.getValue();
        expect(apiKey).to.equal("eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI0N2Y1NDZlNS02YjFlLTQ0NjgtOGM0Yi0zNjdmNDcwNzMxZTYifQ.eyJpYXQiOjE2NjkyMjc5MjcsImp0aSI6ImVhNThiYjhhLTI2ZDYtNGU4ZC1hZWVmLTdjZTVmMTBiYTk3YiIsImlzcyI6Imh0dHBzOi8vZGV1LmlhbS5jaGVja21hcngubmV0L2F1dGgvcmVhbG1zL2N4X2FzdF9yZF9nYWxhdGljYV9jYW5hcnkiLCJhdWQiOiJodHRwczovL2RldS5pYW0uY2hlY2ttYXJ4Lm5ldC9hdXRoL3JlYWxtcy9jeF9hc3RfcmRfZ2FsYXRpY2FfY2FuYXJ5Iiwic3ViIjoiOWY1YTExZjMtNjE0NS00MjZkLWI4MTktNTg0ZjcwYzYyMTlmIiwidHlwIjoiT2ZmbGluZSIsImF6cCI6ImFzdC1hcHAiLCJzZXNzaW9uX3N0YXRlIjoiN2MzOTNjMGQtNWY3ZC00N2U1LWJhNWItMTQ0YTM1ZDMzYmVhIiwic2NvcGUiOiIgb2ZmbGluZV9hY2Nlc3MiLCJzaWQiOiI3YzM5M2MwZC01ZjdkLTQ3ZTUtYmE1Yi0xNDRhMzVkMzNiZWEifQ.d2ClaxjllvyKtTMZBxRweRxmJLdfKWEVtvBbEPozEkc" + "");
  });
});