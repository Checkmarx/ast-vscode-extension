"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
const utils_1 = require("./utils/utils");
describe("Welcome view test", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let bench;
    before(async function () {
        this.timeout(8000);
        bench = new vscode_extension_tester_1.Workbench();
    });
    after(async () => {
        await new vscode_extension_tester_1.EditorView().closeAllEditors();
    });
    it("open welcome view and check if exists", async function () {
        const tree = await (0, utils_1.initialize)();
        const welcome = await (tree === null || tree === void 0 ? void 0 : tree.findWelcomeContent());
        (0, chai_1.expect)(welcome).is.not.undefined;
    });
});
//# sourceMappingURL=0.welcome.test.js.map