import { expect } from "chai";
import "./mocks/vscode-mock";
import "./mocks/cxWrapper-mock";
import { cx } from "../cx";

describe("Cx - getBaseAstConfiguration", () => {
  it("should return configuration with additional parameters", async () => {
    const config = cx.getBaseAstConfiguration();
    expect(config).to.not.be.undefined;
    expect(config.additionalParameters).to.equal("valid-api-key");
  });
}); 