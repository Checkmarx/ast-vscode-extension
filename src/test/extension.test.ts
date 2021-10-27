import { CxScanConfig } from '@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScanConfig';
import { doesNotMatch } from 'assert';
import { expect } from 'chai';
import path = require('path');
import { Location, TextEdit } from 'vscode';
import { VSBrowser, Workbench, WebDriver, ExtensionsViewItem, ComboSetting, LinkSetting, InputBox, SettingsEditor, Locators, By, WebView, Key, SideBarView, ActivityBar, ViewControl, WebElementPromise, WebElement, CustomTreeSection, CustomTreeItem, ViewItem, until, Locator, ViewSection, DefaultTreeSection, BottomBarPanel, TitleBar, EditorView, ModalDialog, ExtensionsViewSection, MarkerType } from 'vscode-extension-tester';
describe('Check basic test cases', async function () {
	let bench: Workbench;
	let driver: WebDriver;
	let settingsWizard: SettingsEditor;
	let activityBar: ActivityBar;
	let editorView: EditorView;

	before(async () => {
		this.timeout(100000);
		bench = new Workbench();
		driver = VSBrowser.instance.driver;
		activityBar = new ActivityBar();
		editorView = new EditorView();
	});



	it('should open the settings and validate the wrong Key', async function () {
		this.timeout(80000);
		settingsWizard = await bench.openSettings();
		await delay(5000);
		const setting = await settingsWizard.findSetting("API KEY", "Checkmarx AST") as LinkSetting;
		expect(setting).to.be.undefined;
		await delay(10000);
	});


	it('should set the settings and check if values populated', async function () {
		this.timeout(80000);
		const apiKeyVal = await (await settingsWizard.findSetting("Api Key", "Checkmarx AST"));
		await apiKeyVal.setValue(process.env.CX_API_KEY + "");
		const baseUriVal = await (await settingsWizard.findSetting("Base-uri", "Checkmarx AST"));
		await baseUriVal.setValue(process.env.CX_BASE_URI + "");
		const tenantVal = await (await settingsWizard.findSetting("Tenant", "Checkmarx AST"));
		await tenantVal.setValue(process.env.CX_TENANT + "");
		await delay(5000);
		const apiKey = await (await settingsWizard.findSetting("Api Key", "Checkmarx AST")).getValue();
		expect(apiKey).to.equal(process.env.CX_API_KEY + "");
		await delay(2000);
		const baseURI = await settingsWizard.findSetting("Base-uri", "Checkmarx AST");
		expect(await baseURI.getValue()).to.equal(process.env.CX_BASE_URI + "");
		await delay(2000);
		const tenant = await settingsWizard.findSetting("Tenant", "Checkmarx AST");
		expect(await tenant.getValue()).to.equal(process.env.CX_TENANT + "");
		await delay(5000);
	});

	it("should open the test repo", async function () {
		this.timeout(80000);
		await bench.executeCommand("File: Open Folder...");
		//await new TitleBar().select('File', 'Open Folder...');
		const input = await InputBox.create();
		console.log("OS: ") + process.platform;
		const appender = process.platform === 'win32' ? '\\' : '/';
		const tempPath = __dirname + appender + "testProj";
		console.log(tempPath);
		await (await input).setText(tempPath);
		await (await input).confirm();
		expect(tempPath).to.have.lengthOf.above(1);
		await delay(10000);

	});


	it('should open the checkmarx AST extension', async function () {
		this.timeout(80000);
		const control: ViewControl | undefined = await new ActivityBar().getViewControl('Checkmarx AST');
		if (control !== undefined) {
			const view = await control.openView();
			await delay(5000);
			expect(view).is.not.undefined;
			expect(await view?.isDisplayed()).is.true;
		}
		await delay(10000);

	});

	it('should get scan ID and update the scanID label and load results', async function () {
		this.timeout(80000);
		const ctrl: ViewControl | undefined = await new ActivityBar().getViewControl('Checkmarx AST');
		if (ctrl !== undefined) {
			const view = await ctrl.openView();
			const extension: ViewSection = await view.getContent().getSection('Projects') as ViewSection;
			expect(extension).is.not.undefined;
			await extension.collapse();
			await extension.expand();
			await driver.wait(until.elementsLocated(By.name("webviewview-astprojectview")));
			await driver.switchTo().frame(await driver.findElement(By.name("webviewview-astprojectview")));
			await driver.wait(until.elementsLocated(By.id("active-frame")));
			await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
			// get scan_id from env variable and also load the code 
			const testScanID = process.env.CX_TEST_SCAN_ID ? process.env.CX_TEST_SCAN_ID : "";
			//const testScanID = DEFAULT_SCAN_ID;
			console.log("Test scan id: " + testScanID);
			expect(testScanID).to.have.length.greaterThan(0);
			const scanElement = await driver.findElement(By.id("scanID")).sendKeys(testScanID);
			driver.findElement(By.className("ast-search")).click();
			await driver.switchTo().defaultContent();
			await delay(10000);
		}

	});

	it('should open the loaded results and traverse the tree items', async function () {
		this.timeout(80000);
		const ctrl: ViewControl | undefined = await new ActivityBar().getViewControl('Checkmarx AST');
		const view = await ctrl?.openView();
		const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
		const tree = await results.isExpanded();
		const treeNodes = await results.getVisibleItems();
		treeNodes.forEach(async (node: { getLabel: () => any; expand: () => any; }) => {
			const indNode = (await node.getLabel());
			//expect(indNode).to.have.members(["sast","dependency","infrastructure"]);
			expect(indNode).to.have.length.greaterThan(0);
			await node.expand();
		});
		await delay(5000);
	});

	it('should check the individual nodes for status filters', async function () {
		this.timeout(100000);
		const ctrl: ViewControl | undefined = await new ActivityBar().getViewControl('Checkmarx AST');
		const view = await ctrl?.openView();
		const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
		await delay(5000);
		if (await results.isDisplayed() && !await results.isExpanded()) {
			await results.expand();
			await delay(5000);
		}
		expect(results).not.be.undefined;
		//await results.expand();
		await delay(5000);
		await bench.executeCommand("Checkmarx AST: Focus on Results View");
		await delay(5000);
		await bench.executeCommand("Checkmarx AST: Group By: Status");
		await delay(5000);
		const node = await results.getVisibleItems();
		node.forEach(async (indNode: { expand: () => any; getChildren: () => any; }) => {
			await indNode.expand();
			await delay(3000);
			const indResult = await indNode.getChildren();
			indResult.forEach(async (ind: { getLabel: () => any; }) => {
				const childLabel = await ind.getLabel();
				expect(childLabel).to.have.length.greaterThan(0);
				await delay(3000);
			});
		});
		await delay(10000);
	});

	it("should filter the results based on severity",async function () {
		this.timeout(80000);
		await bench.executeCommand("Checkmarx AST: Group By: Severity");
		await delay(5000);
		const ctrl: ViewControl | undefined = await new ActivityBar().getViewControl('Checkmarx AST');
		const view = await ctrl?.openView();
		await delay(5000);
		const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
		await delay(5000);
		const severityNode = await results.getVisibleItems();
		severityNode.forEach(async (indNode: { expand: () => any; getChildren: () => any; getLabel: () => any; }) => {
			await indNode.expand();
			const indResult = await indNode.getChildren();
			const label = await indNode.getLabel();
			indResult.forEach(async (ind: { getLabel: () => any; }) => {
				const childLabel = await ind.getLabel();
				expect(childLabel).to.have.length.greaterThan(0);
				await delay(3000);
			});
		});
		await delay(10000);
	});

	it('should open individual filter and underlying tree items', async function () {
		this.timeout(80000);
		const ctrl: ViewControl | undefined = await new ActivityBar().getViewControl('Checkmarx AST');
		const view = await ctrl?.openView();
		const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
		expect(results).not.be.undefined;
		if (!await results.isExpanded()) {
			await results.expand();
		}
		const scaNodes = await results.getVisibleItems().then((async (items: any[]) => {
			await items.forEach(async (item) => {
				await item.expand();
				expect(item).to.have.length.greaterThan(0);
				await delay(2000);
			});

			await delay(10000);
		}));
	});

	it('should select vulnerability and make sure detail view is populated', async function () {
		this.timeout(100000);
		const ctrl: ViewControl | undefined = await new ActivityBar().getViewControl('Checkmarx AST');
		const view = await ctrl?.openView();
		const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
		expect(results).not.be.undefined;
		if (!await results.isExpanded()) {
			await results.expand();
		}
		const sastNode = await results.getVisibleItems();
		sastNode.forEach(async (node: { isExpandable: () => any; isExpanded: () => any; expand: () => any; getLabel: () => any; }) => {
			if (await node.isExpandable() && !await node.isExpanded()) {
				await node.expand();
			}
			const labelName = await node.getLabel();
			expect(labelName).to.have.length.greaterThan(0);
		});
		await delay(5000);

		// TODO -> Need to click the correct vulnerability node
		await sastNode[2].click();
		await delay(5000);

	});

		it('should open the editor and make sure that the file is opened', async function () {
			this.timeout(100000);
			const ctrl: ViewControl | undefined = await new ActivityBar().getViewControl('Checkmarx AST');
		const view = await ctrl?.openView();
		const results: CustomTreeSection = await view?.getContent().getSection('Details') as CustomTreeSection;
		expect(results).not.be.undefined;
		if (!await results.isExpanded()) {
			await results.expand();
		}
		await delay(5000);
		const detailsView = await driver.wait(until.elementsLocated(By.name("webviewview-astdetailsview")));
		await driver.switchTo().frame(await driver.findElement(By.name("webviewview-astdetailsview")));
		await driver.wait(until.elementsLocated(By.id("active-frame")));
		await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
		const scanElement = await driver.findElement(By.className("ast-node"));
		const valueOfText = await scanElement.getText();
		await scanElement.click();
		await delay(8000);
		await driver.switchTo().defaultContent();
		editorView = new EditorView();
		const tab = await editorView.getTabByTitle(valueOfText.split(" ")[0].replace("/", ""));
		const tabval = await tab.getText();
		expect(tabval).to.have.length.greaterThan(0);


	await delay(10000);
});


	it('should check that the issues are indicated in problems tab', async function () {
		this.timeout(80000);
		const problemsView = await new BottomBarPanel().openProblemsView();
		const issues = await problemsView.getAllMarkers(MarkerType.Any);
		expect(issues).to.have.length.greaterThan(0);
		await delay(10000);
	});

});



const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));
