import {
  By,
  CustomTreeSection,
  EditorView,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { getDetailsView, getResults, initialize, retryTest, sleep } from "./utils/utils";
import { CHANGES_CONTAINER, CHANGES_LABEL, CODEBASHING_HEADER, COMMENT_BOX, CX_LOOK_SCAN, GENERAL_LABEL, LEARN_MORE_LABEL, SAST_TYPE, SCAN_KEY_TREE_LABEL, UPDATE_BUTTON, WEBVIEW_TITLE } from "./utils/constants";
import { waitByClassName } from "./utils/waiters";
import { SCAN_ID } from "./utils/envs";

describe("Scan ID load results test", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  it("should load results from scan ID", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    await bench.executeCommand(CX_LOOK_SCAN);
    let input = await new InputBox();
    // Add delay to ensure input box is ready
    await new Promise((res) => setTimeout(res, 1000));
    await input.setText(SCAN_ID);
    await input.confirm();
    await sleep(5000);
  });

  it.skip("should check open webview and codebashing link", retryTest(async function () {
    // Make sure the results are loaded
    treeScans = await initialize();
    while (treeScans === undefined) {
      treeScans = await initialize();
    }
    let scan = await treeScans?.findItem(
      SCAN_KEY_TREE_LABEL
    );
    // Get results and open details page
    let sastNode = await scan?.findChildItem(SAST_TYPE);
    if (sastNode === undefined) {
      sastNode = await scan?.findChildItem(SAST_TYPE);
    }
    let result = await getResults(sastNode);
    sleep(10000);
    while (!result) {
      result = await getResults(sastNode);
    }
    let resultName = await result[0].getLabel();
    await result[0].click();
    // Open details view
    let detailsView = await getDetailsView();
    while (detailsView === undefined) {
      detailsView = await getDetailsView();
    }
    // Find details view title
    const titleWebElement = await detailsView.findWebElement(
      By.id(WEBVIEW_TITLE)
    );
    const title = await titleWebElement.getText();
    expect(title).to.equal(resultName);
    const codebashingWebElement = await detailsView.findWebElement(
      By.id(CODEBASHING_HEADER)
    );
    let codebashing = await codebashingWebElement.getText();
    expect(codebashing).is.not.undefined;
    await detailsView.switchBack();
  }));

  it.skip("should click on details Learn More tab", async function () {
    // Open details view
    sleep(5000)
    let detailsView = await getDetailsView();
    if (!detailsView) {
      detailsView = await getDetailsView();
    }
    // Find Learn More Tab
    let learnTab = await detailsView.findWebElement(By.id(LEARN_MORE_LABEL));
    while (learnTab === undefined) {
      learnTab = await detailsView.findWebElement(By.id(LEARN_MORE_LABEL));
    }
    expect(learnTab).is.not.undefined;
    await learnTab.click();
    await detailsView.switchBack();
  });

  it.skip("should click on details Changes tab", async function () {
    // Open details view
    const detailsView = await getDetailsView();
    // Find Changes Tab
    let changesTab = await detailsView.findWebElement(By.id(CHANGES_LABEL));
    while (changesTab === undefined) {
      changesTab = await detailsView.findWebElement(By.id(CHANGES_LABEL));
    }
    await changesTab.click();
    // Make sure that the changes tab is loaded
    await waitByClassName(driver, CHANGES_CONTAINER, 5000);
    expect(changesTab).is.not.undefined;
    let submit = await detailsView.findWebElement(By.className(UPDATE_BUTTON));
    while (submit === undefined) {
      submit = await detailsView.findWebElement(By.className(UPDATE_BUTTON));
    }
    expect(submit).is.not.undefined;
    await submit.click();
    // Find Hide comments
    let comments = await detailsView.findWebElement(By.id(COMMENT_BOX));
    while (comments === undefined) {
      comments = await detailsView.findWebElement(By.id(COMMENT_BOX));
    }
    expect(comments).is.not.undefined;
    await comments.click();
    await detailsView.switchBack();
  });

  it.skip("should click on details General tab", async function () {
    // Open details view
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
});
