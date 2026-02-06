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

  it.skip("should clear groub by for scs secret detection and open details window ", async function () {
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
    this.timeout(90000);

    treeScans = await initialize();
    await bench.executeCommand(CX_SELECT_PROJECT);

    let input: InputBox | undefined;
    const maxRetries = 30;
    const retryDelay = 800;

    for (let i = 0; i < maxRetries; i++) {
      try {
        input = await InputBox.create();
        if (input) {
          break;
        }
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!input) {
      throw new Error("InputBox did not open in time after project selection command");
    }

    await input.setText(CX_TEST_SCAN_PROJECT_NAME);

    let projectName: string | undefined;
    const quickPickRetries = 20;

    for (let i = 0; i < quickPickRetries; i++) {
      const projectList = await input.getQuickPicks();
      if (projectList.length > 0) {
        projectName = await projectList[0].getText();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!projectName) {
      throw new Error("Failed to load project list in QuickPickSelector");
    }

    await input.setText(projectName);
    await input.confirm();

    let project: any;
    const treeRetries = 20;
    const treeRetryDelay = 500;

    for (let i = 0; i < treeRetries; i++) {
      project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
      if (project) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, treeRetryDelay));
    }

    expect(project, `Project "${projectName}" should appear in tree view`).is.not.undefined;
  });

  it("should select branch", async function () {
    this.timeout(90000);

    treeScans = await initialize();

    // Select project first (prerequisite for branch selection)
    await bench.executeCommand(CX_SELECT_PROJECT);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let projectInput: InputBox | undefined;
    const maxRetries = 30;
    const retryDelay = 800;

    for (let i = 0; i < maxRetries; i++) {
      try {
        projectInput = await InputBox.create();
        if (projectInput) {
          break;
        }
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!projectInput) {
      throw new Error("Project InputBox did not open in time");
    }

    await projectInput.setText(CX_TEST_SCAN_PROJECT_NAME);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let projectName: string | undefined;
    const quickPickRetries = 20;

    for (let i = 0; i < quickPickRetries; i++) {
      const projectList = await projectInput.getQuickPicks();
      if (projectList.length > 0) {
        projectName = await projectList[0].getText();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!projectName) {
      throw new Error("Failed to load project list");
    }

    await projectInput.setText(projectName);
    await projectInput.confirm();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Select branch
    await bench.executeCommand(CX_SELECT_BRANCH);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let branchInput: InputBox | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        branchInput = await InputBox.create();
        if (branchInput) {
          break;
        }
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!branchInput) {
      throw new Error("Branch InputBox did not open in time after branch selection command");
    }

    await branchInput.setText(CX_TEST_SCAN_BRANCH_NAME);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let branchName: string | undefined;

    for (let i = 0; i < quickPickRetries; i++) {
      const branchList = await branchInput.getQuickPicks();
      if (branchList.length > 0) {
        branchName = await branchList[0].getText();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!branchName) {
      throw new Error("Failed to load branch list in QuickPickSelector");
    }

    await branchInput.setText(branchName);
    await branchInput.confirm();

    let branch: any;
    const treeRetries = 20;
    const treeRetryDelay = 500;

    for (let i = 0; i < treeRetries; i++) {
      branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
      if (branch) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, treeRetryDelay));
    }

    expect(branch, `Branch "${branchName}" should appear in tree view`).is.not.undefined;
  });

  it("should select scan", async function () {
    this.timeout(120000);

    treeScans = await initialize();

    // Select project (prerequisite)
    await bench.executeCommand(CX_SELECT_PROJECT);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let projectInput: InputBox | undefined;
    const maxRetries = 30;
    const retryDelay = 800;

    for (let i = 0; i < maxRetries; i++) {
      try {
        projectInput = await InputBox.create();
        if (projectInput) {
          break;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(
            `Failed to create project InputBox after ${maxRetries} attempts: ${error}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!projectInput) {
      throw new Error("Project InputBox is undefined after all retries");
    }

    await projectInput.setText(CX_TEST_SCAN_PROJECT_NAME);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let projectName: string | undefined;
    const quickPickRetries = 20;
    const quickPickDelay = 500;

    for (let i = 0; i < quickPickRetries; i++) {
      try {
        projectName = await getQuickPickSelector(projectInput);
        if (projectName && projectName.trim() !== "") {
          break;
        }
      } catch (error) {
        if (i === quickPickRetries - 1) {
          throw new Error(
            `Failed to get project quick pick after ${quickPickRetries} attempts: ${error}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, quickPickDelay));
      }
    }

    if (!projectName || projectName.trim() === "") {
      throw new Error("Project name is empty after all retries");
    }

    await projectInput.setText(projectName);
    await projectInput.confirm();

    let project;
    const treeRetries = 20;
    const treeDelay = 500;

    for (let i = 0; i < treeRetries; i++) {
      try {
        project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
        if (project) {
          break;
        }
      } catch (error) {
        // Continue retrying
      }
      await new Promise((resolve) => setTimeout(resolve, treeDelay));
    }

    expect(project).is.not.undefined;

    // Select branch (prerequisite)
    await bench.executeCommand(CX_SELECT_BRANCH);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let branchInput: InputBox | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        branchInput = await InputBox.create();
        if (branchInput) {
          break;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(
            `Failed to create branch InputBox after ${maxRetries} attempts: ${error}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!branchInput) {
      throw new Error("Branch InputBox is undefined after all retries");
    }

    await branchInput.setText(CX_TEST_SCAN_BRANCH_NAME);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let branchName: string | undefined;

    for (let i = 0; i < quickPickRetries; i++) {
      try {
        branchName = await getQuickPickSelector(branchInput);
        if (branchName && branchName.trim() !== "") {
          break;
        }
      } catch (error) {
        if (i === quickPickRetries - 1) {
          throw new Error(
            `Failed to get branch quick pick after ${quickPickRetries} attempts: ${error}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, quickPickDelay));
      }
    }

    if (!branchName || branchName.trim() === "") {
      throw new Error("Branch name is empty after all retries");
    }

    await branchInput.setText(branchName);
    await branchInput.confirm();

    let branch;

    for (let i = 0; i < treeRetries; i++) {
      try {
        branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
        if (branch) {
          break;
        }
      } catch (error) {
        // Continue retrying
      }
      await new Promise((resolve) => setTimeout(resolve, treeDelay));
    }

    expect(branch).is.not.undefined;

    // Select scan
    await bench.executeCommand(CX_SELECT_SCAN);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let scanInput: InputBox | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        scanInput = await InputBox.create();
        if (scanInput) {
          break;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(
            `Failed to create scan InputBox after ${maxRetries} attempts: ${error}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!scanInput) {
      throw new Error("Scan InputBox is undefined after all retries");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    let scanLabel: string | undefined;

    for (let i = 0; i < quickPickRetries; i++) {
      try {
        scanLabel = await getQuickPickSelector(scanInput);
        if (scanLabel && scanLabel.trim() !== "") {
          break;
        }
      } catch (error) {
        if (i === quickPickRetries - 1) {
          throw new Error(
            `Failed to get scan quick pick after ${quickPickRetries} attempts: ${error}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, quickPickDelay));
      }
    }

    if (!scanLabel || scanLabel.trim() === "") {
      throw new Error("Scan label is empty after all retries");
    }

    await scanInput.setText(scanLabel);
    await scanInput.confirm();

    const scanParts: string[] = scanLabel.split(" ");
    const formattedId: string = scanParts.slice(-2).join(" ");

    let scan;

    for (let i = 0; i < treeRetries; i++) {
      try {
        scan = await treeScans?.findItem(SCAN_KEY_TREE + formattedId);
        if (scan) {
          break;
        }
      } catch (error) {
        // Continue retrying
      }
      await new Promise((resolve) => setTimeout(resolve, treeDelay));
    }

    expect(scan).is.not.undefined;
  });

  it("should load results from scan ID", async function () {
    this.timeout(90000);

    treeScans = await initialize();
    await bench.executeCommand(CX_LOOK_SCAN);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let input: InputBox | undefined;
    const maxRetries = 30;
    const retryDelay = 800;

    for (let i = 0; i < maxRetries; i++) {
      try {
        input = await InputBox.create();
        if (input) {
          break;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(
            `Failed to create InputBox after ${maxRetries} attempts: ${error}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!input) {
      throw new Error("InputBox is undefined after all retries");
    }

    await input.setText(SCAN_ID);
    await input.confirm();
    await new Promise((resolve) => setTimeout(resolve, 5000));

    let scan;
    const treeRetries = 20;
    const treeDelay = 500;

    for (let i = 0; i < treeRetries; i++) {
      try {
        scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
        if (scan) {
          break;
        }
      } catch (error) {
        // Continue retrying
      }
      await new Promise((resolve) => setTimeout(resolve, treeDelay));
    }

    expect(scan).is.not.undefined;
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

  it.skip("Secret detection tree with Filter command", async function () {
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
