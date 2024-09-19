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
} from "./utils/utils";
import {
  CHANGES_LABEL,
  CX_LOOK_SCAN,
  GENERAL_LABEL,
  LEARN_MORE_LABEL,
  SCAN_KEY_TREE_LABEL,
  SCS_Type,
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
import { SCAN_ID, CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";

describe("Get SCS results and checking GroupBy , Filter and Open details window", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(8000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await new Workbench().executeCommand("workbench.action.closeActiveEditor");
    await bench.executeCommand(CX_CLEAR);
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  it("should clear groub by for scs and open details window ", async function () {
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

    for (var index in commands) {
      await bench.executeCommand(commands[index]);
    }
  });

  it("should select project", async function () {
    treeScans = await initialize();
    // Execute project selection command
    await bench.executeCommand(CX_SELECT_PROJECT);
    const input = await InputBox.create();
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

  it("should load results from scan ID", async function () {
    await bench.executeCommand(CX_LOOK_SCAN);
    let input = await new InputBox();
    await input.setText(SCAN_ID);
    await input.confirm();
  });

  it("SCS tree with GroupBy command ", async function () {
    treeScans = await initialize();
    while (treeScans === undefined) {
      treeScans = await initialize();
    }
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

    let scsnode = await scan?.findChildItem(SCS_Type);
    if (scsnode === undefined) {
      scsnode = await scan?.findChildItem(SCS_Type);
    }
    await clickFirstVulnerability(scsnode);

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

  it("SCS tree with Filter command", async function () {
    await initialize();
    const commands = [
      CX_FILTER_NOT_EXPLOITABLE,
      CX_FILTER_PROPOSED_NOT_EXPLOITABLE,
      CX_FILTER_CONFIRMED,
      CX_FILTER_TO_VERIFY,
      CX_FILTER_URGENT,
      CX_FILTER_NOT_IGNORED,
    ];
    for (var index in commands) {
      await bench.executeCommand(commands[index]);
      expect(index).not.to.be.undefined;
    }
  });

  it("should click on General tab", async function () {
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

  it("should click on Description tab", async function () {
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

  it("should click on Remediation tab", async function () {
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
