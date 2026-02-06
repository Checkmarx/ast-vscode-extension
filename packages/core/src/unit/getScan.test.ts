import { expect } from "chai";
import "./mocks/vscode-mock";
import "./mocks/cxWrapper-mock";
import { cx } from "../cx";
import { resetMocks } from "./mocks/vscode-mock";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("Cx - getScan", () => {
  beforeEach(() => {
    resetMocks();

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

  it("should return scan object when valid scanId is provided", async () => {
    const scanId = "e3b2505a-0634-4b41-8fa1-dfeb2edc26f9";
    const result = await cx.getScan(scanId);

    expect(result).to.deep.equal({
      tags: {},
      groups: undefined,
      id: "e3b2505a-0634-4b41-8fa1-dfeb2edc26f9",
      projectID: "2588deba-1751-4afc-b7e3-db71727a1edd",
      status: "Completed",
      createdAt: "2023-04-19T10:07:37.628413+01:00",
      updatedAt: "2023-04-19T09:08:27.151913Z",
      origin: "grpc-java-netty 1.35.0",
      initiator: "tiago",
      branch: "main",
    });
  });

  it("should return undefined when scanId is not provided", async () => {
    const result = await cx.getScan(undefined);
    expect(result).to.be.undefined;
  });

  it("should return scan undefined when invalid scanId is provided", async () => {
    const scanId = "e3b2505a-0634-4b41-8fa1-dfeb2edc26f7";
    const result = await cx.getScan(scanId);

    expect(result).to.be.undefined;
  });
});
