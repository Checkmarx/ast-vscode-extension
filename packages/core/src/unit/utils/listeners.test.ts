/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  getBranchListener,
  addRealTimeSaveListener,
  setScanButtonDefaultIfScanIsNotRunning,
  gitExtensionListener,
  executeCheckSettingsChange,
} from "../../utils/listener/listeners";
import { cx } from "../../cx";
import { constants } from "../../utils/common/constants";
import * as utils from "../../utils/utils";
import * as globalState from "../../utils/common/globalState";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("listeners", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockLogs: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });

    mockLogs = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };

    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: sandbox.stub().returns(undefined),
        update: sandbox.stub().resolves(),
      },
      globalState: {
        get: sandbox.stub().returns(undefined),
        update: sandbox.stub().resolves(),
      },
    };
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("getBranchListener", () => {
    it("returns a disposable when git extension is available", async () => {
      const mockRepoState = {
        HEAD: { name: "main" },
        onDidChange: sandbox.stub().returns({ dispose: () => {} }),
      } as any;

      sandbox.stub(utils, "getGitAPIRepository").resolves({
        repositories: [{ state: mockRepoState }],
        onDidOpenRepository: () => ({ dispose: () => {} }),
      } as any);

      const disposable = await getBranchListener(mockContext, mockLogs);

      expect(disposable).to.exist;
      expect(disposable.dispose).to.be.a("function");
    });

    it("returns listener when no repositories are open", async () => {
      sandbox.stub(utils, "getGitAPIRepository").resolves({
        repositories: [],
        onDidOpenRepository: sandbox
          .stub()
          .returns({ dispose: () => {} }),
      } as any);

      const disposable = await getBranchListener(mockContext, mockLogs);

      expect(disposable).to.exist;
    });
  });

  describe("setScanButtonDefaultIfScanIsNotRunning", () => {
    it("sets context when no scan is running", async () => {
      sandbox.stub(globalState, "getFromState").returns(null);
      const executeCommandStub = sandbox.stub(
        vscode.commands,
        "executeCommand"
      );

      await setScanButtonDefaultIfScanIsNotRunning(mockContext);

      expect(executeCommandStub.called).to.be.true;
    });

    it("sets context when scan ID is not defined", async () => {
      sandbox.stub(globalState, "getFromState").callsFake((ctx: any, key: string) => {
        if (key === constants.scanCreateIdKey) {
          return { id: "scan-1", name: "", displayScanId: "", scanDatetime: "" };
        }
        return undefined;
      });
      const executeCommandStub = sandbox.stub(
        vscode.commands,
        "executeCommand"
      );

      await setScanButtonDefaultIfScanIsNotRunning(mockContext);

      expect(executeCommandStub.called).to.be.true;
    });

    it("updates state with defaults", async () => {
      sandbox.stub(globalState, "getFromState").returns(null);
      sandbox.stub(vscode.commands, "executeCommand");
      sandbox.stub(globalState, "updateState");

      await setScanButtonDefaultIfScanIsNotRunning(mockContext);

      expect((globalState.updateState as any).called).to.be.true;
    });
  });

  describe("addRealTimeSaveListener", () => {
    it("registers KICS file save listener", () => {
      const onDidSaveStub = sandbox.stub(
        vscode.workspace,
        "onDidSaveTextDocument"
      );
      sandbox.stub(cx, "isStandaloneEnabled").resolves(false);

      addRealTimeSaveListener(mockContext, mockLogs);

      expect(onDidSaveStub.called).to.be.true;
    });

    it("registers KICS file open listener", () => {
      const onDidOpenStub = sandbox.stub(
        vscode.workspace,
        "onDidOpenTextDocument"
      );
      sandbox.stub(cx, "isStandaloneEnabled").resolves(false);

      addRealTimeSaveListener(mockContext, mockLogs);

      expect(onDidOpenStub.called).to.be.true;
    });

    it("skips processing when standalone mode is enabled", async () => {
      sandbox.stub(cx, "isStandaloneEnabled").resolves(true);
      sandbox.stub(globalState, "updateState");

      addRealTimeSaveListener(mockContext, mockLogs);
    });
  });

  describe("executeCheckSettingsChange", () => {
    it("registers configuration change listener", () => {
      const onDidChangeConfigStub = sandbox.stub(
        vscode.workspace,
        "onDidChangeConfiguration"
      );
      const mockStatusBar = {
        text: "",
        dispose: () => {},
        alignment: 0,
        priority: 0,
        id: "test",
        name: "test",
        color: undefined,
        show: () => {},
        hide: () => {},
        tooltip: "",
        command: "",
        backgroundColor: undefined,
      } as any;

      executeCheckSettingsChange(mockContext, mockStatusBar, mockLogs);

      expect(onDidChangeConfigStub.called).to.be.true;
    });
  });

  describe("gitExtensionListener", () => {
    it("activates git extension when available", async () => {
      const mockGitExtension = {
        activate: sandbox.stub().resolves({}),
        exports: {
          enabled: true,
        },
      };

      sandbox
        .stub(vscode.extensions, "getExtension")
        .withArgs("vscode.git")
        .returns(mockGitExtension as any);

      sandbox.stub(utils, "getGitAPIRepository").resolves({
        repositories: [],
        onDidOpenRepository: () => ({ dispose: () => {} }),
      } as any);

      await gitExtensionListener(mockContext, mockLogs);

      expect(mockGitExtension.activate.called).to.be.true;
    });

    it("logs warning when git extension is not found", async () => {
      sandbox.stub(vscode.extensions, "getExtension").returns(undefined);

      await gitExtensionListener(mockContext, mockLogs);

      expect(mockLogs.warn.called).to.be.true;
    });

    it("logs warning when git extension is disabled", async () => {
      const mockGitExtension = {
        activate: sandbox.stub().resolves({}),
        exports: {
          enabled: false,
        },
      };

      sandbox
        .stub(vscode.extensions, "getExtension")
        .withArgs("vscode.git")
        .returns(mockGitExtension as any);

      await gitExtensionListener(mockContext, mockLogs);

      expect(mockLogs.warn.called).to.be.true;
    });
  });
});
