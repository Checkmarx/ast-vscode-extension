import {
	By,
	WebDriver,
	Workbench,
	WebView,
	EditorView,
	InputBox,
	CustomTreeSection,
  } from "vscode-extension-tester";
  import { expect } from "chai";
  import { getQuickPickSelector, initialize, retryTest, sleep } from "./utils/utils";
  import { BRANCH_KEY_TREE, CX_LOOK_SCAN, CX_SELECT_BRANCH, CX_SELECT_PROJECT, PROJECT_KEY_TREE } from "./utils/constants";
import { CX_TEST_SCAN_BRANCH_NAME, CX_TEST_SCAN_PROJECT_NAME, SCAN_ID } from "./utils/envs";
  
  describe("Risk Management View Tests", () => {
	let driver: WebDriver;
	let workbench: Workbench;
	let riskManagementView: WebView;
    let treeScans: CustomTreeSection;
  
	before(async function () {
	  this.timeout(100000);
	  workbench = new Workbench();
	  driver = workbench.getDriver();
	});
  
	after(async () => {
	  await new EditorView().closeAllEditors();
	});
	  it("should select project and branch", async function () {
		treeScans = await initialize();
		// Execute project selection command
		await workbench.executeCommand(CX_SELECT_PROJECT);
		const input = await InputBox.create();
		await input.setText(CX_TEST_SCAN_PROJECT_NAME);
		// Select from the pickers list
		let projectName = await getQuickPickSelector(input);
		await input.setText(projectName);
		await input.confirm();
		// Wait for project selection to be made
		let project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
		expect(project).is.not.undefined;

			// Execute branch selection command
			await workbench.executeCommand(CX_SELECT_BRANCH);
			let branchInput = await InputBox.create();
			// Select from the pickers list
			await branchInput.setText(CX_TEST_SCAN_BRANCH_NAME);
			let branchName = await getQuickPickSelector(branchInput);
			await branchInput.setText(branchName);
			await branchInput.confirm();
			// Wait for branch selection to be made
			let branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
			expect(branch).is.not.undefined;
	  });
  
	//   it("should load results from scan ID", async function () {
	// 	await workbench.executeCommand(CX_LOOK_SCAN);
	// 	let input = await new InputBox();
	// 	await input.setText(SCAN_ID);
	// 	await input.confirm();
	// 	sleep(5000)
	//   });

	it("should display the Risk Management view", async function () {
	//   this.timeout(60000);
  
	  // Wait for the Risk Management webview to load
	  riskManagementView = await getRiskManagementView();
	  expect(riskManagementView).to.not.be.undefined;
  
	  // Verify the webview title
	  const titleElement = await riskManagementView.findWebElement(
		By.className("app-header")
	  );
	  const titleText = await titleElement.getText();
	  expect(titleText).to.include("Applications");
	});
  
	it("should display applications and their risk scores", retryTest(async function () {
	//   this.timeout(60000);
  
	  // Ensure the Risk Management view is loaded
	  riskManagementView = await getRiskManagementView();
  
	  // Verify that applications are listed
	  const appElements = await riskManagementView.findWebElements(
		By.className("custom-header")
	  );
	  expect(appElements.length).to.be.greaterThan(0);
  
	  // Verify the risk score of the first application
	  const firstAppRiskScore = await appElements[0].findElement(
		By.className("risk-score")
	  );
	  const riskScoreText = await firstAppRiskScore.getText();
	  expect(riskScoreText).to.match(/Critical|High|Medium|Low/);
	}));
  
	it("should sort applications by risk score", retryTest(async function () {
	//   this.timeout(60000);
  
	  // Ensure the Risk Management view is loaded
	  riskManagementView = await getRiskManagementView();
  
	  // Open the sort menu
	  const sortButton = await riskManagementView.findWebElement(
		By.id("sortButton")
	  );
	  await sortButton.click();
  
	  // Select "Application Risk Score" sorting
	  const sortOption = await riskManagementView.findWebElement(
		By.css('[data-sort="score"]')
	  );
	  await sortOption.click();
  
	  // Verify that the applications are sorted by risk score
	  const appElements = await riskManagementView.findWebElements(
		By.className("custom-header")
	  );
	  const riskScores = [];
	  for (const app of appElements) {
		const riskScoreElement = await app.findElement(By.className("risk-score"));
		const riskScoreText = await riskScoreElement.getText();
		riskScores.push(riskScoreText);
	  }
  
	  // Ensure the risk scores are sorted in descending order
	  const sortedScores = [...riskScores].sort((a, b) => b.localeCompare(a));
	  expect(riskScores).to.deep.equal(sortedScores);
	}));
  
	it("should filter applications by vulnerability type", retryTest(async function () {
	//   this.timeout(60000);
  
	  // Ensure the Risk Management view is loaded
	  riskManagementView = await getRiskManagementView();
  
	  // Open the filter menu
	  const filterButton = await riskManagementView.findWebElement(
		By.id("filterButton")
	  );
	  await filterButton.click();
  
	  // Select a vulnerability type filter
	  const vulnTypeCheckbox = await riskManagementView.findWebElement(
		By.css('#submenu-vuln-type input[type="checkbox"]:not(#vuln-all)')
	  );
	  await vulnTypeCheckbox.click();
  
	  // Apply the filter
	  const applyFilterButton = await riskManagementView.findWebElement(
		By.id("applyFilter")
	  );
	  await applyFilterButton.click();
  
	  // Verify that the applications are filtered
	  const appElements = await riskManagementView.findWebElements(
		By.className("custom-header")
	  );
	  expect(appElements.length).to.be.greaterThan(0);
  
	  // Verify that the filtered applications match the selected vulnerability type
	  for (const app of appElements) {
		const resultElements = await app.findElements(By.className("result"));
		for (const result of resultElements) {
		  const resultText = await result.getText();
		  expect(resultText).to.include("Vulnerability Type");
		}
	  }
	}));
  
	it("should open vulnerability details", retryTest(async function () {
	//   this.timeout(60000);
  
	  // Ensure the Risk Management view is loaded
	  riskManagementView = await getRiskManagementView();
  
	  // Click on the first vulnerability result
	  const firstResult = await riskManagementView.findWebElement(
		By.className("result")
	  );
	  await firstResult.click();
  
	  // Verify that the vulnerability details view is opened
	  const detailsView = await getRiskManagementView();
	  const detailsTitle = await detailsView.findWebElement(
		By.className("details-title")
	  );
	  const detailsText = await detailsTitle.getText();
	  expect(detailsText).to.not.be.empty;
	}));
  
	async function getRiskManagementView(): Promise<WebView> {
	  let view: WebView;
	  try {
		view = new WebView();
		await view.switchToFrame();
		console.log(await view.getDriver().getPageSource())
		return view;
	  } catch (error) {
		return undefined;
	  }
	}
  });