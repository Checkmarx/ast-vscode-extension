"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
const utils_1 = require("./utils/utils");
const constants_1 = require("./utils/constants");
const waiters_1 = require("./utils/waiters");
const envs_1 = require("./utils/envs");
describe("Individual pickers load results test", () => {
    let bench;
    let treeScans;
    let driver;
    before(async function () {
        this.timeout(100000);
        bench = new vscode_extension_tester_1.Workbench();
        driver = vscode_extension_tester_1.VSBrowser.instance.driver;
        await bench.executeCommand(constants_1.CX_SELECT_SCAN);
    });
    after(async () => {
        await new vscode_extension_tester_1.EditorView().closeAllEditors();
        await bench.executeCommand(constants_1.CX_CLEAR);
    });
    it("should select project", async function () {
        treeScans = await (0, utils_1.initialize)();
        // Execute project selection command
        await bench.executeCommand(constants_1.CX_SELECT_PROJECT);
        const input = await vscode_extension_tester_1.InputBox.create();
        await input.setText(envs_1.CX_TEST_SCAN_PROJECT_NAME);
        await (0, waiters_1.waitByLinkText)(driver, envs_1.CX_TEST_SCAN_PROJECT_NAME, 5000);
        // Select from the pickers list
        let projectName = await (0, utils_1.getQuickPickSelector)(input);
        await input.setText(projectName);
        await input.confirm();
        // Wait for project selection to be made
        let project = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.PROJECT_KEY_TREE + projectName));
        while (project === undefined) {
            project = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.PROJECT_KEY_TREE + projectName));
        }
        (0, chai_1.expect)(project).is.not.undefined;
    });
    it("should select branch", async function () {
        let treeScans = await (0, utils_1.initialize)();
        // Execute branch selection command
        await bench.executeCommand(constants_1.CX_SELECT_BRANCH);
        let input = await vscode_extension_tester_1.InputBox.create();
        // Select from the pickers list
        let branchName = await (0, utils_1.getQuickPickSelector)(input);
        await input.setText(branchName);
        await (0, waiters_1.waitByLinkText)(driver, branchName, 5000);
        await input.confirm();
        // Wait for branch selection to be made
        let branch = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.BRANCH_KEY_TREE + branchName));
        while (branch === undefined) {
            branch = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.BRANCH_KEY_TREE + branchName));
        }
        (0, chai_1.expect)(branch).is.not.undefined;
    });
    it("should select scan", async function () {
        let treeScans = await (0, utils_1.initialize)();
        // Execute scan selection command
        await bench.executeCommand(constants_1.CX_SELECT_SCAN);
        let input = await vscode_extension_tester_1.InputBox.create();
        // Select from the pickers list
        let scanDate = await (0, utils_1.getQuickPickSelector)(input);
        await input.setText(scanDate);
        await (0, waiters_1.waitByLinkText)(driver, scanDate, 5000);
        await input.confirm();
        // Wait for scan selection to be made
        let scan = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.SCAN_KEY_TREE + scanDate));
        while (scan === undefined) {
            scan = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.SCAN_KEY_TREE + scanDate));
        }
        (0, chai_1.expect)(scan).is.not.undefined;
    });
});
//# sourceMappingURL=3.simpleResults.test.js.map