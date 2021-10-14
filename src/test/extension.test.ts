import { CxScanConfig } from '@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScanConfig';
import { doesNotMatch } from 'assert';
import { expect } from 'chai';
import { Location, TextEdit } from 'vscode';
import { VSBrowser, Workbench, WebDriver, ExtensionsViewItem ,ComboSetting, LinkSetting, InputBox, SettingsEditor, Locators, By, WebView, Key, SideBarView, ActivityBar, ViewControl, WebElementPromise, WebElement, CustomTreeSection, CustomTreeItem, ViewItem, until, Locator, ViewSection, DefaultTreeSection} from 'vscode-extension-tester';
import { LocatorUtility } from './locator_utility';

describe('Check configuration settings', function () {
	let bench: Workbench;
	let driver: WebDriver;
	let webView: WebView;
	let settingsWizard:SettingsEditor;
	let activityBar: ActivityBar;
	let scanConfig: CxScanConfig;
    before( () => {
								this.timeout(5000);
								scanConfig = new CxScanConfig();
							//	scanConfig = loadScanConfigObject();
        bench = new Workbench();
								webView = new WebView();
								driver = VSBrowser.instance.driver;
								activityBar = new ActivityBar();
    });
				it('should open the settings with wrong key', async function () {
					this.timeout(800000);
					settingsWizard = await bench.openSettings();
					await delay(5000);
					const setting = await settingsWizard.findSetting("API KEY","Checkmarx AST") as LinkSetting;
					expect(setting).to.be.undefined;
	});

	it('should check if basic configurations exist', async function () {
			this.timeout(800000);
			const apiKey = await (await settingsWizard.findSetting("Api Key","Checkmarx AST")).getValue();
			expect(apiKey).to.have.lengthOf.above(1);
			const baseURI = await settingsWizard.findSetting("Base-uri","Checkmarx AST");
			expect(await baseURI.getValue()).to.have.lengthOf.above(1);
			const tenant = await settingsWizard.findSetting("Tenant","Checkmarx AST");
			expect(await tenant.getValue()).to.have.lengthOf.above(1);
});

it('should open the checkmarx AST extension', async function () {
	this.timeout(800000);
	// await bench.executeCommand("Checkmarx AST: Focus on Projects View");
	// const section = await new SideBarView().getContent().getSection('Projects');
	const control:ViewControl|undefined = await activityBar.getViewControl('Checkmarx AST');
	if(control !== undefined) {
	const view = await control.openView();
	expect(view).is.not.undefined;
 expect(await view?.isDisplayed()).is.true;
	// await view.getDriver().wait(until.elementLocated(By.css('.monaco-list')), 10000);
	// const contentPart = await new SideBarView().getContent().getSection('Projects') as ViewSection;
	// contentPart.expand();
	// await VSBrowser.instance.waitForWorkbench();
	// //const container = await bench.getDriver().wait(until.elementLocated(By.id('webviewview-astprojectview')), 5000);
	// const w = await contentPart.findElement(By.name('webviewview-astprojectview'));
	// const inp = await InputBox.create();
	// await inp.selectQuickPick('scanID');
	// await inp.setText("testttt");
	// const v = await contentPart.getAction("scanID");
	// console.log(v);

	// const web = await contentPart.findWelcomeContent();
	// console.log(web);
	

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

it('should get scan ID and update the scanID label', async function () {
	this.timeout(800000);
	const ctrl: ViewControl| undefined= await activityBar.getViewControl('Checkmarx AST');
	//expect(ctrl).not.to.be.equal(undefined);
	if(ctrl !== undefined) {
		const view = await ctrl.openView();
	const extension: ViewSection = await view.getContent().getSection('Projects') as ViewSection;
	await extension.collapse();
	await extension.expand();
	//await driver.wait(until.elementsLocated(By.id("webview-webviewview-astprojectview")));
	await driver.wait(until.elementsLocated(By.name("webviewview-astprojectview")));
 await driver.switchTo().frame(await driver.findElement(By.name("webviewview-astprojectview")));
	await driver.wait(until.elementsLocated(By.id("active-frame")));
	await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
 const scanElement = await driver.findElement(By.id("scanID")).sendKeys("66fb5756-ce55-4ace-882a-5c9edc8688b0");

	driver.findElement(By.className("ast-search")).click();
	//await driver.switchTo().frame(await driver.findElement(By.className("ast-button")));
	// await driver.switchTo().activeElement();
	// const action = await extension.getActions();
	// console.log(action);
	
	//await driver.findElement(By.className("ast-search")).click();
	await delay(1000000);
											
            // console.log(await scanElement.getText());
												// scanElement.("kjashdfkjsd");
 // const elementx = await driver.findElement(By.id('webview-webviewview-astprojectview'));
	// console.log(await elementx.getAttribute('innerHTML'));
	
	// await webView.switchToFrame();
	// const element = await webView.findWebElement(By.id('scanID'))
	//await view.sendKeys(Key.DOWN,Key.ENTER);
	// await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
 // const elementx = await view.getDriver().findElement(By.id('scanID'));
	// console.log(elementx);
	const element: WebElement = await view.getDriver().findElement(By.tagName('body'));
		const a =await element.getAttribute("innerHTML");
		const b = await element.getAttribute("outerHTML");

		console.log(a);
		console.log(b);
	console.log(element);
	// const el = await extension.getVisibleItems();
	// console.log(el);
	// console.log(extension);
	const elements = await extension.findElements(By.partialLinkText('scanID'));
	for (const element of elements) {
	//	items.push(await new DefaultTreeItem(element, this).wait());
	console.log(element);
}
	}
	
});

});

const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));

// function loadScanConfigObject(): CxScanConfig {
	
// 	throw new Error('Function not implemented.');
// }
