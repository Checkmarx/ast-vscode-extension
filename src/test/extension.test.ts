import { doesNotMatch } from 'assert';
import { VSBrowser, Workbench, WebDriver } from 'vscode-extension-tester';
describe('Check configuration settings', function () {
	let bench: Workbench;
	let driver: WebDriver;

    before(() => {
        bench = new Workbench();
								driver = VSBrowser.instance.driver;
    });
				it('should open the settings', async function () {
					this.timeout(80000);
					const wizard = await bench.openSettings();
					await delay(15000);
					const setting = await wizard.findSetting("Checkmarx AST");
					await delay(5000);
					const apiKey = setting.getAttribute("API KEY");
					console.log(apiKey);
					console.log(setting);
					console.log(wizard);
	});
});

const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));
