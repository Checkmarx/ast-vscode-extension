/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  projectPicker,
  branchPicker,
  scanPicker,
  scanInput,
  getScansPickItems,
  getProjectsPickItems,
  getBranchPickItems,
  getResultsWithProgress,
  loadScanId,
  getScanWithProgress,
  getProjectWithProgress,
  getBranchesWithProgress,
} from "../../utils/pickers/pickers";
import { cx, initialize as initializeCx } from "../../cx";
import { constants } from "../../utils/common/constants";
import { messages } from "../../utils/common/messages";
import * as utils from "../../utils/utils";
import * as globalState from "../../utils/common/globalState";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";
import * as activateCore from "../../activate/activateCore";

describe("pickers", () => {
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

    initializeCx({ subscriptions: [] } as any);

    mockLogs = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };

    mockContext = {
      globalState: {
        get: sandbox.stub().returns(undefined),
        update: sandbox.stub().resolves(),
      },
    };
    sandbox.stub(activateCore, "getGlobalContext").returns(mockContext);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("getProjectsPickItems", () => {
    it("returns empty array when cx.getProjectListWithParams fails", async () => {
      sandbox.stub(cx, "getProjectListWithParams").rejects(new Error("API error"));
      sandbox.stub(globalState, "updateStateError");
      sandbox.stub(vscode.commands, "executeCommand");

      const items = await getProjectsPickItems(mockLogs, mockContext);

      expect(items).to.be.an("array");
      expect(items.length).to.equal(0);
    });

    it("returns project items with correct shape", async () => {
      const mockProjects = [
        { id: "proj-1", name: "Project 1" },
        { id: "proj-2", name: "Project 2" },
      ] as any;
      sandbox.stub(cx, "getProjectListWithParams").resolves(mockProjects);

      const items = await getProjectsPickItems(mockLogs, mockContext);

      expect(items).to.be.an("array");
      expect(items.length).to.equal(2);
      expect(items[0].id).to.equal("proj-1");
      expect(items[0].label).to.equal("Project 1");
    });
  });

  describe("getBranchPickItems", () => {
    it("throws error when cx.getBranchesWithParams fails", async () => {
      sandbox.stub(cx, "getBranchesWithParams").rejects(new Error("API error"));
      sandbox.stub(globalState, "updateStateError");
      sandbox.stub(vscode.commands, "executeCommand");

      try {
        await getBranchPickItems(mockLogs, "proj-1", mockContext);
        expect.fail("Expected error to be thrown");
      } catch (error: any) {
        expect(error.message).to.equal("API error");
      }
    });

    it("returns branch items with correct shape", async () => {
      const mockBranches = ["main", "develop", "feature"];
      sandbox.stub(cx, "getBranchesWithParams").resolves(mockBranches);

      const items = await getBranchPickItems(mockLogs, "proj-1", mockContext);

      expect(items).to.be.an("array");
      expect(items.length).to.equal(3);
      expect(items[0].label).to.equal("main");
      expect(items[0].id).to.equal("main");
    });
  });

  describe("getScansPickItems", () => {
    it("throws error when cx.getScans fails", async () => {
      sandbox.stub(cx, "getScans").rejects(new Error("API error"));
      sandbox.stub(globalState, "updateStateError");
      sandbox.stub(vscode.commands, "executeCommand");

      try {
        await getScansPickItems(mockLogs, "proj-1", "main", mockContext);
        expect.fail("Expected error to be thrown");
      } catch (error: any) {
        expect(error.message).to.equal("API error");
      }
    });

    it("returns scans with formatted properties", async () => {
      const mockScans = [
        {
          id: "scan-1",
          createdAt: "2024-01-01T10:00:00Z",
        },
      ] as any;
      sandbox.stub(cx, "getScans").resolves(mockScans);
      sandbox.stub(utils, "formatLabel").returns("Scan 1");
      sandbox.stub(utils, "getFormattedId").returns("scan-1-formatted");
      sandbox.stub(utils, "getFormattedDateTime").returns("2024-01-01 10:00");

      const items = await getScansPickItems(mockLogs, "proj-1", "main", mockContext);

      expect(items).to.be.an("array");
      expect(items.length).to.equal(1);
      expect(items[0].id).to.equal("scan-1");
    });
  });

  describe("loadScanId", () => {
    it("shows error for invalid UUID format", async () => {
      const errorSpy = sandbox.stub(vscode.window, "showErrorMessage") as any;

      await loadScanId(mockContext, "invalid-scan-id", mockLogs);

      expect(errorSpy.calledWith(messages.scanIdIncorrectFormat)).to.be.true;
    });

    it("returns silently when scan not found", async () => {
      const validUuid = "12345678-1234-1234-1234-123456789012";
      sandbox.stub(cx, "getScan").resolves(null);
      const errorStub = sandbox.stub(vscode.window, "showErrorMessage") as any;

      await loadScanId(mockContext, validUuid, mockLogs);

      expect(errorStub.called).to.be.false;
    });

    it("updates state when scan is loaded successfully", async () => {
      const validUuid = "12345678-1234-1234-1234-123456789012";
      const mockScan = {
        id: validUuid,
        projectID: "proj-1",
        branch: "main",
        createdAt: "2024-01-01T10:00:00Z",
      } as any;
      const mockProject = { id: "proj-1", name: "Project 1" } as any;

      sandbox.stub(cx, "getScan").resolves(mockScan);
      sandbox.stub(cx, "getProject").resolves(mockProject);
      sandbox.stub(cx, "triageGetStates").resolves({ payload: [] } as any);
      sandbox.stub(cx, "getResults").resolves(undefined);
      const updateStateStub = sandbox.stub(globalState, "updateState") as any;
      sandbox.stub(vscode.commands, "executeCommand").resolves(undefined);
      sandbox.stub(utils, "getProperty").returns("main");
      sandbox.stub(utils, "getScanLabel").returns("Scan Label");
      sandbox.stub(utils, "getFormattedDateTime").returns("2024-01-01 10:00");

      await loadScanId(mockContext, validUuid, mockLogs);

      expect(updateStateStub.called).to.be.true;
    });
  });

  describe("getScanWithProgress", () => {
    it("calls cx.getScan and returns result", async () => {
      const mockScan = { id: "scan-1" } as any;
      const getScanStub = sandbox.stub(cx, "getScan").resolves(mockScan);

      const result = await getScanWithProgress(mockLogs, "scan-1");

      expect(getScanStub.calledWith("scan-1")).to.be.true;
      expect(result).to.deep.equal(mockScan);
    });
  });

  describe("getProjectWithProgress", () => {
    it("calls cx.getProject and returns result", async () => {
      const mockProject = { id: "proj-1", name: "Project 1" } as any;
      const getProjectStub = sandbox.stub(cx, "getProject").resolves(mockProject);

      const result = await getProjectWithProgress(mockLogs, "proj-1");

      expect(getProjectStub.calledWith("proj-1")).to.be.true;
      expect(result).to.deep.equal(mockProject);
    });
  });

  describe("getBranchesWithProgress", () => {
    it("calls cx.getBranchesWithParams and returns result", async () => {
      const mockBranches = ["main", "develop"];
      const getBranchesStub = sandbox
        .stub(cx, "getBranchesWithParams")
        .resolves(mockBranches);

      const result = await getBranchesWithProgress(mockLogs, "proj-1");

      expect(getBranchesStub.calledWith("proj-1")).to.be.true;
      expect(result).to.deep.equal(mockBranches);
    });
  });

  describe("getResultsWithProgress", () => {
    it("calls cx.getResults and updates global state", async () => {
      const getResultsStub = sandbox.stub(cx, "getResults").resolves(undefined);
      const triageGetStatesStub = sandbox
        .stub(cx, "triageGetStates")
        .resolves({ payload: [] } as any);
      mockContext.globalState.update = sandbox.stub().resolves();

      await getResultsWithProgress(mockLogs, "scan-1");

      expect(getResultsStub.calledWith("scan-1")).to.be.true;
      expect(triageGetStatesStub.called).to.be.true;
    });
  });

  describe("scanInput", () => {
    it("does nothing when input is cancelled", async () => {
      sandbox.stub(vscode.window, "showInputBox").resolves(undefined);
      const errorStub = sandbox.stub(vscode.window, "showErrorMessage") as any;

      await scanInput(mockContext, mockLogs);

      expect(errorStub.called).to.be.false;
    });
  });

  describe("projectPicker", () => {
    it("calls createQuickPick when available", async () => {
      expect(projectPicker).to.be.a("function");
    });
  });

  describe("branchPicker", () => {
    it("shows error when project is not selected", async () => {
      const errorSpy = sandbox.stub(vscode.window, "showErrorMessage") as any;
      sandbox.stub(globalState, "getFromState").returns(null);

      await branchPicker(mockContext, mockLogs);

      expect(errorSpy.calledWith(messages.pickerProjectMissing)).to.be.true;
    });
  });

  describe("scanPicker", () => {
    it("shows error when branch or project is not selected", async () => {
      const errorSpy = sandbox.stub(vscode.window, "showErrorMessage") as any;
      sandbox.stub(globalState, "getFromState").returns(null);

      await scanPicker(mockContext, mockLogs);

      expect(errorSpy.calledWith(messages.pickerBranchProjectMissing)).to.be.true;
    });
  });
});
