import { By, CustomTreeSection, Editor, EditorView, InputBox, StatusBar, until, VSBrowser, WebDriver, WebView, Workbench} from 'vscode-extension-tester';
import { expect } from 'chai';
import { delay, getDetailsView, getQuickPickSelector, getResults, initialize, quickPickSelector } from './utils';
import { CX_CLEAR, CX_LOOK_SCAN, CX_SELECT_ALL, CX_SELECT_BRANCH, CX_SELECT_PROJECT, CX_SELECT_SCAN, CX_TEST_SCAN_PROJECT_NAME, FIVE_SECONDS, THIRTY_SECONDS, THREE_SECONDS, VS_CLOSE_GROUP_EDITOR, VS_OPEN_FOLDER } from './constants';

describe('WebView results detail test', () => {
	let bench: Workbench;
	let treeScans:CustomTreeSection;
	let driver: WebDriver;
	
    before(async function() {
        this.timeout(100000);
		bench = new Workbench();
		driver = VSBrowser.instance.driver;
		treeScans = await initialize();
    });

    after(async () => {
        await new EditorView().closeAllEditors();
		await bench.executeCommand(CX_CLEAR);
    });

	it("should check open webview and codebashing link", async function () {
		
		driver.wait(
			until.elementLocated(
			  By.className(
				"monaco-tl-twistie codicon codicon-tree-item-expanded collapsible collapsed"
			  )
			),
			15000
		  );
		treeScans = await initialize();
		while(treeScans===undefined){
			treeScans = await initialize();
		}
		let scan = await treeScans?.findItem(
		  "Scan:  " + process.env.CX_TEST_SCAN_ID 
		);
		while(scan===undefined){
			scan = await treeScans?.findItem(
				"Scan:  " + process.env.CX_TEST_SCAN_ID 
			  );
		}		
		// Get results and open details page
		let sastNode = await scan?.findChildItem("sast");
		let result = await getResults(sastNode);
		await delay(THIRTY_SECONDS);
		let resultName = await result[0].getLabel();
		await delay(FIVE_SECONDS);
		await result[0].click();
		await delay(THIRTY_SECONDS);
		// Close left view
		let leftView = new WebView();
		await delay(THIRTY_SECONDS);
		await leftView.click();
		await bench.executeCommand(VS_CLOSE_GROUP_EDITOR);
		// Open details view
		let detailsView = await getDetailsView();
		// Find details view title
		let titleWebElement = await detailsView.findWebElement(
		  By.id("cx_title")
		);
		await delay(FIVE_SECONDS);
		let title = await titleWebElement.getText();
		await delay(FIVE_SECONDS);
		expect(title).to.equal(resultName);
		let codebashingWebElement = await detailsView.findWebElement(
		  By.id("cx_header_codebashing")
		);
		await delay(FIVE_SECONDS);
		let codebashing = await codebashingWebElement.getText();
		await delay(FIVE_SECONDS);
		expect(codebashing).is.not.undefined;
		await detailsView.switchBack();
		await delay(THREE_SECONDS);		
	});

  it("should click on comments", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find Hide comments
    let comments = await detailsView.findWebElement(
      By.id("comment_box")
    );
	while(comments===undefined){
		comments = await detailsView.findWebElement(
			By.id("comment_box")
		  );
	}
	expect(comments).is.not.undefined;
    await comments.click();
    await detailsView.switchBack();
  });


  it("should click on details Learn More tab", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find Learn More Tab
    let learnTab = await detailsView.findWebElement(
      By.id("learn-label")
    );
	while(learnTab===undefined){
		learnTab = await detailsView.findWebElement(
			By.id("learn-label")
		  );
	}
	expect(learnTab).is.not.undefined;
    await learnTab.click();
    await detailsView.switchBack();
  });

  it("should click on details Changes tab", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find Changes Tab
    let changesTab = await detailsView.findWebElement(
      By.id("changes-label")
    );
	while(changesTab===undefined){
		changesTab = await detailsView.findWebElement(
			By.id("changes-label")
		  );
	}
    await changesTab.click();
    // Make sure that the changes tab is loaded
    driver.wait(
      until.elementLocated(
        By.className(
          "history-container"
        )
      ),
      5000
    );
    expect(changesTab).is.not.undefined;
    await detailsView.switchBack();
  });

  it("should click on update button", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find Changes Tab
    let submit = await detailsView.findWebElement(
      By.className("submit")
    );
	while(submit===undefined){
		submit = await detailsView.findWebElement(
			By.className("submit")
		  );
	}
	expect(submit).is.not.undefined;
    await submit.click();
    await detailsView.switchBack();
  });

  it("should click on details General tab", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find General Tab
    let generalTab = await detailsView.findWebElement(
      By.id("general-label")
    );
	while(generalTab===undefined){
		generalTab = await detailsView.findWebElement(
			By.id("general-label")
		  );
	}
	expect(generalTab).is.not.undefined;
    await generalTab.click();
    await detailsView.switchBack();
  });

});