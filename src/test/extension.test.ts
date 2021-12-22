import { expect } from "chai";
import {
  VSBrowser,
  Workbench,
  WebDriver,
  LinkSetting,
  InputBox,
  By,
  until,
  WebView,
} from "vscode-extension-tester";
import {
  initialize,
  getQuickPickSelector,
  delay,
  getResults,
  validateSeverities,
  quickPickSelector,
} from "./utils";
import {
  MAX_TIMEOUT,
  FIFTEEN_SECONDS,
  FIFTY_SECONDS,
  FIVE_SECONDS,
  THREE_SECONDS,
  TWO_SECONDS,
  CX_API_KEY_CAPS,
  CX_API_KEY,
  CX_TENANT,
  CX_BASE_URI,
  VS_CLOSE_EDITOR,
  VS_OPEN_FOLDER,
  CX_SELECT_PROJECT,
  CX_SELECT_BRANCH,
  CX_SELECT_SCAN,
  CX_LOOK_SCAN,
  CX_NAME,
  CX_FILTER_INFO,
  CX_FILTER_LOW,
  CX_FILTER_MEDIUM,
  CX_FILTER_HIGH,
  CX_CLEAR,
  CX_SELECT_ALL,
  CX_GROUP_FILE,
  CX_GROUP_LANGUAGE,
  CX_GROUP_STATUS,
  CX_GROUP_SEVERITY,
  VS_CLOSE_GROUP_EDITOR,
} from "./constants";

describe("UI tests", async function () {
  let bench: Workbench;
  let driver: WebDriver;
  before(async () => {
    this.timeout(MAX_TIMEOUT);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await delay(THREE_SECONDS);
  });

  it("should open welcome view and check if exists", async function () {
    this.timeout(MAX_TIMEOUT);
    let tree = await initialize();
    let welcome = await tree?.findWelcomeContent();
    expect(welcome).is.not.undefined;
  });

  it("should open settings and validate the wrong Key", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let settingsWizard = await bench.openSettings();
    await delay(TWO_SECONDS);
    const setting = (await settingsWizard.findSetting(
      CX_API_KEY_CAPS,
      CX_NAME
    )) as LinkSetting;
    await delay(THREE_SECONDS);
    expect(setting).to.be.undefined;
    await delay(THREE_SECONDS);
  });

  it("should set the settings and check if values are populated", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
	// Set settings values
    let settingsWizard = await bench.openSettings();
    await delay(TWO_SECONDS);
    const apiKeyVal = await await settingsWizard.findSetting(
      CX_API_KEY,
      CX_NAME
    );
    await apiKeyVal.setValue(process.env.CX_API_KEY + "");
    await delay(TWO_SECONDS);
    const baseUriVal = await await settingsWizard.findSetting(
      CX_BASE_URI,
      CX_NAME
    );
    await baseUriVal.setValue(process.env.CX_BASE_URI + "");
    await delay(TWO_SECONDS);
    const tenantVal = await await settingsWizard.findSetting(
      CX_TENANT,
      CX_NAME
    );
    await tenantVal.setValue(process.env.CX_TENANT + "");
    await delay(TWO_SECONDS);
	// Validate settings
    const apiKey = await (
      await settingsWizard.findSetting(CX_API_KEY, CX_NAME)
    ).getValue();
    expect(apiKey).to.equal(process.env.CX_API_KEY + "");
    await delay(TWO_SECONDS);
    const baseURI = await settingsWizard.findSetting(CX_BASE_URI, CX_NAME);
    expect(await baseURI.getValue()).to.equal(process.env.CX_BASE_URI + "");
    await delay(TWO_SECONDS);
    const tenant = await settingsWizard.findSetting(CX_TENANT, CX_NAME);
    expect(await tenant.getValue()).to.equal(process.env.CX_TENANT + "");
    await delay(TWO_SECONDS);
    await bench.executeCommand(VS_CLOSE_EDITOR);
    await delay(THREE_SECONDS);
  });

  it("should open the test repo", async function () {
    this.timeout(MAX_TIMEOUT);
    await bench.executeCommand(VS_OPEN_FOLDER);
    let input = await InputBox.create();
    const appender = process.platform === "win32" ? "\\" : "/";
    const tempPath = __dirname + appender + "testProj";
    await (await input).setText(tempPath);
    await (await input).confirm();
    expect(tempPath).to.have.lengthOf.above(1);
    await delay(THREE_SECONDS);
  });

  it("should load results using wizard", async function () {
    this.timeout(MAX_TIMEOUT);
    let treeScans = await initialize();
    await delay(THREE_SECONDS);    
    // Execute command to call wizard
    await bench.executeCommand(CX_SELECT_ALL);
    await delay(FIFTEEN_SECONDS);
    // Project selection
    let input = await InputBox.create();
    await delay(THREE_SECONDS);
    let projectName = await getQuickPickSelector(input);
    await delay(THREE_SECONDS);
    await quickPickSelector(input);
    await delay(FIFTEEN_SECONDS);
    // Branch selection
    let inputBranch = await InputBox.create();
    await delay(THREE_SECONDS);
    let branchName = await getQuickPickSelector(inputBranch);
    await delay(THREE_SECONDS);
    await quickPickSelector(inputBranch);
    await delay(FIFTEEN_SECONDS);
    // Scan selection
    let inputScan = await InputBox.create();
    await delay(THREE_SECONDS);
    let scanDate = await getQuickPickSelector(inputScan);
    await delay(THREE_SECONDS);
    await quickPickSelector(inputScan);
    await delay(FIFTEEN_SECONDS);
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

  it("should clear all loaded results", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await bench.executeCommand(CX_CLEAR);
    await delay(THREE_SECONDS);
    // Project tree item validation
    let project = await treeScans?.findItem("Project: ");
    expect(project).is.not.undefined;
    // Branch tree item validation
    let branch = await treeScans?.findItem("Branch: ");
    expect(branch).is.not.undefined;
    // Scan tree item validation
    let scan = await treeScans?.findItem("Scan: ");
    expect(scan).is.not.undefined;
    await delay(THREE_SECONDS);
  });

  it("should select project", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_SELECT_PROJECT);
    await delay(FIFTEEN_SECONDS);
    let input = await InputBox.create();
    await delay(THREE_SECONDS);
    let projectName = await getQuickPickSelector(input);
    await input.setText(projectName);
    await delay(THREE_SECONDS);
    await input.confirm();
    await delay(THREE_SECONDS);
    let project = await treeScans?.findItem("Project:  " + projectName);
    expect(project).is.not.undefined;
    await delay(THREE_SECONDS);
  });

  it("should select branch", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_SELECT_BRANCH);
    await delay(FIFTEEN_SECONDS);
    let input = await InputBox.create();
    await delay(THREE_SECONDS);
    let branchName = await getQuickPickSelector(input);
    await input.setText(branchName);
    await delay(THREE_SECONDS);
    await input.confirm();
    await delay(FIFTY_SECONDS);
    let branch = await treeScans?.findItem("Branch:  " + branchName);
    expect(branch).is.not.undefined;
    await delay(THREE_SECONDS);
  });

  it("should select scan", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_SELECT_SCAN);
    await delay(FIFTEEN_SECONDS);
    let input = await InputBox.create();
    await delay(THREE_SECONDS);
    let scanDate = await getQuickPickSelector(input);
    await input.setText(scanDate);
    await delay(THREE_SECONDS);
    await input.confirm();
    await delay(FIFTY_SECONDS);
    let branch = await treeScans?.findItem("Scan:  " + scanDate);
    expect(branch).is.not.undefined;
    await delay(THREE_SECONDS);
  });

  it("should load results from scan ID", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await delay(FIVE_SECONDS);
    await bench.executeCommand(CX_LOOK_SCAN);
    await delay(FIVE_SECONDS);
    let input = await InputBox.create();
    await delay(FIVE_SECONDS);
    await input.setText(
      process.env.CX_TEST_SCAN_ID ? process.env.CX_TEST_SCAN_ID : ""
    );
    await delay(FIVE_SECONDS);
    await input.confirm();
    await delay(FIFTY_SECONDS);
    // Make sure that the results were loaded into the tree
    driver.wait(
      until.elementLocated(
        By.className(
          "monaco-tl-twistie codicon codicon-tree-item-expanded collapsible collapsed"
        )
      ),
      FIFTY_SECONDS
    );
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(FIVE_SECONDS);
    // Get results and open details page
    let result = await getResults(scan);
    await delay(FIFTEEN_SECONDS);
    let resultName = await result[0].getLabel();
    await delay(FIVE_SECONDS);
    await result[0].click();
    await delay(FIVE_SECONDS);
    // Close left view
    let leftView = new WebView();
    await leftView.click();
    await bench.executeCommand(VS_CLOSE_GROUP_EDITOR);
    // Open details view
    let detailsView = new WebView();
    await delay(FIVE_SECONDS);
    await detailsView.switchToFrame();
    await delay(FIVE_SECONDS);
    // Find details view title
    let titleWebElement = await detailsView.findWebElement(
      By.className("title_td")
    );
    await delay(FIVE_SECONDS);
    let title = await titleWebElement.getText();
    await delay(FIVE_SECONDS);
    expect(title).to.equal(resultName);
    await detailsView.switchBack();
    await delay(THREE_SECONDS);
  });

  it("should click info filter", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await bench.executeCommand(CX_FILTER_INFO);
    await delay(THREE_SECONDS);
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(THREE_SECONDS);
    let isValidated = await validateSeverities(scan, "INFO");
    expect(isValidated).to.equal(true);
	// Reset filters
    await bench.executeCommand(CX_FILTER_INFO);
    await delay(THREE_SECONDS);
  });

  it("should click low filter", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await bench.executeCommand(CX_FILTER_LOW);
    await delay(THREE_SECONDS);
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(THREE_SECONDS);
    let isValidated = await validateSeverities(scan, "LOW");
    expect(isValidated).to.equal(true);
	// Reset filters
    await bench.executeCommand(CX_FILTER_LOW);
    await delay(THREE_SECONDS);
  });

  it("should click medium filter", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await bench.executeCommand(CX_FILTER_MEDIUM);
    await delay(THREE_SECONDS);
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(THREE_SECONDS);
    let isValidated = await validateSeverities(scan, "MEDIUM");
    expect(isValidated).to.equal(true);
	// Reset filters
    await bench.executeCommand(CX_FILTER_MEDIUM);
    await delay(THREE_SECONDS);
  });

  it("should click high filter", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await bench.executeCommand(CX_FILTER_HIGH);
    await delay(THREE_SECONDS);
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(THREE_SECONDS);
    let isValidated = await validateSeverities(scan, "HIGH");
    expect(isValidated).to.equal(true);
	// Reset filters
    await bench.executeCommand(CX_FILTER_HIGH);
    await delay(THREE_SECONDS);
  });

  it("should click group by file", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_GROUP_FILE);
    await delay(THREE_SECONDS);
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(THREE_SECONDS);
    let result = await getResults(scan);
    expect(result).is.not.undefined;
    await delay(FIVE_SECONDS);
  });

  it("should click group by language", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_GROUP_LANGUAGE);
    await delay(THREE_SECONDS);
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(THREE_SECONDS);
    let result = await getResults(scan);
    expect(result).is.not.undefined;
    await delay(FIVE_SECONDS);
  });

  it("should click group by status", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_GROUP_STATUS);
    await delay(THREE_SECONDS);
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(THREE_SECONDS);
    let result = await getResults(scan);
    expect(result).is.not.undefined;
    await delay(FIVE_SECONDS);
  });

  it("should click group by severity", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_GROUP_SEVERITY);
    await delay(THREE_SECONDS);
    let scan = await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    await delay(THREE_SECONDS);
    let result = await getResults(scan);
    expect(result).is.not.undefined;
    await delay(FIVE_SECONDS);
  });
});
