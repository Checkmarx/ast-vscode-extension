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
	before(async function () {
	  this.timeout(100000);
	});
  
	it("should check if tree and play button exists", async function () {
	  const tree = await initializeSCA();
	  expect(tree).is.not.undefined;
	});

	it("should check if play button exists", async function () {
		await initializeSCA();
		await new Workbench().executeCommand(CX_SCA_SCAN);
		let outputView = await new BottomBarPanel().openOutputView();
		let text = await outputView.getText();
		while(!text.includes("Scan completed successfully")){
			outputView = await new BottomBarPanel().openOutputView();
			text = await outputView.getText();
		}
		expect(text).is.not.undefined;
	  });
  });
  