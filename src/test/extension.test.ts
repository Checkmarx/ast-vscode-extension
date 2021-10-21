import { CxScanConfig } from '@checkmarxdev/ast-cli-javascript-wrapper/dist/main/CxScanConfig';
import { doesNotMatch } from 'assert';
import { expect } from 'chai';
import path = require('path');
import { Location, TextEdit } from 'vscode';
import { VSBrowser, Workbench, WebDriver, ExtensionsViewItem ,ComboSetting, LinkSetting, InputBox, SettingsEditor, Locators, By, WebView, Key, SideBarView, ActivityBar, ViewControl, WebElementPromise, WebElement, CustomTreeSection, CustomTreeItem, ViewItem, until, Locator, ViewSection, DefaultTreeSection, BottomBarPanel, TitleBar, EditorView, ModalDialog} from 'vscode-extension-tester';
describe('Check configuration settings', async function () {
	let bench: Workbench;
	let driver: WebDriver;
	let webView: WebView;
	let settingsWizard:SettingsEditor;
	let activityBar: ActivityBar;
	let scanConfig: CxScanConfig;
	let editorView: EditorView;

    before( async () => {
								this.timeout(100000);
								//loadSettingsJson();
								scanConfig = new CxScanConfig();
        bench = new Workbench();
								webView = new WebView();
								driver = VSBrowser.instance.driver;
								activityBar = new ActivityBar();
								editorView = new EditorView();
    });

				it('should only enable Checkmarx AST extension', async function () {
					this.timeout(80000);
					settingsWizard = await bench.openSettings();
					await delay(5000);
					const setting = await settingsWizard.findSetting("API KEY","Checkmarx AST") as LinkSetting;
					expect(setting).to.be.undefined;
					await delay(10000);
	});
	

	it('should check if basic configurations exist', async function () {
			this.timeout(80000);
			const apiKey = await (await settingsWizard.findSetting("Api Key","Checkmarx AST")).getValue();
			expect(apiKey).to.have.lengthOf.above(1);
			const baseURI = await settingsWizard.findSetting("Base-uri","Checkmarx AST");
			expect(await baseURI.getValue()).to.have.lengthOf.above(1);
			const tenant = await settingsWizard.findSetting("Tenant","Checkmarx AST");
			expect(await tenant.getValue()).to.have.lengthOf.above(1);
});

it('should checkout the bodge it code', async function () {
	this.timeout(100000);
	const terminalView = await new BottomBarPanel().openTerminalView();
	const names = await terminalView.getChannelNames();
	await terminalView.selectChannel('Git');
	//await terminalView.executeCommand('cd /tmp');
	await terminalView.executeCommand('git clone https://github.com/pedrompflopes/ast-github-tester.git');
	await delay(5000);
	await new TitleBar().select('File', 'Open Folder...');
	const input = InputBox.create();
	const path = await (await input).getText();
	await (await input).setText(path + "ast-github-tester");
	await (await input).confirm();
	await delay(15000);
	// const dialog = new ModalDialog();
	// await dialog.pushButton('Cancel');
	// await delay(10000);
		});

it('should open the checkmarx AST extension', async function () {
	this.timeout(80000);
	const control:ViewControl|undefined = await new ActivityBar().getViewControl('Checkmarx AST');
	if(control !== undefined) {
	const view = await control.openView();
	expect(view).is.not.undefined;
 expect(await view?.isDisplayed()).is.true;
	}
	await delay(5000);
	
});

it('should get scan ID and update the scanID label and load results', async function () {
	this.timeout(80000);
	const ctrl: ViewControl| undefined= await new ActivityBar().getViewControl('Checkmarx AST');
	if(ctrl !== undefined) {
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
 const scanElement = await driver.findElement(By.id("scanID")).sendKeys("990d1803-3b82-467c-b03e-0a3e1924e024");
	driver.findElement(By.className("ast-search")).click();
	await driver.switchTo().defaultContent();
	await delay(10000);
	}
	
});

it('should open the loaded results and traverse the tree items', async function () {
	this.timeout(80000);
	const ctrl: ViewControl| undefined= await new ActivityBar().getViewControl('Checkmarx AST');	
	const view = await ctrl?.openView();
	const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
	const tree = await results.isExpanded();
	const treeNodes = await results.getVisibleItems();
	treeNodes.forEach(async (node) => {
		const indNode = (await node.getLabel());
		//expect(indNode).to.have.members(["sast","dependency","infrastructure"]);
		expect(indNode).to.have.length.greaterThan(0);
		await node.expand();
});
	await delay(5000);
});

it('should check the individual nodes for ALL filters', async function () {
	this.timeout(80000);

	const ctrl: ViewControl| undefined= await new ActivityBar().getViewControl('Checkmarx AST');	
	const view = await ctrl?.openView();
	const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
	if(!await results.isExpanded()){
			await results.expand();
	}
	const treeFilters = await results.getActions().then(async val => {
		await val.forEach(async node => {
			const indNode = (await node.getLabel());
			expect(indNode).to.have.length.greaterThan(0);
		});
		await bench.executeCommand("Checkmarx AST: Focus on Results View");
		const filterLabel = await results.getAction("More Actions...");
		await bench.executeCommand("Checkmarx AST: Group By: Status");
	await results.getVisibleItems().then(async node => {
		node.forEach(async indNode => {
			await indNode.expand();
			const indResult = await indNode.getChildren();
			indResult.forEach(async ind => {
				const childLabel = await ind.getLabel();
				expect(childLabel).to.have.length.greaterThan(0);
				//expect(["NEW,RECURRENT"]).to.include(childLabel);
			});
		});
	});
	await delay(5000);
	await bench.executeCommand("Checkmarx AST: Group By: Severity");
		await results.getVisibleItems().then(async node => {
			node.forEach(async indNode => {
				await indNode.expand();
				const indResult = await indNode.getChildren();
				const label = await indNode.getLabel();
				indResult.forEach(async ind => {
					const childLabel = await ind.getLabel();
					//expect(["HIGH,LOW,MEDIUM"]).to.include(childLabel);
					expect(childLabel).to.have.length.greaterThan(0);
				});
			});
		});
		await delay(5000);
	});
});

it('should open individual filter and underlying tree items', async function () {
	this.timeout(80000);
	const ctrl: ViewControl| undefined= await new ActivityBar().getViewControl('Checkmarx AST');	
	const view = await ctrl?.openView();
	const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
	expect(results).not.be.undefined;
	if(!await results.isExpanded()){
			await results.expand();
	}
	const scaNodes = await results.getVisibleItems().then((async items => {
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
	const ctrl: ViewControl| undefined= await new ActivityBar().getViewControl('Checkmarx AST');	
	const view = await ctrl?.openView();
	const results: CustomTreeSection = await view?.getContent().getSection('Results') as CustomTreeSection;
	expect(results).not.be.undefined;
	if(!await results.isExpanded()){
			await results.expand();
	}

	const sastNode =await results.getVisibleItems();
			sastNode.forEach(async node => {
				//console.log(await node.getLabel());
				if(await node.isExpandable() && !await node.isExpanded()){
					await node.expand();
				}
				expect(await node.getLabel()).to.have.length.greaterThan(0);
	});
	//await sastNode[1].click();
	//const childLabels = await sastNode.filter(async node =>  (await node.getEnclosingElement().getText()).includes("_"));
	// sastNode[sastNode.length-1].click();
	const details: ViewSection = await view?.getContent().getSection('Details') as ViewSection;
	const ele = await details.getEnclosingElement();
	console.log(await ele.getText());
	const detailsView = await driver.wait(until.elementsLocated(By.name("webviewview-astdetailsview")));
	await driver.switchTo().frame(await driver.findElement(By.name("webviewview-astdetailsview")));
	await driver.wait(until.elementsLocated(By.id("active-frame")));
	await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
 const scanElement = await driver.findElement(By.className("ast-node"));
	const valueOfText = await scanElement.getText();
	await scanElement.click();
	await delay(3000);
	await driver.switchTo().defaultContent();
	editorView = new EditorView();
	const tab = await editorView.getTabByTitle(valueOfText.split(" ")[0].replace("/",""));
	const tabval = await tab.getText();
	expect(tabval).to.have.length.greaterThan(0);

		});
		await delay(10000);

		
		
});



const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));

// function loadSettingsJson() {
// 	const fs = require('fs');
// 	let rawData = fs.readFileSync(path.resolve(__dirname, '../../src/settings.json'));
// 	let setting = JSON.parse(rawData);
// 	setting['checkmarxAST.apiKey'] = process.env.CX_API_KEY;
//  fs.writeFileSync(path.resolve(__dirname, '../../src/setting.json'), JSON.stringify(setting));

// 	//throw new Error('Function not implemented.');
// }
