"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
const utils_1 = require("./utils/utils");
const constants_1 = require("./utils/constants");
const waiters_1 = require("./utils/waiters");
const envs_1 = require("./utils/envs");
describe("Scan from IDE", () => {
    let bench;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let treeScans;
    let driver;
    before(async function () {
        this.timeout(100000);
        bench = new vscode_extension_tester_1.Workbench();
        driver = vscode_extension_tester_1.VSBrowser.instance.driver;
        treeScans = await (0, utils_1.initialize)();
        await bench.executeCommand(constants_1.VS_OPEN_FOLDER);
    });
    after(async () => {
        await bench.executeCommand(constants_1.CX_CLEAR);
    });
    it("should run scan from IDE", async function () {
        const treeScan = await (0, utils_1.initialize)();
        await bench.executeCommand(constants_1.CX_LOOK_SCAN);
        const input = await vscode_extension_tester_1.InputBox.create();
        await input.setText(envs_1.SCAN_ID);
        await input.confirm();
        await (0, waiters_1.waitByLinkText)(driver, constants_1.SCAN_KEY_TREE + envs_1.SCAN_ID, 5000);
        let scan = await (treeScan === null || treeScan === void 0 ? void 0 : treeScan.findItem(constants_1.SCAN_KEY_TREE + envs_1.SCAN_ID));
        while (scan === undefined) {
            scan = await (treeScan === null || treeScan === void 0 ? void 0 : treeScan.findItem(constants_1.SCAN_KEY_TREE + envs_1.SCAN_ID));
        }
        // click play button(or initiate scan with command)
        await bench.executeCommand("ast-results.createScan");
        const resultsNotifications = await new vscode_extension_tester_1.Workbench().getNotifications();
        const firstNotification = resultsNotifications[0];
        (0, chai_1.expect)(firstNotification).is.not.undefined;
    });
});
//# sourceMappingURL=6.scan.test.js.map