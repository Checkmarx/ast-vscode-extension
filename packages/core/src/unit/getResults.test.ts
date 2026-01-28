import { expect } from "chai";
import "./mocks/vscode-mock";
import "./mocks/cxWrapper-mock";
import { cx } from "../cx";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("Cx - getResults", () => {
  beforeEach(() => {
    // Set up extension configuration before tests run
    setExtensionConfig({
      extensionId: 'ast-results',
      commandPrefix: 'ast-results',
      viewContainerPrefix: 'ast',
      displayName: 'Checkmarx',
      extensionType: 'checkmarx',
    });
  });

  afterEach(() => {
    resetExtensionConfig();
  });

  it("should get results when scanId is provided", async () => {
    const scanId = "valid-scan-id";
    await cx.getResults(scanId);
    // Since getResults doesn't return anything, we just verify it doesn't throw
  });

  it("should return undefined when scanId is not provided", async () => {
    const result = await cx.getResults(undefined);
    expect(result).to.be.undefined;
  });

  it("should throw error when getting results fails", async () => {
    const scanId = "invalid-scan-id";

    try {
      await cx.getResults(scanId);
      expect.fail("Expected error was not thrown");
    } catch (error) {
      expect(error.message).to.equal("Failed to get results");
    }
  });
});