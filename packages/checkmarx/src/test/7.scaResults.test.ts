import { expect } from "chai";
import { initializeSCA } from "./utils/utils";

describe("SCA scan panel test", () => {
  before(async function () {
    this.timeout(100000);
  });

  it("should check if tree and play button exists", async function () {
    const tree = await initializeSCA();
    expect(tree).is.not.undefined;
  });
});
