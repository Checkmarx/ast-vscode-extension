import { By, CustomTreeSection, EditorView, InputBox, StatusBar, until, VSBrowser, WebDriver, WebView, Workbench} from 'vscode-extension-tester';
import { expect } from 'chai';
import { getDetailsView, getQuickPickSelector, getResults, initialize, quickPickSelector } from './utils';
import { CX_CLEAR, CX_LOOK_SCAN, CX_SELECT_ALL, CX_SELECT_BRANCH, CX_SELECT_PROJECT, CX_SELECT_SCAN, CX_TEST_SCAN_PROJECT_NAME, VS_CLOSE_GROUP_EDITOR, VS_OPEN_FOLDER } from './constants';

describe('Individual pickers load results test', () => {
	let bench: Workbench;
	let treeScans:CustomTreeSection;
	let driver: WebDriver;
	
    before(async function() {
        this.timeout(100000);
		bench = new Workbench();
		driver = VSBrowser.instance.driver;
		await bench.executeCommand(VS_OPEN_FOLDER);
		// open project folder
		let input = await InputBox.create();
		const appender = process.platform === "win32" ? "\\" : "/";
		const tempPath = __dirname + appender + "TestZip";
		await (input).setText(tempPath);
		await (input).confirm();
		let statusbar = new StatusBar();
        let chekmarx = await statusbar.getItem('Checkmarx kics auto scan');
        while(chekmarx!==undefined){
            chekmarx = await statusbar.getItem('Checkmarx kics auto scan');
        }
		await bench.executeCommand(CX_LOOK_SCAN);
    });

    after(async () => {
        await new EditorView().closeAllEditors();
		await bench.executeCommand(CX_CLEAR);
    });

  it("should load results from scan ID", async function () {
	treeScans = await initialize();
	driver.wait(
		until.elementLocated(
			By.linkText(
				"Project:"
			)
		),
	5000
	  );
	await bench.executeCommand(CX_LOOK_SCAN);
	let input = await InputBox.create();
    await input.setText(
      process.env.CX_TEST_SCAN_ID ? process.env.CX_TEST_SCAN_ID : ""
    );
	driver.wait(
		until.elementLocated(
			By.linkText(
				process.env.CX_TEST_SCAN_ID ? process.env.CX_TEST_SCAN_ID : ""
			)
		),
	5000
	  );
    await input.confirm();
    // Make sure that the results were loaded into the tree
    driver.wait(
      until.elementLocated(
        By.className(
          "monaco-tl-twistie codicon codicon-tree-item-expanded collapsible collapsed"
        )
      ),
      5000
    );
	});

	it("should check open webview and codebashing link", async function () {
		treeScans = await initialize();
		let scan = await treeScans?.findItem(
		  "Scan:  " + process.env.CX_TEST_SCAN_ID 
		);
		console.log("a procurar o scan");
		while(scan===undefined){
			// scan = await treeScans?.findItem(
			// 	"Scan:  " + process.env.CX_TEST_SCAN_ID ? process.env.CX_TEST_SCAN_ID : "9db65f63-63de-46f1-828e-13aae2161c5f"
			//   );
			scan = await treeScans?.findItem(
				"Scan:  " + "9db65f63-63de-46f1-828e-13aae2161c5f"
			  );
		}		
		// Get results and open details page
		let sastNode = await scan?.findChildItem("sast");
		while (sastNode===undefined) {
			sastNode = await scan?.findChildItem("sast");
		}
		let result = await getResults(sastNode);
		let resultName = await result[0].getLabel();
		await result[0].click();
		
		// Close left view
		let leftView = new WebView();
		
		await leftView.click();
		await bench.executeCommand(VS_CLOSE_GROUP_EDITOR);
		// Open details view
		let detailsView = await getDetailsView();
		// Find details view title
		let titleWebElement = await detailsView.findWebElement(
		  By.id("cx_title")
		);
		
		let title = await titleWebElement.getText();
		
		expect(title).to.equal(resultName);
		let codebashingWebElement = await detailsView.findWebElement(
		  By.id("cx_header_codebashing")
		);
		
		let codebashing = await codebashingWebElement.getText();
		
		expect(codebashing).is.not.undefined;
		await detailsView.switchBack();
		
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