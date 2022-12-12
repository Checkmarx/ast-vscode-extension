import { By, CustomTreeSection, EditorView, InputBox, StatusBar, until, VSBrowser, WebDriver, WebView, Workbench} from 'vscode-extension-tester';
import { expect } from 'chai';
import { delay, getDetailsView, getQuickPickSelector, getResults, initialize, quickPickSelector, validateNestedGroupBy, validateRootNode, validateSeverities } from './utils';
import { CX_CLEAR, CX_FILTER_CONFIRMED, CX_FILTER_HIGH, CX_FILTER_INFO, CX_FILTER_LOW, CX_FILTER_MEDIUM, CX_FILTER_NOT_EXPLOITABLE, CX_FILTER_NOT_IGNORED, CX_FILTER_PROPOSED_NOT_EXPLOITABLE, CX_FILTER_TO_VERIFY, CX_FILTER_URGENT, CX_GROUP_FILE, CX_GROUP_LANGUAGE, CX_GROUP_QUERY_NAME, CX_GROUP_STATE, CX_GROUP_STATUS, CX_LOOK_SCAN, CX_SELECT_ALL, CX_SELECT_BRANCH, CX_SELECT_PROJECT, CX_SELECT_SCAN, CX_TEST_SCAN_PROJECT_NAME, UUID_REGEX_VALIDATION, VS_CLOSE_GROUP_EDITOR, VS_OPEN_FOLDER } from './constants';
import { YES } from '../utils/common/constants';

describe('filter and groups actions tests', () => {
	let bench:Workbench;
	let treeScans:CustomTreeSection;
	let driver:WebDriver;
	
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

	it("should create scan with success case, branch confirmation", async function () {
		await bench.executeCommand(VS_OPEN_FOLDER);
		// open project folder
		let input = await InputBox.create();
		const appender = process.platform === "win32" ? "\\" : "/";
		const tempPath = __dirname + appender + "TestZip";
		await (input).setText(tempPath);
		await (input).confirm();
		await delay(1000);
		await bench.executeCommand(CX_LOOK_SCAN);
  	});

	it("cenas",async function () {
		let treeScan = await initialize();
		await bench.executeCommand(CX_LOOK_SCAN);
		let input = await InputBox.create();
		await input.setText(
		// process.env.CX_TEST_SCAN_ID ? process.env.CX_TEST_SCAN_ID : "6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
			"6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
		);
		await input.confirm();
	driver.wait(
			until.elementLocated(
				By.linkText(
					// "Scan:  " + process.env.CX_TEST_SCAN_ID
					"Scan:  " +"6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
				)
			),
		5000
		  );
		let scan =  await treeScan?.findItem(
			// "Scan:  " + scanId
			"Scan:  "+"6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
		);
		while(scan===undefined){
			
			scan =  await treeScan?.findItem(
				// "Scan:  " + scanId
				"Scan:  "+"6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
			);
		}
		// click play button(or initiate scan with command)
		await bench.executeCommand("ast-results.createScan");
		
		let resultsNotifications = await bench.getNotifications();
		while(resultsNotifications.length===0){
			resultsNotifications = await bench.getNotifications();
		}		
		const firstNotification = resultsNotifications[0];
		const title = await firstNotification.getMessage();
		const scanId = title.match(UUID_REGEX_VALIDATION);
		expect(scanId).to.not.be.undefined;
		expect(scanId.length).to.be.greaterThan(0);
		// wait for the user input to load the results
		await firstNotification.takeAction(YES);
		
		// get the scan id from the notification
		let treeScans = await initialize();
		scan =  await treeScans?.findItem(
			"Scan:  " + scanId
		);
		expect(scan).is.not.undefined;
	})
});