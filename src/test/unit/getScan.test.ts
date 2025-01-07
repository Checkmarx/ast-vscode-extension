import { expect } from "chai";
import "./mocks/vscode-mock";
import { cx } from "../../../src/cx";

describe("Cx - getScan", () => {
  it("should return scan object when scanId is provided", async () => {
    const scanId = "1";
    const result = await cx.getScan(scanId);

    expect(result).to.deep.equal({
      tags: {},
      groups: undefined,
      id: "1",
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
});
