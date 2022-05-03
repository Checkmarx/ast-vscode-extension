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
  getDetailsView,
  validateNestedGroupBy,
  validateRootNode,
} from "./utils";
import {
  MAX_TIMEOUT,
  THIRTY_SECONDS,
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
  VS_CLOSE_GROUP_EDITOR,
  CX_FILTER_NOT_EXPLOITABLE,
  CX_FILTER_PROPOSED_NOT_EXPLOITABLE,
  CX_FILTER_CONFIRMED,
  CX_FILTER_TO_VERIFY,
  CX_FILTER_URGENT,
  CX_FILTER_NOT_IGNORED,
  CX_GROUP_STATE,
  CX_GROUP_QUERY_NAME,
} from "./constants";

describe("UI tests", async function () {
  this.timeout(MAX_TIMEOUT);
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
    await delay(FIVE_SECONDS);
  });

  it("should load results using wizard", async function () {
    this.timeout(MAX_TIMEOUT);
    let treeScans = await initialize();
    await delay(THIRTY_SECONDS);
    // Execute command to call wizard
    await new Workbench().executeCommand(CX_SELECT_ALL);
    await delay(THREE_SECONDS);
    // Project selection
    let input = await InputBox.create();
    await delay(THREE_SECONDS);
    let projectName = await getQuickPickSelector(input);
    await delay(THREE_SECONDS);
    await quickPickSelector(input);
    await delay(FIVE_SECONDS);
    // Branch selection
    let inputBranch = await InputBox.create();
    await delay(THREE_SECONDS);
    let branchName = await getQuickPickSelector(inputBranch);
    await delay(THREE_SECONDS);
    await quickPickSelector(inputBranch);
    await delay(FIVE_SECONDS);
    // Scan selection
    let inputScan = await InputBox.create();
    await delay(THREE_SECONDS);
    let scanDate = await getQuickPickSelector(inputScan);
    await delay(THREE_SECONDS);
    await quickPickSelector(inputScan);
    await delay(FIVE_SECONDS);
    // Project tree item validation
    await delay(THREE_SECONDS);
    let project = await treeScans?.findItem("Project:  " + projectName);
    await delay(THREE_SECONDS);
    expect(project).is.not.undefined;
    // Branch tree item validation
    let branch = await treeScans?.findItem("Branch:  " + branchName);
    await delay(THREE_SECONDS);
    expect(branch).is.not.undefined;
    // Scan tree item validation
    let scan = await treeScans?.findItem("Scan:  " + scanDate);
    await delay(THREE_SECONDS);
    expect(scan).is.not.undefined;
  });

  it("should clear all loaded results", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_CLEAR);
    await delay(THREE_SECONDS);
    // Project tree item validation
    let treeScans = await initialize();
    let project = await treeScans?.findItem("Project: ");
    await delay(THREE_SECONDS);
    expect(project).is.not.undefined;
    // Branch tree item validation
    let branch = await treeScans?.findItem("Branch: ");
    await delay(THREE_SECONDS);
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
    await delay(FIVE_SECONDS);
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
    await delay(FIVE_SECONDS);
    let input = await InputBox.create();
    await delay(THREE_SECONDS);
    let branchName = await getQuickPickSelector(input);
    await input.setText(branchName);
    await delay(THREE_SECONDS);
    await input.confirm();
    await delay(THIRTY_SECONDS);
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
    await delay(FIVE_SECONDS);
    let input = await InputBox.create();
    await delay(THREE_SECONDS);
    let scanDate = await getQuickPickSelector(input);
    await input.setText(scanDate);
    await delay(THREE_SECONDS);
    await input.cancel();
    await delay(FIVE_SECONDS);
    let branch = await treeScans?.findItem("Scan:  " + scanDate);
    expect(branch).is.not.undefined;
    await delay(THREE_SECONDS);
  });
  
  it("should clear all loaded results", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    await bench.executeCommand(CX_CLEAR);
    await delay(THREE_SECONDS);
    // Project tree item validation
    let treeScans = await initialize();
    let project = await treeScans?.findItem("Project: ");
    await delay(THREE_SECONDS);
    expect(project).is.not.undefined;
    // Branch tree item validation
    let branch = await treeScans?.findItem("Branch: ");
    await delay(THREE_SECONDS);
    expect(branch).is.not.undefined;
    // Scan tree item validation
    let scan = await treeScans?.findItem("Scan: ");
    expect(scan).is.not.undefined;
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

  it("Should click on comments", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    // Open details view
    let detailsView = await getDetailsView();
    // Find Hide comments
    let comments = await detailsView.findWebElement(
      By.id("comment_box")
    );
    await comments.click();
    expect(comments).is.not.undefined;
    await detailsView.switchBack();
    await delay(THREE_SECONDS);
  });

  it("Should click on details General tab", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    // Open details view
    let detailsView = await getDetailsView();
    // Find General Tab
    let generalTab = await detailsView.findWebElement(
      By.id("general-label")
    );
    await generalTab.click();
    expect(generalTab).is.not.undefined;
    await detailsView.switchBack();
    await delay(THREE_SECONDS);
  });

  it("Should click on details Learn More tab", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    // Open details view
    let detailsView = await getDetailsView();
    // Find Learn More Tab
    let learnTab = await detailsView.findWebElement(
      By.id("learn-label")
    );
    await learnTab.click();
    expect(learnTab).is.not.undefined;
    await detailsView.switchBack();
    await delay(THREE_SECONDS);
  });

  it("Should click on details Changes tab", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    // Open details view
    let detailsView = await getDetailsView();
    // Find Changes Tab
    let changesTab = await detailsView.findWebElement(
      By.id("changes-label")
    );
    await changesTab.click();
    // Make sure that the changes tab is loaded
    driver.wait(
      until.elementLocated(
        By.className(
          "history-container"
        )
      ),
      FIFTY_SECONDS
    );
    expect(changesTab).is.not.undefined;
    await detailsView.switchBack();
    await delay(THREE_SECONDS);
  });

  it("Should click on submit", async function () {
    this.timeout(MAX_TIMEOUT);
    await delay(THREE_SECONDS);
    // Open details view
    let detailsView = await getDetailsView();
    // Find Changes Tab
    let submit = await detailsView.findWebElement(
      By.className("submit")
    );
    await submit.click();
    expect(submit).is.not.undefined;
    await detailsView.switchBack();
    await delay(THREE_SECONDS);
  });
  
  it("should click on all filter severity", async function () {
    this.timeout(MAX_TIMEOUT);
    const commands = [{command:CX_FILTER_INFO,text:"INFO"},{command:CX_FILTER_LOW,text:"LOW"},{command:CX_FILTER_MEDIUM,text:"MEDIUM"},{command:CX_FILTER_HIGH,text:"HIGH"}];
    await delay(THREE_SECONDS);
    let treeScans = await initialize();
    for (var index in commands) {
      await bench.executeCommand(commands[index].command);
      await delay(THREE_SECONDS);
      let scan = await treeScans?.findItem(
        "Scan:  " + process.env.CX_TEST_SCAN_ID
      );
      await delay(THREE_SECONDS);
      let isValidated = await validateSeverities(scan, commands[index].text);
      await delay(THREE_SECONDS);
      expect(isValidated).to.equal(true);
      // Reset filters
      await bench.executeCommand(commands[index].command);
      await delay(THREE_SECONDS);
    }
    
  });
  
  it("should click on all group by", async function () {
    this.timeout(MAX_TIMEOUT);
    const commands = [CX_GROUP_LANGUAGE,CX_GROUP_STATUS,CX_GROUP_STATE,CX_GROUP_QUERY_NAME,CX_GROUP_FILE];
    // Get scan node
    const treeScans = await initialize();
    await delay(THREE_SECONDS);
    let scan =  await treeScans?.findItem(
      "Scan:  " + process.env.CX_TEST_SCAN_ID
    );
    // Expand and validate scan node to obtain engine nodes
    let tuple = await validateRootNode(scan);
    let level = 0;
    // Get the sast results node, because it is the only one affected by all the group by commands
    let sastNode = await scan?.findChildItem("sast");
    // Validate for all commands the nested tree elements
    for (var index in commands) {
      await delay(THREE_SECONDS);
      // Execute the group by command for each command
      await bench.executeCommand(commands[index]);
      await delay(THREE_SECONDS);
      // Validate the nested nodes
      level = await validateNestedGroupBy(0,sastNode);
      await delay(THREE_SECONDS);
      // level = (index * 2) + 3 is the cicle invariant, so it must be assured for all apllied filters
      expect(level).to.equal(parseInt(index)+3); // plus three because by default the tree always has, engine + severity and we must go into the last node with the actual result to confitm it does not have childrens
    };
    // Size must not be bigger than 3 because there are at most 3 engines in the first node
    expect(tuple[0]).to.be.at.most(4);
  });

  it("should click on all filter state", async function () {
    this.timeout(MAX_TIMEOUT);
    const commands = [CX_FILTER_NOT_EXPLOITABLE,CX_FILTER_PROPOSED_NOT_EXPLOITABLE,CX_FILTER_CONFIRMED,CX_FILTER_TO_VERIFY,CX_FILTER_URGENT,CX_FILTER_NOT_IGNORED];
    let treeScans = await initialize();
    await delay(THREE_SECONDS);
    for (var index in commands) {
      await bench.executeCommand(commands[index]);
      await delay(THREE_SECONDS);
      let scan = await treeScans?.findItem(
        "Scan:  " + process.env.CX_TEST_SCAN_ID
      );
      await delay(THREE_SECONDS);
      expect(scan).is.not.undefined;
      await delay(FIVE_SECONDS);
    }
  });
});
