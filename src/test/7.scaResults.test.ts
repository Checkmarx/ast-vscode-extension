import {
	BottomBarPanel,
	CustomTreeSection,
	EditorView,
	VSBrowser,
	WebDriver,
	Workbench,
  } from "vscode-extension-tester";
  import { expect } from "chai";
  import { initializeSCA } from "./utils/utils";
  import {
	CX_SCA_CLEAR,
	CX_SCA_SCAN,
  } from "./utils/constants";
  
  describe("SCA scan panel test", () => {
	let bench: Workbench;
	let tree: CustomTreeSection;
	let driver: WebDriver;
  
	before(async function () {
	  this.timeout(100000);
	  bench = new Workbench();
	  driver = VSBrowser.instance.driver;
	});
  
	after(async () => {
	  await new EditorView().closeAllEditors();
	  await bench.executeCommand(CX_SCA_CLEAR);
	});
  
	it("should check if tree and play button exists", async function () {
	  tree = await initializeSCA();
	  expect(tree).is.not.undefined;
	});

	it("should check if play button exists", async function () {
		tree = await initializeSCA();
		await bench.executeCommand(CX_SCA_SCAN);
		let outputView = await new BottomBarPanel().openOutputView();
		let text = await outputView.getText();
		console.log(text);
		while(!text.includes("Scan completed successfully")){
			outputView = await new BottomBarPanel().openOutputView();
			text = await outputView.getText();
			console.log(text);
		}
		expect(text).is.not.undefined;
	  });
  });
  