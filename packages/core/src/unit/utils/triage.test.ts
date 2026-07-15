/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  buildScaVulnerabilityString,
  triageSubmit,
  triageShow,
  triageSCAShow,
  updateResults,
  updateSCAResults,
} from "../../utils/triage";
import { cx, initialize as initializeCx } from "../../cx";
import { constants } from "../../utils/common/constants";
import { messages } from "../../utils/common/messages";
import * as utils from "../../utils/utils";
import * as globalState from "../../utils/common/globalState";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("triage", () => {
  let sandbox: sinon.SinonSandbox;
  const fs = require("fs");
  let origExistsSync: any;

  const makeLogs = () => ({
    info: sandbox.stub(),
    warn: sandbox.stub(),
    error: sandbox.stub(),
  });

  // A minimal AstResult-like object with controllable behavior.
  const makeResult = (overrides: any = {}) => {
    const r: any = {
      type: constants.sast,
      severity: "HIGH",
      state: "TO_VERIFY",
      similarityId: "sim-1",
      id: "id-1",
      status: "NEW",
      label: "My_Query_Name",
      scaNode: undefined,
      data: { packageIdentifier: "", resultHash: "hash-1" },
      setSeverity(s: string) { this.severity = s; },
      setState(s: string) { this.state = s; },
      getResultHash() { return "hash-1"; },
      ...overrides,
    };
    return r;
  };

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

    origExistsSync = fs.existsSync;
    fs.existsSync = sandbox.stub().returns(true);
    sandbox.stub(utils, "getResultsFilePath").returns("/tmp/results.json");
  });

  afterEach(() => {
    fs.existsSync = origExistsSync;
    resetExtensionConfig();
    sandbox.restore();
  });

  describe("buildScaVulnerabilityString", () => {
    it("builds string from scaNode packageIdentifier (manager-name-version)", () => {
      const result = makeResult({
        scaNode: { packageIdentifier: "npm-lodash-4.17.0" },
        similarityId: "vuln-99",
      });
      const out = buildScaVulnerabilityString(result);
      expect(out).to.equal(
        "packagename=lodash,packageversion=4.17.0,vulnerabilityId=vuln-99,packagemanager=npm"
      );
    });

    it("falls back to data.packageIdentifier when scaNode is missing", () => {
      const result = makeResult({
        scaNode: undefined,
        data: { packageIdentifier: "maven-guava-31.1", resultHash: "h" },
        similarityId: "",
        id: "id-x",
      });
      const out = buildScaVulnerabilityString(result);
      expect(out).to.equal(
        "packagename=guava,packageversion=31.1,vulnerabilityId=id-x,packagemanager=maven"
      );
    });

    it("handles empty package identifier gracefully", () => {
      const result = makeResult({
        scaNode: { packageIdentifier: "" },
        data: { packageIdentifier: "", resultHash: "h" },
        similarityId: "",
        id: "",
      });
      const out = buildScaVulnerabilityString(result);
      expect(out).to.equal(
        "packagename=,packageversion=,vulnerabilityId=,packagemanager="
      );
    });

    it("uses similarityId in preference to id", () => {
      const result = makeResult({
        scaNode: { packageIdentifier: "npm-react-18.0.0" },
        similarityId: "sim-A",
        id: "id-B",
      });
      const out = buildScaVulnerabilityString(result);
      expect(out).to.contain("vulnerabilityId=sim-A");
    });
  });

  describe("triageShow / triageSCAShow wrappers", () => {
    it("triageShow delegates to cx.triageShow with similarityId and type", async () => {
      const stub = sandbox.stub(cx, "triageShow").resolves([] as any);
      const result = makeResult({ similarityId: "sim-77", type: constants.sast });
      await triageShow("proj-1", result);
      expect(stub.calledOnceWith("proj-1", "sim-77", constants.sast)).to.be.true;
    });

    it("triageSCAShow delegates to cx.triageSCAShow with the vulnerability string", async () => {
      const stub = sandbox.stub(cx, "triageSCAShow").resolves([] as any);
      const result = makeResult({ scaNode: { packageIdentifier: "npm-lodash-4.17.0" } });
      await triageSCAShow("proj-2", result);
      expect(stub.calledOnce).to.be.true;
      const args = stub.firstCall.args as any[];
      expect(args[0]).to.equal("proj-2");
      expect(args[1]).to.contain("packagename=lodash");
      expect(args[2]).to.equal(constants.sca);
    });
  });

  describe("updateResults", () => {
    it("throws when results file does not exist", async () => {
      (fs.existsSync as sinon.SinonStub).returns(false);
      const result = makeResult();
      try {
        await updateResults(result, {} as any, "comment", { loadedResults: [] } as any);
        expect.fail("expected throw");
      } catch (err: any) {
        expect(err.message).to.equal(messages.fileNotFound);
      }
    });

    it("calls cx.triageUpdate and updates the matching local result", async () => {
      const triageStub = sandbox.stub(cx, "triageUpdate").resolves(undefined as any);
      sandbox.stub(globalState, "getFromState").returns({ id: "proj-9" } as any);
      sandbox.stub(utils, "getStateIdForTriage").returns(3);

      const result = makeResult({ severity: "LOW", state: "CONFIRMED", status: "DONE" });
      const existing = makeResult({ severity: "HIGH", state: "TO_VERIFY", status: "NEW" });
      const provider: any = { loadedResults: [existing] };

      await updateResults(result, {} as any, "my comment", provider);

      expect(triageStub.calledOnce).to.be.true;
      const args = triageStub.firstCall.args as any[];
      expect(args[0]).to.equal("proj-9");
      expect(args[6]).to.equal(3);
      expect(provider.loadedResults[0].severity).to.equal("LOW");
      expect(provider.loadedResults[0].state).to.equal("CONFIRMED");
      expect(provider.loadedResults[0].status).to.equal("DONE");
    });
  });

  describe("updateSCAResults", () => {
    it("calls cx.triageSCAUpdate with the vulnerability string", async () => {
      const triageStub = sandbox.stub(cx, "triageSCAUpdate").resolves(undefined as any);
      sandbox.stub(globalState, "getFromState").returns({ id: "proj-11" } as any);

      const result = makeResult({
        type: constants.sca,
        scaNode: { packageIdentifier: "npm-axios-1.0.0" },
      });
      const provider: any = { loadedResults: [makeResult()] };

      await updateSCAResults(result, {} as any, "sca comment", provider);

      expect(triageStub.calledOnce).to.be.true;
      const args = triageStub.firstCall.args as any[];
      expect(args[0]).to.equal("proj-11");
      expect(args[1]).to.contain("packagename=axios");
      expect(args[4]).to.equal("sca comment");
    });
  });

  describe("triageSubmit", () => {
    const makeData = (overrides: any = {}) => ({
      comment: "a note",
      severitySelection: "",
      stateSelection: "",
      ...overrides,
    });

    const makeDetailsPanel = () => ({
      title: "(HIGH) My Query Name",
      webview: {
        html: "",
        postMessage: sandbox.stub().resolves(),
      },
    });

    const makeDetached = () => ({
      setResult: sandbox.stub(),
      setLoad: sandbox.stub(),
      getDetailsWebviewContent: sandbox.stub().resolves("<html></html>"),
    });

    it("rejects SCA submit with empty comment", async () => {
      const errSpy = sandbox.stub(vscode.window, "showErrorMessage");
      const result = makeResult({ type: constants.sca });
      const logs = makeLogs();

      await triageSubmit(
        result,
        {} as any,
        makeData({ comment: "   ", stateSelection: "CONFIRMED" }) as any,
        logs as any,
        makeDetailsPanel() as any,
        makeDetached() as any,
        { loadedResults: [] } as any
      );

      expect(errSpy.calledWith(messages.scaNoteMandatory)).to.be.true;
    });

    it("shows 'no change' when nothing changed (non-SCA)", async () => {
      const errSpy = sandbox.stub(vscode.window, "showErrorMessage");
      const result = makeResult({ type: constants.sast });
      const logs = makeLogs();

      await triageSubmit(
        result,
        {} as any,
        makeData({ severitySelection: "", stateSelection: "" }) as any,
        logs as any,
        makeDetailsPanel() as any,
        makeDetached() as any,
        { loadedResults: [] } as any
      );

      expect(errSpy.calledWith(messages.triageNoChange)).to.be.true;
    });

    it("shows 'no change' for SCA when only comment provided but no state change", async () => {
      const errSpy = sandbox.stub(vscode.window, "showErrorMessage");
      const result = makeResult({ type: constants.sca, state: "CONFIRMED" });
      const logs = makeLogs();

      await triageSubmit(
        result,
        {} as any,
        // stateSelection equals current state -> no actual state change
        makeData({ comment: "note", stateSelection: "CONFIRMED" }) as any,
        logs as any,
        makeDetailsPanel() as any,
        makeDetached() as any,
        { loadedResults: [] } as any
      );

      expect(errSpy.calledWith(messages.triageNoChange)).to.be.true;
    });

    it("submits a SAST severity change successfully", async () => {
      const infoSpy = sandbox.stub(vscode.window, "showInformationMessage");
      sandbox.stub(vscode.window, "showErrorMessage");
      sandbox.stub(globalState, "getFromState").returns({ id: "proj-5" } as any);
      sandbox.stub(globalState, "updateState");
      sandbox.stub(utils, "getStateIdForTriage").returns(7);
      sandbox.stub(cx, "triageUpdate").resolves(undefined as any);
      // triageShow used by getChanges
      sandbox.stub(cx, "triageShow").resolves([] as any);

      const result = makeResult({ type: constants.sast, severity: "HIGH" });
      const logs = makeLogs();
      const detached = makeDetached();
      const panel = makeDetailsPanel();

      await triageSubmit(
        result,
        {} as any,
        makeData({ severitySelection: "LOW", stateSelection: "" }) as any,
        logs as any,
        panel as any,
        detached as any,
        { loadedResults: [] } as any
      );

      expect(result.severity).to.equal("LOW");
      expect(infoSpy.calledWith(messages.triageSubmitedSuccess)).to.be.true;
      expect(detached.setResult.called).to.be.true;
    });

    it("shows triage error when underlying update throws", async () => {
      const errSpy = sandbox.stub(vscode.window, "showErrorMessage");
      sandbox.stub(globalState, "getFromState").returns({ id: "proj-5" } as any);
      sandbox.stub(utils, "getStateIdForTriage").returns(7);
      sandbox.stub(cx, "triageUpdate").rejects(new Error("boom"));

      const result = makeResult({ type: constants.sast, severity: "HIGH" });
      const logs = makeLogs();

      await triageSubmit(
        result,
        {} as any,
        makeData({ severitySelection: "LOW", stateSelection: "" }) as any,
        logs as any,
        makeDetailsPanel() as any,
        makeDetached() as any,
        { loadedResults: [] } as any
      );

      expect(errSpy.called).to.be.true;
    });
  });
});
