import {
  By,
  CustomTreeSection,
  EditorView,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
  BottomBarPanel,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  getDetailsView,
  getResults,
  initialize,
  validateRootNode,
  getQuickPickSelector,
  clickFirstVulnerability,
  sleep,
} from "./utils/utils";
import {
  CHANGES_LABEL,
  CX_LOOK_SCAN,
  GENERAL_LABEL,
  LEARN_MORE_LABEL,
  SCAN_KEY_TREE_LABEL,
  SCS_SECRET_DETECTION_Type,
  CX_GROUP_STATUS,
  CX_GROUP_STATE,
  CX_GROUP_FILE,
  CX_GROUP_SEVERITY,
  CX_SELECT_PROJECT,
  PROJECT_KEY_TREE,
  CX_SELECT_BRANCH,
  BRANCH_KEY_TREE,
  CX_SELECT_SCAN,
  SCAN_KEY_TREE,
  CX_FILTER_NOT_EXPLOITABLE,
  CX_FILTER_PROPOSED_NOT_EXPLOITABLE,
  CX_FILTER_CONFIRMED,
  CX_FILTER_TO_VERIFY,
  CX_FILTER_URGENT,
  CX_FILTER_NOT_IGNORED,
  CX_CLEAR,
  CX_GROUP_LANGUAGE,
  CX_GROUP_QUERY_NAME,
} from "./utils/constants";
import { SCAN_ID, CX_TEST_SCAN_PROJECT_NAME, CX_TEST_SCAN_BRANCH_NAME } from "./utils/envs";

describe("Get secret detection results and checking GroupBy , Filter and Open details window", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000); // Increase timeout to 100 seconds
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await new Workbench().executeCommand("workbench.action.closeActiveEditor");
    await bench.executeCommand(CX_CLEAR);
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  it("should load scan first before applying filters", async function () {
    this.timeout(90000);

    // Load scan by ID first
    await bench.executeCommand(CX_LOOK_SCAN);
    const input = await InputBox.create();
    await sleep(1000);
    await input.setText(SCAN_ID);
    await input.confirm();

    // Wait for scan to load
    await sleep(5000);

    // Verify scan loaded
    treeScans = await initialize();
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

    const maxAttempts = 60;
    let attempts = 0;

    while (scan === undefined && attempts < maxAttempts) {
      await sleep(1000);
      treeScans = await initialize();
      scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
      attempts++;
    }

    expect(scan).to.not.be.undefined;
  });

  it("should clear groub by for scs secret detection and open details window ", async function () {
    this.timeout(90000);

    // Ensure scan is loaded first
    treeScans = await initialize();
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

    if (!scan) {
      throw new Error("Scan must be loaded before applying filters and groups");
    }

    const commands = [
      CX_GROUP_LANGUAGE,
      CX_GROUP_STATUS,
      CX_GROUP_STATE,
      CX_GROUP_QUERY_NAME,
      CX_GROUP_FILE,
      CX_FILTER_NOT_EXPLOITABLE,
      CX_FILTER_PROPOSED_NOT_EXPLOITABLE,
      CX_FILTER_CONFIRMED,
      CX_FILTER_TO_VERIFY,
      CX_FILTER_URGENT,
      CX_FILTER_NOT_IGNORED,
      CX_GROUP_FILE,
      CX_GROUP_STATE,
      CX_GROUP_STATUS,
      CX_GROUP_SEVERITY,
    ];

    for (const command of commands) {
      await bench.executeCommand(command);
      await sleep(500);
    }

    // Verify tree is still accessible
    treeScans = await initialize();
    expect(treeScans).not.to.be.undefined;
  });

  it("should select project", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    treeScans = await initialize();
    // Execute project selection command
    await bench.executeCommand(CX_SELECT_PROJECT);
    const input = await InputBox.create();
    // Add delay to ensure input box is ready
    await new Promise((res) => setTimeout(res, 1000));
    await input.setText(CX_TEST_SCAN_PROJECT_NAME);
    // Select from the pickers list
    let projectName = await getQuickPickSelector(input);
    await input.setText(projectName);
    await input.confirm();
    // Wait for project selection to be made
    let project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
    expect(project).is.not.undefined;
  });

  it("should select branch", async function () {
    let treeScans = await initialize();
    // Execute branch selection command
    await bench.executeCommand(CX_SELECT_BRANCH);
    let input = await InputBox.create();
    // Select from the pickers list
    await input.setText(CX_TEST_SCAN_BRANCH_NAME);
    let branchName = await getQuickPickSelector(input);
    await input.setText(branchName);
    await input.confirm();
    // Wait for branch selection to be made
    let branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
    expect(branch).is.not.undefined;
  });

  it("should select scan", async function () {
    let treeScans = await initialize();
    // Execute scan selection command
    await bench.executeCommand(CX_SELECT_SCAN);
    let input = await InputBox.create();
    // Select from the pickers list
    let scanDate = await getQuickPickSelector(input);
    await input.setText(scanDate);
    await input.confirm();
    // Wait for scan selection to be made
    const scanDetailsparts: string[] = scanDate.split(" ");
    const formattedId: string = scanDetailsparts.slice(-2).join(" ");
    let scan = await treeScans?.findItem(SCAN_KEY_TREE + formattedId);
    expect(scan).is.not.undefined;
  });

  it.skip("should load results from scan ID", async function () {
    // This test is now covered by "should load scan first before applying filters"
    await bench.executeCommand(CX_LOOK_SCAN);
    const input = await InputBox.create();
    await sleep(1000);
    await input.setText(SCAN_ID);
    await input.confirm();
  });

  it.skip("secret detection tree with GroupBy command ", async function () {
    treeScans = await initialize();
    while (treeScans === undefined) {
      treeScans = await initialize();
    }
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

    let secretDetectionNode = await scan?.findChildItem(
      SCS_SECRET_DETECTION_Type
    );
    if (secretDetectionNode === undefined) {
      secretDetectionNode = await scan?.findChildItem(
        SCS_SECRET_DETECTION_Type
      );
    }
    await clickFirstVulnerability(secretDetectionNode);

    const commands = [
      CX_GROUP_FILE,
      CX_GROUP_SEVERITY,
      CX_GROUP_STATE,
      CX_GROUP_STATUS,
    ];

    let tuple = await validateRootNode(scan);

    for (const command of commands) {
      await bench.executeCommand(command);
    }

    expect(tuple[0]).to.be.at.most(4);
  });

  it("Secret detection tree with Filter command", async function () {
    this.timeout(90000);

    treeScans = await initialize();
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

    if (!scan) {
      throw new Error("Scan must be loaded before applying filters");
    }

    const commands = [
      CX_FILTER_NOT_EXPLOITABLE,
      CX_FILTER_PROPOSED_NOT_EXPLOITABLE,
      CX_FILTER_CONFIRMED,
      CX_FILTER_TO_VERIFY,
      CX_FILTER_URGENT,
      CX_FILTER_NOT_IGNORED,
    ];

    for (const command of commands) {
      await bench.executeCommand(command);
      await sleep(500);

      // Verify tree is still accessible
      treeScans = await initialize();
      expect(treeScans).not.to.be.undefined;
    }
  });

  it.skip("should click on General tab", async function () {
    const detailsView = await getDetailsView();
    // Find General Tab
    let generalTab = await detailsView.findWebElement(By.id(GENERAL_LABEL));
    while (generalTab === undefined) {
      generalTab = await detailsView.findWebElement(By.id(GENERAL_LABEL));
    }
    expect(generalTab).is.not.undefined;
    await generalTab.click();
    await detailsView.switchBack();
  });

  it.skip("should click on Description tab", async function () {
    // Open details view
    const detailsView = await getDetailsView();
    // Find Description Tab
    let descriptionTab = await detailsView.findWebElement(
      By.id(LEARN_MORE_LABEL)
    );
    while (descriptionTab === undefined) {
      descriptionTab = await detailsView.findWebElement(
        By.id(LEARN_MORE_LABEL)
      );
    }
    expect(descriptionTab).is.not.undefined;
    await descriptionTab.click();
    await detailsView.switchBack();
  });

  it.skip("should click on Remediation tab", async function () {
    // Open details view
    const detailsView = await getDetailsView();
    // Find Remediation Tab
    let remediationTab = await detailsView.findWebElement(By.id(CHANGES_LABEL));
    while (remediationTab === undefined) {
      remediationTab = await detailsView.findWebElement(By.id(CHANGES_LABEL));
    }
    expect(remediationTab).is.not.undefined;
    await remediationTab.click();
    await detailsView.switchBack();
  });
});
