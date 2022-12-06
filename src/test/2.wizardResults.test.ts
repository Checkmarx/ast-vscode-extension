import { By, CustomTreeSection, EditorView, InputBox, until, VSBrowser, WebDriver, Workbench} from 'vscode-extension-tester';
import { expect } from 'chai';
import { getQuickPickSelector, initialize, quickPickSelector } from './utils';
import { CX_SELECT_ALL, CX_TEST_SCAN_PROJECT_NAME } from './constants';

describe('Wizard load results test', () => {
	let bench: Workbench;
	let treeScans:CustomTreeSection;
	let driver: WebDriver;
	
    before(async function() {
        this.timeout(100000);
		bench = new Workbench();
		driver = VSBrowser.instance.driver;
		await new Workbench().executeCommand(CX_SELECT_ALL);
    });

    after(async () => {
        await new EditorView().closeAllEditors();
    });

    it("should load results using wizard", async ()=> {	
		// Wizard command execution
		await new Workbench().executeCommand(CX_SELECT_ALL);

		// Project selection
		const inputProject = await InputBox.create();
		driver.wait(
			until.elementLocated(
				By.linkText(
					"AST Scan selection (1/3)"
				)
			),
		5000
	  	);
		await inputProject.setText("webgoat");
		driver.wait(
			until.elementLocated(
				By.linkText(
					"webgoat"
				)
			),
		5000
	  	);
		let projectName = await getQuickPickSelector(inputProject);
		// await quickPickSelector(inputProject);
		await inputProject.confirm();
	
		// Branch selection
		driver.wait(
			until.elementLocated(
				By.linkText(
					"AST Scan selection (2/3)"
				)
			),
		5000
	  	);
		const inputBranch = new InputBox();
		let branchName = await getQuickPickSelector(inputBranch);
		await quickPickSelector(inputBranch);
		// Scan selection
		driver.wait(
			until.elementLocated(
				By.linkText(
					"AST Scan selection (3/3)"
				)
			),
			5000
	  );
	  	const inputScan = new InputBox();
		let scanDate = await getQuickPickSelector(inputScan);
		await quickPickSelector(inputScan);
		
		driver.wait(
			until.elementLocated(
		  By.linkText(
			"Project:  " + projectName
		  )
		),
		5000
	  );
	  	treeScans = await initialize();
		// Project tree item validation
		let project = await treeScans?.findItem("Project:  " + projectName);
		expect(project).is.not.undefined;
		
		// Branch tree item validation
		let branch = await treeScans?.findItem("Branch:  " + branchName);
		expect(branch).is.not.undefined;
		
		// Scan tree item validation
		let scan = await treeScans?.findItem("Scan:  " + scanDate);
		expect(scan).is.not.undefined;
  });
});