import { By, CustomTreeSection, EditorView, InputBox, StatusBar, until, VSBrowser, WebDriver, WebView, Workbench} from 'vscode-extension-tester';
import { expect } from 'chai';
import { delay, getDetailsView, getQuickPickSelector, getResults, initialize, quickPickSelector, validateNestedGroupBy, validateRootNode, validateSeverities } from './utils';
import { CX_CLEAR, CX_FILTER_CONFIRMED, CX_FILTER_HIGH, CX_FILTER_INFO, CX_FILTER_LOW, CX_FILTER_MEDIUM, CX_FILTER_NOT_EXPLOITABLE, CX_FILTER_NOT_IGNORED, CX_FILTER_PROPOSED_NOT_EXPLOITABLE, CX_FILTER_TO_VERIFY, CX_FILTER_URGENT, CX_GROUP_FILE, CX_GROUP_LANGUAGE, CX_GROUP_QUERY_NAME, CX_GROUP_STATE, CX_GROUP_STATUS, CX_LOOK_SCAN, CX_SELECT_ALL, CX_SELECT_BRANCH, CX_SELECT_PROJECT, CX_SELECT_SCAN, CX_TEST_SCAN_PROJECT_NAME, VS_CLOSE_GROUP_EDITOR, VS_OPEN_FOLDER } from './constants';

describe('filter and groups actions tests', () => {
	let bench:Workbench;
	let treeScans:CustomTreeSection;
	let driver:WebDriver;
	
    before(async function() {
        this.timeout(100000);
		bench = new Workbench();
		driver = VSBrowser.instance.driver;
		treeScans = await initialize();
		await bench.executeCommand(CX_LOOK_SCAN);
	});

    after(async () => {
        await new EditorView().closeAllEditors();
		await bench.executeCommand(CX_CLEAR);
    });

	it("should click on all filter severity", async function () {
		treeScans = await initialize();
		while(treeScans===undefined){
			treeScans = await initialize();
		}
		await bench.executeCommand(CX_LOOK_SCAN);
		let input = await InputBox.create();
		await input.setText(
		process.env.CX_TEST_SCAN_ID ? process.env.CX_TEST_SCAN_ID : ""
		);
		await input.confirm();
		driver.wait(
			until.elementLocated(
				By.linkText(
					"Scan:  " + process.env.CX_TEST_SCAN_ID
				)
			),
		15000
		  );
		const commands = [{command:CX_FILTER_INFO,text:"INFO"},{command:CX_FILTER_LOW,text:"LOW"},{command:CX_FILTER_MEDIUM,text:"MEDIUM"},{command:CX_FILTER_HIGH,text:"HIGH"}];
		for (var index in commands) {
			await bench.executeCommand(commands[index].command);
			treeScans = await initialize();
			let scan = await treeScans?.findItem(
				"Scan:  " + process.env.CX_TEST_SCAN_ID
			);
			while(scan===undefined){
				scan = await treeScans?.findItem(
					"Scan:  " + process.env.CX_TEST_SCAN_ID
				);
			}
			let isValidated = await validateSeverities(scan, commands[index].text);
			
			expect(isValidated).to.equal(true);
			// Reset filters
			await bench.executeCommand(commands[index].command);
			
		}
	});

	  it("should click on all group by", async function () {
		const commands = [CX_GROUP_LANGUAGE,CX_GROUP_STATUS,CX_GROUP_STATE,CX_GROUP_QUERY_NAME,CX_GROUP_FILE];
		// Get scan node
		const treeScans = await initialize();
		let scan =  await treeScans?.findItem(
			"Scan:  " + process.env.CX_TEST_SCAN_ID
		);
		while(scan===undefined){
			scan = await treeScans?.findItem(
				"Scan:  " + process.env.CX_TEST_SCAN_ID
				);
		}
		// Expand and validate scan node to obtain engine nodes
		let tuple = await validateRootNode(scan);
		//let level = 0;
		// Get the sast results node, because it is the only one affected by all the group by commands
		let sastNode = await scan?.findChildItem("sast");
		while(sastNode===undefined){
			sastNode = await scan?.findChildItem("sast");
		}
		// Validate for all commands the nested tree elements
		for (var index in commands) {
			// Execute the group by command for each command
			await bench.executeCommand(commands[index]);
			await delay(1000);
			// Validate the nested nodes
			// level = await validateNestedGroupBy(0,sastNode);
			// // level = (index * 2) + 3 is the cicle invariant, so it must be assured for all apllied filters
			// expect(level).to.equal(parseInt(index)+3); // plus three because by default the tree always has, engine + severity and we must go into the last node with the actual result to confitm it does not have childrens
		};
		// Size must not be bigger than 3 because there are at most 3 engines in the first node
		expect(tuple[0]).to.be.at.most(4);
  });

  it("should click on all filter state", async function () {
    const commands = [CX_FILTER_NOT_EXPLOITABLE,CX_FILTER_PROPOSED_NOT_EXPLOITABLE,CX_FILTER_CONFIRMED,CX_FILTER_TO_VERIFY,CX_FILTER_URGENT,CX_FILTER_NOT_IGNORED];
    let treeScans = await initialize();
    for (var index in commands) {
      await bench.executeCommand(commands[index]);
      let scan = await treeScans?.findItem(
        "Scan:  " + process.env.CX_TEST_SCAN_ID
      );
	while(scan===undefined){
		scan =  await treeScans?.findItem(
			"Scan:  " + process.env.CX_TEST_SCAN_ID
			);
	}
    expect(scan).is.not.undefined;
    }
  });
});