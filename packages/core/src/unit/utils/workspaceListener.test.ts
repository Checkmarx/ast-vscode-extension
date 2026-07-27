import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { WorkspaceListener } from "../../utils/listener/workspaceListener";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("WorkspaceListener", () => {
  let sandbox: sinon.SinonSandbox;
  let listener: WorkspaceListener;
  let mockProvider: { refresh: sinon.SinonStub };
  let mockContext: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
    sandbox.stub(vscode.commands, "executeCommand").resolves();
    listener = new WorkspaceListener();
    mockProvider = { refresh: sandbox.stub() };
    mockContext = {
      workspaceState: {
        get: sandbox.stub(),
      },
    };
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  function stubState(project?: object, branch?: object, preparing?: object, running?: object) {
    mockContext.workspaceState.get.callsFake((key: string) => {
      if (key === constants.projectIdKey) return project;
      if (key === constants.branchIdKey) return branch;
      if (key === constants.scanCreatePrepKey) return preparing;
      if (key === constants.scanCreateIdKey) return running;
      return undefined;
    });
  }

  it("should enable create scan button when project and branch are set", () => {
    stubState({ id: "p1" }, { id: "b1" });
    listener.isScanButtonEnabled(mockContext, mockProvider as any);
    expect(mockProvider.refresh.called).to.be.true;
  });

  it("should enable cancel button when scan is running", () => {
    stubState({ id: "p1" }, { id: "b1" }, undefined, { id: "scan-1" });
    listener.isScanButtonEnabled(mockContext, mockProvider as any);
    expect(mockProvider.refresh.called).to.be.true;
  });

  it("should delegate to isScanButtonEnabled from listener()", () => {    stubState({ id: "p1" }, { id: "b1" });
    listener.listener(mockContext, mockProvider as any);
    expect(mockProvider.refresh.called).to.be.true;
  });
});
