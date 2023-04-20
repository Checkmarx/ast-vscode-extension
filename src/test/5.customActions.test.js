"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
const utils_1 = require("./utils/utils");
const constants_1 = require("./utils/constants");
const waiters_1 = require("./utils/waiters");
const envs_1 = require("./utils/envs");
describe("filter and groups actions tests", () => {
    let bench;
    let treeScans;
    let driver;
    before(async function () {
        this.timeout(100000);
        bench = new vscode_extension_tester_1.Workbench();
        driver = vscode_extension_tester_1.VSBrowser.instance.driver;
        treeScans = await (0, utils_1.initialize)();
        await bench.executeCommand(constants_1.CX_LOOK_SCAN);
    });
    after(async () => {
        await bench.executeCommand(constants_1.CX_CLEAR);
    });
    it("should click on all filter severity", async function () {
        treeScans = await (0, utils_1.initialize)();
        while (treeScans === undefined) {
            treeScans = await (0, utils_1.initialize)();
        }
        await bench.executeCommand(constants_1.CX_LOOK_SCAN);
        let input = await vscode_extension_tester_1.InputBox.create();
        await input.setText(envs_1.SCAN_ID);
        await input.confirm();
        await (0, waiters_1.waitByLinkText)(driver, constants_1.SCAN_KEY_TREE + envs_1.SCAN_ID, 15000);
        const commands = [
            { command: constants_1.CX_FILTER_INFO, text: "INFO" },
            { command: constants_1.CX_FILTER_LOW, text: "LOW" },
            { command: constants_1.CX_FILTER_MEDIUM, text: "MEDIUM" },
            { command: constants_1.CX_FILTER_HIGH, text: "HIGH" },
        ];
        for (var index in commands) {
            await bench.executeCommand(commands[index].command);
            treeScans = await (0, utils_1.initialize)();
            let scan = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.SCAN_KEY_TREE + envs_1.SCAN_ID));
            while (scan === undefined) {
                scan = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.SCAN_KEY_TREE + envs_1.SCAN_ID));
            }
            let isValidated = await (0, utils_1.validateSeverities)(scan, commands[index].text);
            (0, chai_1.expect)(isValidated).to.equal(true);
            // Reset filters
            await bench.executeCommand(commands[index].command);
        }
    });
    it("should click on all group by", async function () {
        const commands = [
            constants_1.CX_GROUP_LANGUAGE,
            constants_1.CX_GROUP_STATUS,
            constants_1.CX_GROUP_STATE,
            constants_1.CX_GROUP_QUERY_NAME,
            constants_1.CX_GROUP_FILE,
        ];
        // Get scan node
        const treeScans = await (0, utils_1.initialize)();
        let scan = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.SCAN_KEY_TREE + envs_1.SCAN_ID));
        while (scan === undefined) {
            scan = await (treeScans === null || treeScans === void 0 ? void 0 : treeScans.findItem(constants_1.SCAN_KEY_TREE + envs_1.SCAN_ID));
        }
        // Expand and validate scan node to obtain engine nodes
        let tuple = await (0, utils_1.validateRootNode)(scan);
        //let level = 0;
        // Get the sast results node, because it is the only one affected by all the group by commands
        let sastNode = await (scan === null || scan === void 0 ? void 0 : scan.findChildItem(constants_1.SAST_TYPE));
        while (sastNode === undefined) {
            sastNode = await (scan === null || scan === void 0 ? void 0 : scan.findChildItem(constants_1.SAST_TYPE));
        }
        // Validate for all commands the nested tree elements
        for (var index in commands) {
            // Execute the group by command for each command
            await bench.executeCommand(commands[index]);
            await (0, utils_1.delay)(1000);
        }
        // Size must not be bigger than 3 because there are at most 3 engines in the first node
        (0, chai_1.expect)(tuple[0]).to.be.at.most(4);
    });
    it("should click on all filter state", async function () {
        await (0, utils_1.initialize)();
        const commands = [
            constants_1.CX_FILTER_NOT_EXPLOITABLE,
            constants_1.CX_FILTER_PROPOSED_NOT_EXPLOITABLE,
            constants_1.CX_FILTER_CONFIRMED,
            constants_1.CX_FILTER_TO_VERIFY,
            constants_1.CX_FILTER_URGENT,
            constants_1.CX_FILTER_NOT_IGNORED,
        ];
        for (var index in commands) {
            await bench.executeCommand(commands[index]);
            (0, chai_1.expect)(index).not.to.be.undefined;
        }
    });
});
//# sourceMappingURL=5.customActions.test.js.map