import { doesNotMatch } from 'assert';
import { expect } from 'chai';
import { Location, TextEdit } from 'vscode';
import { VSBrowser, Workbench, WebDriver, ComboSetting, LinkSetting, InputBox, SettingsEditor, Locators, By, WebView, Key, SideBarView, ActivityBar, ViewControl, WebElementPromise, WebElement, CustomTreeSection, CustomTreeItem, ViewItem, until, Locator, ViewSection} from 'vscode-extension-tester';
import { LocatorUtility } from './locator_utility';

describe('Check configuration settings', function () {
	let bench: Workbench;
	let driver: WebDriver;
	let webView: WebView;
	let settingsWizard:SettingsEditor;

    before( () => {
								this.timeout(5000);
        bench = new Workbench();
								driver = VSBrowser.instance.driver;
    });
				it('should open the settings with wrong key', async function () {
					this.timeout(80000);
					settingsWizard = await bench.openSettings();
					await delay(5000);
					const setting = await settingsWizard.findSetting("API KEY","Checkmarx AST") as LinkSetting;
					expect(setting).to.be.undefined;
	});

	it('should check if basic configurations exist', async function () {
			this.timeout(80000);
			const apiKey = await settingsWizard.findSetting("Api Key","Checkmarx AST");
			expect(await apiKey.getValue()).to.have.lengthOf.above(1);
			const baseURI = await settingsWizard.findSetting("Base-uri","Checkmarx AST");
			expect(await baseURI.getValue()).to.have.lengthOf.above(1);
			const tenant = await settingsWizard.findSetting("Tenant","Checkmarx AST");
			expect(await tenant.getValue()).to.have.lengthOf.above(1);
});

it('should open the checkmarx AST extension', async function () {
	this.timeout(80000);
	// await bench.executeCommand("Checkmarx AST: Focus on Projects View");
	// const section = await new SideBarView().getContent().getSection('Projects');
	const control:ViewControl|undefined = await new ActivityBar().getViewControl('Checkmarx AST');
	if(control !== undefined) {
	const view = await control.openView();
	await view.getDriver().wait(until.elementLocated(By.css('.monaco-list')), 10000);
	const contentPart = await new SideBarView().getContent().getSection('Projects') as ViewSection;
	contentPart.expand();
	const v = await contentPart.getAction("scanID");
	console.log(v);

	const web = await contentPart.findWelcomeContent();
	console.log(web);
	

 //const container = await bench.getDriver().wait(until.elementLocated(By.id(await contentPart.getAttribute('scanID'))), 5000);

	// const items = await contentPart.findItem("scanID");
	// const reference = await view.findElement(await new SideBarView().getContent().getSection('Projects') as CustomTreeSection);
	// const items = 	await view.getDriver().wait(until.elementLocated(By.css('.monaco-list')), 10000).then(val => {return val.findElement(By.name("ScanID"))});
	// console.log(contentPart);
	// const welcome = await contentPart.findElement(By.id("scanID"));
	//console.log(welcome);
	// const val = await webView.getAttribute("scanID");
	// const enterDataPluginNameInputBox = await driver.wait(() => new InputBox(), 1000);
 // const placeholderText1 = await enterDataPluginNameInputBox.getPlaceHolder();
 // await enterDataPluginNameInputBox.setText("out/test/");
 // await enterDataPluginNameInputBox.confirm();
	
	// const item:ViewItem | undefined = await projectsTab.findElements();
	// if (item !== undefined){
	// 	const children = item.select();
	// }
	
	}
	await delay(5000);
	
});
});

const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));