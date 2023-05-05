import {
  By,
  CustomTreeSection,
  EditorView,
  InputBox,
  until,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { delay, getDetailsView, getResults, initialize } from "./utils/utils";
import { CHANGES_CONTAINER, CHANGES_LABEL, CODEBASHING_HEADER, COMMENT_BOX, CX_LOOK_SCAN, FIVE_SECONDS, GENERAL_LABEL, LEARN_MORE_LABEL, SAST_TYPE, SCAN_KEY_TREE, THREE_SECONDS, UPDATE_BUTTON, WEBVIEW_TITLE } from "./utils/constants";
import { waitByClassName } from "./utils/waiters";

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
    await bench.executeCommand(CX_LOOK_SCAN);
    let input = await new InputBox();
    await input.setText("1");
    await input.confirm();
  });

  it("should check open webview and codebashing link", async function () {
    // Make sure the results are loaded
    treeScans = await initialize();
    while (treeScans === undefined) {
      treeScans = await initialize();
    }
    let scan = await treeScans?.findItem(
      SCAN_KEY_TREE + "1"
    );
    while (scan === undefined) {
      scan = await treeScans?.findItem(SCAN_KEY_TREE + "1");
    }
    // Get results and open details page
    let sastNode = await scan?.findChildItem(SAST_TYPE);
    if (sastNode === undefined) {
      sastNode = await scan?.findChildItem(SAST_TYPE);
    }
    let result = await getResults(sastNode);
    await delay(THREE_SECONDS);
    let resultName = await result[0].getLabel();
    await result[0].click();
    // Open details view
    let detailsView = await getDetailsView();
    while (detailsView === undefined) {
      detailsView = await getDetailsView();
    }
    // Find details view title
    let titleWebElement = await detailsView.findWebElement(By.id(WEBVIEW_TITLE));
    let title = await titleWebElement.getText();
    expect(title).to.equal(resultName);
    let codebashingWebElement = await detailsView.findWebElement(
      By.id(CODEBASHING_HEADER)
    );
    await delay(FIVE_SECONDS);
    let codebashing = await codebashingWebElement.getText();
    await delay(FIVE_SECONDS);
    expect(codebashing).is.not.undefined;
    await detailsView.switchBack();
    await delay(THREE_SECONDS);
  });

  it("should click on comments", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find Hide comments
    let comments = await detailsView.findWebElement(By.id(COMMENT_BOX));
    while (comments === undefined) {
      comments = await detailsView.findWebElement(By.id(COMMENT_BOX));
    }
    expect(comments).is.not.undefined;
    await comments.click();
    await detailsView.switchBack();
  });

  it("should click on details Learn More tab", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find Learn More Tab
    let learnTab = await detailsView.findWebElement(By.id(LEARN_MORE_LABEL));
    while (learnTab === undefined) {
      learnTab = await detailsView.findWebElement(By.id(LEARN_MORE_LABEL));
    }
    expect(learnTab).is.not.undefined;
    await learnTab.click();
    await detailsView.switchBack();
  });

  it("should click on details Changes tab", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find Changes Tab
    let changesTab = await detailsView.findWebElement(By.id(CHANGES_LABEL));
    while (changesTab === undefined) {
      changesTab = await detailsView.findWebElement(By.id(CHANGES_LABEL));
    }
    await changesTab.click();
    // Make sure that the changes tab is loaded
    await waitByClassName(driver, CHANGES_CONTAINER, 5000);
    expect(changesTab).is.not.undefined;
    await detailsView.switchBack();
  });

  it("should click on update button", async function () {
    // Open details view
    let detailsView = await getDetailsView();
    // Find Changes Tab
    let submit = await detailsView.findWebElement(By.className(UPDATE_BUTTON));
    while (submit === undefined) {
      submit = await detailsView.findWebElement(By.className(UPDATE_BUTTON));
    }
    expect(submit).is.not.undefined;
    await submit.click();
    await detailsView.switchBack();
  });

  it("should click on details General tab", async function () {
    // Open details view
    let detailsView = await getDetailsView();
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
