/* eslint-disable @typescript-eslint/no-explicit-any */
import "./mocks/vscode-mock";
import { expect } from "chai";
import sinon from "sinon";
import * as vscode from "vscode";
import { AiTriageCommand } from "../commands/aiTriageCommand";
import { AiTriageService } from "../services/aiTriageService";
import { AiTriageViewProvider } from "../views/aiTriageView/aiTriageViewProvider";
import { Logs } from "../models/logs";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

const logs = { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} } as unknown as Logs;

function initExtensionConfig(): void {
  setExtensionConfig({
    extensionId: "ast-results",
    commandPrefix: "ast-results",
    viewContainerPrefix: "ast",
    displayName: "Checkmarx",
    extensionType: "checkmarx",
  });
}

function makeContext(overrides?: Partial<vscode.ExtensionContext>): vscode.ExtensionContext {
  return {
    subscriptions: [],
    workspaceState: {
      get: (_key: string) => ({ id: "p", name: "proj", displayScanId: "scan-1" }),
      update: () => Promise.resolve(),
    },
    secrets: { get: () => Promise.resolve("token"), store: () => Promise.resolve(), delete: () => Promise.resolve() },
    ...overrides,
  } as unknown as vscode.ExtensionContext;
}

describe("AiTriageCommand", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    initExtensionConfig();
    AiTriageService.reset();
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
    AiTriageService.reset();
  });

  it("rejects a payload without result identifiers", async () => {
    const errStub = sandbox.stub(vscode.window, "showErrorMessage").resolves(undefined as any);
    const command = new AiTriageCommand(makeContext(), logs);
    const result = await command.triageWithAI({
      resultId: "",
      similarityId: "",
      resultType: "sast",
    });
    expect(result).to.equal(undefined);
    expect(errStub.called).to.equal(true);
  });

  it("rejects unsupported engines", async () => {
    const errStub = sandbox.stub(vscode.window, "showErrorMessage").resolves(undefined as any);
    const command = new AiTriageCommand(makeContext(), logs);
    const result = await command.triageWithAI({
      resultId: "h",
      similarityId: "s",
      resultType: "kics",
    });
    expect(result).to.equal(undefined);
    expect(errStub.called).to.equal(true);
  });

  it("submits, reads back the new state via CLI, and updates the tree result", async () => {
    sandbox.stub(vscode.window, "showInformationMessage").resolves(undefined as any);
    const submitTriage = sandbox.stub().resolves({ status: "accepted" });
    sandbox.stub(AiTriageService, "getInstance").returns({ submitTriage } as any);

    const resultsProvider = {
      loadedResults: [{ similarityId: "sim-1", id: "id-1", state: "To Verify" }],
    };
    const command = new AiTriageCommand(makeContext(), logs, resultsProvider);
    // First call = baseline (empty); after submit a new AI predicate appears.
    const getChanges = sandbox.stub(command as any, "getTriageChanges");
    getChanges.onCall(0).resolves([]);
    getChanges.resolves([{ State: "Not Exploitable" }]);

    const result = await command.triageWithAI({
      resultId: "hash-1",
      similarityId: "sim-1",
      resultType: "sast",
      label: "SQL_Injection",
    });

    expect(submitTriage.calledOnce).to.equal(true);
    expect(result?.stateDisplay).to.equal("Not Exploitable");
    expect(resultsProvider.loadedResults[0].state).to.equal("Not Exploitable");
  });

  it("surfaces service errors without throwing", async () => {
    const errStub = sandbox.stub(vscode.window, "showErrorMessage").resolves(undefined as any);
    const submitTriage = sandbox.stub().rejects(new Error("network down"));
    sandbox.stub(AiTriageService, "getInstance").returns({ submitTriage } as any);

    const command = new AiTriageCommand(makeContext(), logs);
    sandbox.stub(command as any, "getTriageChanges").resolves([]);

    const result = await command.triageWithAI({
      resultId: "hash-1",
      similarityId: "sim-1",
      resultType: "sca",
    });
    expect(result).to.equal(undefined);
    expect(errStub.called).to.equal(true);
  });

  it("register() registers the command handlers on the context", () => {
    const context = makeContext();
    new AiTriageCommand(context, logs).register();
    expect(context.subscriptions.length).to.be.greaterThan(0);
  });
});

describe("AiTriageViewProvider", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    initExtensionConfig();
  });
  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  it("routes a triageWithAI message to the command (no clearBusy on success)", async () => {
    const exec = sandbox
      .stub(vscode.commands, "executeCommand")
      .resolves({ stateDisplay: "Not Exploitable" } as any);
    const provider = new AiTriageViewProvider(makeContext(), logs);
    const posted: any[] = [];
    (provider as any).view = { webview: { postMessage: (m: any) => posted.push(m) } };

    await (provider as any).handleMessage({
      command: "triageWithAI",
      payload: { resultId: "h", similarityId: "sim-1", resultType: "sast" },
    });

    expect(exec.calledWith("ast-results.triageWithAI")).to.equal(true);
    // On success the command drives the refresh; the view does not clear busy.
    expect(posted.some((m) => m.command === "clearBusy")).to.equal(false);
  });

  it("clears the busy row when the command returns no decision", async () => {
    sandbox.stub(vscode.commands, "executeCommand").resolves(undefined as any);
    const provider = new AiTriageViewProvider(makeContext(), logs);
    const posted: any[] = [];
    (provider as any).view = { webview: { postMessage: (m: any) => posted.push(m) } };

    await (provider as any).handleMessage({
      command: "triageWithAI",
      payload: { resultId: "h", similarityId: "sim-1", resultType: "sast" },
    });

    expect(posted).to.deep.include({ command: "clearBusy", similarityId: "sim-1" });
  });

  it("routes a remediateWithAI message to the command", async () => {
    const exec = sandbox.stub(vscode.commands, "executeCommand").resolves(true as any);
    const provider = new AiTriageViewProvider(makeContext(), logs);
    const posted: any[] = [];
    (provider as any).view = { webview: { postMessage: (m: any) => posted.push(m) } };

    await (provider as any).handleMessage({
      command: "remediateWithAI",
      payload: { resultId: "h", similarityId: "sim-1", resultType: "sast" },
    });

    expect(exec.calledWith("ast-results.remediateWithAI")).to.equal(true);
    expect(posted).to.deep.include({ command: "clearBusy", similarityId: "sim-1" });
  });

  it("opens the details panel for a clicked row via newDetails", async () => {
    const exec = sandbox.stub(vscode.commands, "executeCommand").resolves(undefined as any);
    const provider = new AiTriageViewProvider(makeContext(), logs);
    const match = { similarityId: "sim-1", getResultHash: () => "hash-1" };
    (provider as any).detailResults = [match];
    (provider as any).view = { webview: { postMessage: () => {} } };

    await (provider as any).handleMessage({
      command: "openDetails",
      payload: { resultId: "hash-1", similarityId: "sim-1", resultType: "sast" },
    });

    expect(exec.calledWith("ast-results.newDetails", match)).to.equal(true);
  });

  it("renders an authentication message when there is no stored token", async () => {
    const context = makeContext({
      secrets: { get: () => Promise.resolve(undefined) } as any,
    });
    const provider = new AiTriageViewProvider(context, logs);
    let html = "";
    (provider as any).view = {
      webview: {
        set html(value: string) {
          html = value;
        },
        get html() {
          return html;
        },
        postMessage: () => Promise.resolve(true),
      },
    };

    await provider.refresh();
    expect(html).to.contain("Authentication to Checkmarx One is required");
  });
});
