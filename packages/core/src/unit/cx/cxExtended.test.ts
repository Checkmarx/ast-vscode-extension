/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import "../mocks/vscode-mock";
import "../mocks/cxWrapper-mock";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { initialize, getCx } from "../../cx";
import { Cx } from "../../cx/cx";
import { resetMocks } from "../mocks/vscode-mock";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";
import { Logs } from "../../models/logs";
import { constants } from "../../utils/common/constants";

function getTestCx(): Cx {
  return getCx() as Cx;
}

function createMockContext(secretsGet: () => Promise<string | undefined> = () => Promise.resolve("valid-api-key")) {
  return {
    subscriptions: [],
    extensionUri: vscode.Uri.parse("file:///test"),
    extensionPath: "/test",
    globalState: {
      get: sinon.stub().returns(undefined),
      update: sinon.stub().resolves(),
    },
    secrets: {
      get: secretsGet,
      store: sinon.stub().resolves(),
      delete: sinon.stub().resolves(),
    },
  } as any;
}

describe("Cx - extended platform methods", () => {
  let sandbox: sinon.SinonSandbox;
  let mockLogs: Logs;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    resetMocks();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
    mockLogs = sinon.createStubInstance(Logs);
    initialize(createMockContext());
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("authValidate", () => {
    it("should return true when credentials are valid", async () => {
      const cx = getTestCx();
      const result = await cx.authValidate(mockLogs);
      expect(result).to.be.true;
    });

    it("should return false when credentials are invalid", async () => {
      initialize(createMockContext(() => Promise.resolve("invalid-key")));
      const cx = getTestCx();
      const result = await cx.authValidate(mockLogs);
      expect(result).to.be.false;
    });
  });

  describe("isScanEnabled", () => {
    it("should return false when no token", async () => {
      initialize(createMockContext(() => Promise.resolve(undefined)));
      const cx = getTestCx();
      expect(await cx.isScanEnabled(mockLogs)).to.be.false;
    });

    it("should return true when scans are enabled", async () => {
      const cx = getTestCx();
      expect(await cx.isScanEnabled(mockLogs)).to.be.true;
    });
  });

  describe("isAIGuidedRemediationEnabled", () => {
    it("should return true by default when no token", async () => {
      initialize(createMockContext(() => Promise.resolve(undefined)));
      const cx = getTestCx();
      expect(await cx.isAIGuidedRemediationEnabled(mockLogs)).to.be.true;
    });

    it("should return true when enabled remotely", async () => {
      const cx = getTestCx();
      expect(await cx.isAIGuidedRemediationEnabled(mockLogs)).to.be.true;
    });
  });

  describe("isStandaloneEnabled", () => {
    it("should return false when no token", async () => {
      initialize(createMockContext(() => Promise.resolve(undefined)));
      const cx = getTestCx();
      expect(await cx.isStandaloneEnabled(mockLogs)).to.be.false;
    });

    it("should use cached value when present", async () => {
      const context = createMockContext();
      context.globalState.get.withArgs(constants.getStandaloneEnabledGlobalState()).returns(true);
      initialize(context);
      const cx = getTestCx();
      expect(await cx.isStandaloneEnabled(mockLogs)).to.be.true;
    });

    it("should fetch and cache remote value", async () => {
      const cx = getTestCx();
      expect(await cx.isStandaloneEnabled(mockLogs)).to.be.true;
    });
  });

  describe("isCxOneAssistEnabled", () => {
    it("should return true when remote check succeeds", async () => {
      const cx = getTestCx();
      expect(await cx.isCxOneAssistEnabled(mockLogs)).to.be.true;
    });
  });

  describe("standalone cache", () => {
    it("should clear standalone cache", () => {
      const context = createMockContext();
      initialize(context);
      const cx = getTestCx();
      cx.clearStandaloneEnabledCache();
      expect((context.globalState.update as sinon.SinonStub).called).to.be.true;
    });

    it("should refresh standalone enabled state", async () => {
      const cx = getTestCx();
      const result = await cx.refreshStandaloneEnabled(mockLogs);
      expect(result).to.be.true;
    });
  });

  describe("isAiMcpServerEnabled", () => {
    it("should return false when no token", async () => {
      initialize(createMockContext(() => Promise.resolve(undefined)));
      const cx = getTestCx();
      expect(await cx.isAiMcpServerEnabled()).to.be.false;
    });

    it("should return true when MCP server is enabled", async () => {
      const cx = getTestCx();
      expect(await cx.isAiMcpServerEnabled()).to.be.true;
    });
  });

  describe("isSCAScanEnabled", () => {
    it("should always return true", async () => {
      const cx = getTestCx();
      expect(await cx.isSCAScanEnabled()).to.be.true;
    });
  });

  describe("scanCancel", () => {
    it("should return true when cancel succeeds", async () => {
      const cx = getTestCx();
      expect(await cx.scanCancel("cancel-scan-id")).to.be.true;
    });

    it("should return false when cancel fails", async () => {
      const cx = getTestCx();
      expect(await cx.scanCancel("bad-id")).to.be.false;
    });

    it("should return undefined when scanId is missing", async () => {
      const cx = getTestCx();
      expect(await cx.scanCancel("")).to.be.undefined;
    });
  });

  describe("getProjectListWithParams", () => {
    it("should return projects on success", async () => {
      const cx = getTestCx();
      const projects = await cx.getProjectListWithParams("valid");
      expect(projects).to.have.lengthOf(1);
      expect(projects![0].id).to.equal("proj-1");
    });

    it("should throw on failure", async () => {
      const cx = getTestCx();
      try {
        await cx.getProjectListWithParams("invalid");
        expect.fail("Expected error");
      } catch (error: any) {
        expect(error.message).to.equal("Failed to list projects");
      }
    });
  });

  describe("getBranchesWithParams", () => {
    it("should return branches for valid project", async () => {
      const cx = getTestCx();
      const branches = await cx.getBranchesWithParams("test-project-id");
      expect(branches).to.deep.equal(["main", "develop"]);
    });

    it("should throw when projectId is missing", async () => {
      const cx = getTestCx();
      try {
        await cx.getBranchesWithParams(undefined);
        expect.fail("Expected error");
      } catch (error: any) {
        expect(error.message).to.include("Project ID");
      }
    });
  });

  describe("getScans", () => {
    it("should return scans list", async () => {
      const cx = getTestCx();
      const scans = await cx.getScans("test-project-id", "main");
      expect(scans).to.have.lengthOf(1);
      expect(scans![0].id).to.equal("scan-1");
    });
  });

  describe("getAstConfiguration", () => {
    it("should return undefined when no token", async () => {
      initialize(createMockContext(() => Promise.resolve(undefined)));
      const cx = getTestCx();
      expect(await (cx as any).getAstConfiguration()).to.be.undefined;
    });

    it("should return config when token exists", async () => {
      const cx = getTestCx();
      const config = await (cx as any).getAstConfiguration();
      expect(config?.apiKey).to.equal("valid-api-key");
    });
  });

  describe("triageShow", () => {
    it("should return triage data", async () => {
      const cx = getTestCx();
      const result = await cx.triageShow("proj", "sim", "sast");
      expect(result).to.deep.equal([{ state: "ToVerify" }]);
    });
  });

  describe("triageGetStates", () => {
    it("should return triage states", async () => {
      const cx = getTestCx();
      const result = await cx.triageGetStates(false);
      expect(result?.payload).to.deep.equal(["ToVerify", "Confirmed"]);
    });
  });

  describe("updateStatusBarItem", () => {
    it("should update status bar text and show it", () => {
      const cx = getTestCx();
      const item = { text: "", show: sandbox.stub(), hide: sandbox.stub() } as any;
      cx.updateStatusBarItem("Scanning...", true, item);
      expect(item.text).to.equal("Scanning...");
      expect(item.show.called).to.be.true;
    });

    it("should hide status bar when show is false", () => {
      const cx = getTestCx();
      const item = { text: "", show: sandbox.stub(), hide: sandbox.stub() } as any;
      cx.updateStatusBarItem("Done", false, item);
      expect(item.hide.called).to.be.true;
    });
  });

  describe("getBaseAstConfiguration", () => {
    it("should include agent name and additional parameters", () => {
      sandbox.stub(vscode.workspace, "getConfiguration").returns({
        get: sandbox.stub().returns("extra-params"),
      } as any);
      const cx = getTestCx();
      const config = cx.getBaseAstConfiguration();
      expect(config.additionalParameters).to.equal("extra-params");
      expect(config.agentName).to.exist;
    });
  });

  describe("no-config early returns", () => {
    it("should return empty array from triageShow when no token", async () => {
      initialize(createMockContext(() => Promise.resolve(undefined)));
      const cx = getTestCx();
      expect(await cx.triageShow("p", "s", "sast")).to.deep.equal([]);
    });

    it("should return empty array from getProjectListWithParams when no token", async () => {
      initialize(createMockContext(() => Promise.resolve(undefined)));
      const cx = getTestCx();
      expect(await cx.getProjectListWithParams("valid")).to.deep.equal([]);
    });
  });

  describe("code bashing and remediation", () => {
    it("should return code bashing lesson", async () => {
      const cx = getTestCx();
      const result = await cx.getCodeBashing("89", "java", "sql_injection");
      expect(result).to.deep.equal({ path: "lesson.html" });
    });

    it("should throw when code bashing params missing", async () => {
      const cx = getTestCx();
      try {
        await cx.getCodeBashing("", "java", "q");
        expect.fail("Expected error");
      } catch (error: any) {
        expect(error.message).to.include("Missing mandatory parameters");
      }
    });

    it("should return BFL results", async () => {
      const cx = getTestCx();
      const result = await cx.getResultsBfl("scan", "query", [] as any);
      expect(result).to.deep.equal({ bfl: true });
    });

    it("should run sca remediation", async () => {
      const cx = getTestCx();
      expect(await cx.scaRemediation("pkg.json", "lodash", "4.17.21")).to.equal(0);
    });

    it("should return learn more descriptions", async () => {
      const cx = getTestCx();
      expect(await cx.learnMore("query-1")).to.deep.equal([{ description: "info" }]);
    });
  });

  describe("realtime scan wrappers", () => {
    it("should return kics realtime scan handles", async () => {
      const cx = getTestCx();
      const [result] = await cx.getResultsRealtime("/src", "");
      expect(result).to.exist;
    });

    it("should return kics remediation handles", async () => {
      const cx = getTestCx();
      const [result] = await cx.kicsRemediation("results.json", "file.tf", "kics");
      expect(result).to.exist;
    });

    it("should install asca", async () => {
      const cx = getTestCx();
      const result = await cx.installAsca();
      expect(result).to.deep.equal({ installed: true });
    });

    it("should scan asca source", async () => {
      const cx = getTestCx();
      const result = await cx.scanAsca("/src", ".cxignore");
      expect(result).to.deep.equal({ installed: true });
    });

    it("should return oss scan results", async () => {
      const cx = getTestCx();
      expect(await cx.ossScanResults("/src")).to.deep.equal([]);
    });

    it("should return iac scan results", async () => {
      const cx = getTestCx();
      expect(await cx.iacScanResults("/src", "docker")).to.deep.equal([]);
    });

    it("should return secrets scan results", async () => {
      const cx = getTestCx();
      expect(await cx.secretsScanResults("/src")).to.deep.equal([]);
    });

    it("should return container scan results", async () => {
      const cx = getTestCx();
      expect(await cx.scanContainers("/src")).to.deep.equal([]);
    });
  });
});
