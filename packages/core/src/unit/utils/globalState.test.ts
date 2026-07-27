import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  updateState,
  getFromState,
  getErrorFromState,
  updateStateError,
  updateStateFilter,
  Item,
} from "../../utils/common/globalState";
import { constants } from "../../utils/common/constants";

describe("globalState", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockContext = {
      workspaceState: {
        get: sandbox.stub(),
        update: sandbox.stub().resolves(),
      },
      globalState: {
        update: sandbox.stub().resolves(),
      },
    };
    sandbox.stub(vscode.commands, "executeCommand").resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should update and read workspace state items", () => {
    const item = new Item();
    item.id = "id-1";
    item.name = "branch";
    updateState(mockContext, "key", item);
    expect(mockContext.workspaceState.update.calledWith("key", item)).to.be.true;

    mockContext.workspaceState.get.withArgs("key").returns(item);
    expect(getFromState(mockContext, "key")).to.equal(item);
  });

  it("should read and write error state", async () => {
    mockContext.workspaceState.get.withArgs(constants.error).returns("boom");
    expect(getErrorFromState(mockContext)).to.equal("boom");

    await updateStateError(mockContext, "new-error");
    expect(mockContext.workspaceState.update.calledWith(constants.error, "new-error")).to.be.true;
  });

  it("should update filter state and set context", async () => {
    await updateStateFilter(mockContext, "filter.severity.high", true);
    expect(mockContext.globalState.update.calledWith("filter.severity.high", true)).to.be.true;
    expect((vscode.commands.executeCommand as sinon.SinonStub).calledWith("setContext", "filter.severity.high", true)).to.be.true;
  });
});
