"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
const utils_1 = require("./utils/utils");
const constants_1 = require("./utils/constants");
const waiters_1 = require("./utils/waiters");
describe("Scan ID load results test", () => {
    let bench;
    let treeScans;
    let driver;
    before(async function () {
        this.timeout(100000);
        bench = new vscode_extension_tester_1.Workbench();
        driver = vscode_extension_tester_1.VSBrowser.instance.driver;
        await bench.executeCommand(constants_1.CX_LOOK_SCAN);
    });
    after(async () => {
        await new vscode_extension_tester_1.EditorView().closeAllEditors();
    });
    it("should load results from scan ID", async function () {
        await bench.executeCommand(constants_1.CX_LOOK_SCAN);
        const input = await new vscode_extension_tester_1.InputBox();
        await input.setText("6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c");
        await input.confirm();
    });
    it("should check open webview and codebashing link", async function () {
        // Make sure the results are loaded
        treeScans = await (0, utils_1.initialize)();
        while (treeScans === undefined) {
            treeScans = await (0, utils_1.initialize)();
        }
        let scan = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.SCAN_KEY_TREE + "6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"));
        while (scan === undefined) {
            scan = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.SCAN_KEY_TREE + "6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"));
        }
        // Get results and open details page
        let sastNode = await (scan === null || scan === void 0 ? void 0 : scan.findChildItem(constants_1.SAST_TYPE));
        if (sastNode === undefined) {
            sastNode = await (scan === null || scan === void 0 ? void 0 : scan.findChildItem(constants_1.SAST_TYPE));
        }
        const result = await (0, utils_1.getResults)(sastNode);
        await (0, utils_1.delay)(constants_1.THREE_SECONDS);
        const resultName = await result[0].getLabel();
        await result[0].click();
        // Open details view
        let detailsView = await (0, utils_1.getDetailsView)();
        while (detailsView === undefined) {
            detailsView = await (0, utils_1.getDetailsView)();
        }
        // Find details view title
        const titleWebElement = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.WEBVIEW_TITLE));
        const title = await titleWebElement.getText();
        (0, chai_1.expect)(title).to.equal(resultName);
        const codebashingWebElement = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.CODEBASHING_HEADER));
        await (0, utils_1.delay)(constants_1.FIVE_SECONDS);
        const codebashing = await codebashingWebElement.getText();
        await (0, utils_1.delay)(constants_1.FIVE_SECONDS);
        (0, chai_1.expect)(codebashing).is.not.undefined;
        await detailsView.switchBack();
        await (0, utils_1.delay)(constants_1.THREE_SECONDS);
    });
    it("should click on comments", async function () {
        // Open details view
        const detailsView = await (0, utils_1.getDetailsView)();
        // Find Hide comments
        let comments = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.COMMENT_BOX));
        while (comments === undefined) {
            comments = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.COMMENT_BOX));
        }
        (0, chai_1.expect)(comments).is.not.undefined;
        await comments.click();
        await detailsView.switchBack();
    });
    it("should click on details Learn More tab", async function () {
        // Open details view
        const detailsView = await (0, utils_1.getDetailsView)();
        // Find Learn More Tab
        let learnTab = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.LEARN_MORE_LABEL));
        while (learnTab === undefined) {
            learnTab = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.LEARN_MORE_LABEL));
        }
        (0, chai_1.expect)(learnTab).is.not.undefined;
        await learnTab.click();
        await detailsView.switchBack();
    });
    it("should click on details Changes tab", async function () {
        // Open details view
        const detailsView = await (0, utils_1.getDetailsView)();
        // Find Changes Tab
        let changesTab = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.CHANGES_LABEL));
        while (changesTab === undefined) {
            changesTab = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.CHANGES_LABEL));
        }
        await changesTab.click();
        // Make sure that the changes tab is loaded
        await (0, waiters_1.waitByClassName)(driver, constants_1.CHANGES_CONTAINER, 5000);
        (0, chai_1.expect)(changesTab).is.not.undefined;
        await detailsView.switchBack();
    });
    it("should click on update button", async function () {
        // Open details view
        const detailsView = await (0, utils_1.getDetailsView)();
        // Find Changes Tab
        let submit = await detailsView.findWebElement(vscode_extension_tester_1.By.className(constants_1.UPDATE_BUTTON));
        while (submit === undefined) {
            submit = await detailsView.findWebElement(vscode_extension_tester_1.By.className(constants_1.UPDATE_BUTTON));
        }
        (0, chai_1.expect)(submit).is.not.undefined;
        await submit.click();
        await detailsView.switchBack();
    });
    it("should click on details General tab", async function () {
        // Open details view
        const detailsView = await (0, utils_1.getDetailsView)();
        // Find General Tab
        let generalTab = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.GENERAL_LABEL));
        while (generalTab === undefined) {
            generalTab = await detailsView.findWebElement(vscode_extension_tester_1.By.id(constants_1.GENERAL_LABEL));
        }
        (0, chai_1.expect)(generalTab).is.not.undefined;
        await generalTab.click();
        await detailsView.switchBack();
    });
});
//# sourceMappingURL=4.scanIDResult.test.js.map