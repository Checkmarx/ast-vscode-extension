"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const utils_1 = require("./utils/utils");
describe("SCA scan panel test", () => {
    before(async function () {
        this.timeout(100000);
    });
    it("should check if tree and play button exists", async function () {
        const tree = await (0, utils_1.initializeSCA)();
        (0, chai_1.expect)(tree).is.not.undefined;
    });
});
//# sourceMappingURL=7.scaResults.test.js.map