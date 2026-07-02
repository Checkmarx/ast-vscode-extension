import "./mocks/vscode-mock";
import { expect } from "chai";
import sinon from "sinon";
import * as vscode from "vscode";
import { DiagnosticCommand } from "../commands/diagnosticCommand";
import { Logs } from "../models/logs";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { SCAResultsProvider } from "../views/scaView/scaResultsProvider";
import { TreeItem } from "../utils/tree/treeItem";
import { commands } from "../utils/common/commandBuilder";
import { constants } from "../utils/common/constants";
import { setExtensionConfig, EXTENSION_TYPE, resetExtensionConfig } from "../config/extensionConfig";

describe("DiagnosticCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockLogs: any;
  let mockAstResultsProvider: any;
  let mockScaResultsProvider: any;
  let mockAstTree: any;
  let mockScaTree: any;
  let diagnosticCommand: DiagnosticCommand;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    setExtensionConfig({
      extensionId: 'test-diagnostic-command',
      commandPrefix: 'test',
      viewContainerPrefix: 'test',
      displayName: 'Test Extension',
      extensionType: EXTENSION_TYPE.CHECKMARX,
    });

    mockContext = {
      subscriptions: [],
    };

    mockLogs = {
      output: {
        appendLine: sandbox.stub(),
        show: sandbox.stub(),
      },
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub(),
      log: sandbox.stub(),
      show: sandbox.stub(),
    } as any as Logs;

    mockAstResultsProvider = {
      handleOpenDetailsFromDiagnostic: sandbox.stub().resolves(false),
    };

    mockScaResultsProvider = {
      handleOpenDetailsFromDiagnostic: sandbox.stub().resolves(false),
    };

    mockAstTree = {
      reveal: sandbox.stub(),
      selection: [],
    };

    mockScaTree = {
      reveal: sandbox.stub(),
      selection: [],
    };

    sandbox.stub(vscode.commands, "registerCommand");

    diagnosticCommand = new DiagnosticCommand(
      mockContext,
      mockLogs,
      mockAstResultsProvider,
      mockScaResultsProvider,
      mockAstTree,
      mockScaTree
    );
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("constructor", () => {
    it("should initialize with all dependencies", () => {
      expect(diagnosticCommand["context"]).to.equal(mockContext);
      expect(diagnosticCommand["logs"]).to.equal(mockLogs);
      expect(diagnosticCommand["astResultsProvider"]).to.equal(
        mockAstResultsProvider
      );
      expect(diagnosticCommand["scaResultsProvider"]).to.equal(
        mockScaResultsProvider
      );
      expect(diagnosticCommand["astTree"]).to.equal(mockAstTree);
      expect(diagnosticCommand["scaTree"]).to.equal(mockScaTree);
    });
  });

  describe("registerOpenDetailsFromDiagnostic", () => {
    it("should register openDetailsFromDiagnostic command", () => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      expect(registerStub.called).to.be.true;
    });

    it("should register correct command name", () => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);

      expect(call.args[0]).to.equal(commands.openDetailsFromDiagnostic);
    });

    it("should add subscription to context", () => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });

    it("should handle undefined payload", async () => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      const commandHandler = call.args[1];

      await commandHandler(undefined);

      expect(mockLogs.error.called).to.be.false;
    });
  });

  describe("handleOpenDetailsFromDiagnostic", () => {
    let commandHandler: Function;

    beforeEach(() => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      commandHandler = call.args[1];
    });

    it("should return early when payload is undefined", async () => {
      await commandHandler(undefined);

      expect(mockAstResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.false;
      expect(mockScaResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.false;
    });

    it("should try SAST results first", async () => {
      const payload = {
        uniqueId: "sast-123",
        fileName: "app.ts",
        line: 42,
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      expect(mockAstResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should try SCA results when SAST returns false", async () => {
      const payload = {
        uniqueId: "sca-456",
        fileName: "package.json",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      expect(mockScaResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should return early if SAST handles result", async () => {
      const payload = {
        uniqueId: "sast-789",
        fileName: "utils.ts",
        line: 10,
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      expect(mockScaResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.false;
    });

    it("should log error when no match found", async () => {
      const payload = {
        uniqueId: "unknown",
        fileName: "unknown.ts",
        line: 999,
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);

      await commandHandler(payload);

      expect(mockLogs.error.called).to.be.true;
    });

    it("should log search information", async () => {
      const payload = {
        uniqueId: "test-id",
        fileName: "test.ts",
        line: 5,
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);

      await commandHandler(payload);

      expect(mockLogs.info.called).to.be.true;
    });

    it("should handle exceptions gracefully", async () => {
      const payload = {
        uniqueId: "test",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.throws(
        new Error("Provider error")
      );

      await commandHandler(payload);

      expect(mockLogs.error.called).to.be.true;
    });
  });

  describe("tryHandleSastResult", () => {
    let commandHandler: Function;

    beforeEach(() => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      commandHandler = call.args[1];
    });

    it("should call astResultsProvider with correct parameters", async () => {
      const payload = {
        uniqueId: "sast-123",
        fileName: "app.ts",
        line: 42,
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      const call = mockAstResultsProvider.handleOpenDetailsFromDiagnostic.getCall(
        0
      );
      expect(call.args[0]).to.deep.equal({
        uniqueId: "sast-123",
        fileName: "app.ts",
        line: 42,
      });
      expect(call.args[1]).to.equal(mockAstTree);
      expect(call.args[2]).to.equal(commands.newDetails);
    });

    it("should return true when SAST matches", async () => {
      const payload = {
        uniqueId: "sast-456",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      expect(mockAstResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should return false when SAST doesn't match", async () => {
      const payload = {
        uniqueId: "sca-789",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);

      await commandHandler(payload);

      expect(mockAstResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should log success when SAST handles result", async () => {
      const payload = {
        uniqueId: "sast-success",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      const infoCall = mockLogs.info.getCalls().find((c: any) =>
        c.args[0].includes("SAST")
      );
      expect(infoCall).to.exist;
    });
  });

  describe("tryHandleScaResult", () => {
    let commandHandler: Function;

    beforeEach(() => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      commandHandler = call.args[1];
    });

    it("should call scaResultsProvider with correct parameters", async () => {
      const payload = {
        uniqueId: "sca-123",
        packageIdentifier: "lodash@4.17.20",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      const call = mockScaResultsProvider.handleOpenDetailsFromDiagnostic.getCall(
        0
      );
      expect(call.args[0]).to.deep.equal({
        uniqueId: "sca-123",
        fileName: undefined,
        line: undefined,
      });
      expect(call.args[1]).to.equal(mockScaTree);
      expect(call.args[2]).to.equal(commands.newDetails);
      expect(call.args[3]).to.deep.equal([constants.realtime]);
    });

    it("should return true when SCA matches", async () => {
      const payload = {
        uniqueId: "sca-456",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      expect(mockScaResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should return false when SCA doesn't match", async () => {
      const payload = {
        uniqueId: "unknown",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);

      await commandHandler(payload);

      expect(mockScaResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should log success when SCA handles result", async () => {
      const payload = {
        uniqueId: "sca-success",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      const infoCall = mockLogs.info
        .getCalls()
        .find((c: any) => c.args[0].includes("SCA"));
      expect(infoCall).to.exist;
    });

    it("should search for SCA Realtime with correct filter", async () => {
      const payload = {
        uniqueId: "sca-realtime",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      const call = mockScaResultsProvider.handleOpenDetailsFromDiagnostic.getCall(
        0
      );
      expect(call.args[3]).to.include(constants.realtime);
    });
  });

  describe("payload handling", () => {
    let commandHandler: Function;

    beforeEach(() => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      commandHandler = call.args[1];
    });

    it("should handle payload with only uniqueId", async () => {
      const payload = {
        uniqueId: "id-only",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);

      await commandHandler(payload);

      expect(mockAstResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should handle payload with all fields", async () => {
      const payload = {
        label: "SQL Injection",
        fileName: "app.ts",
        line: 42,
        uniqueId: "full-id",
        packageIdentifier: "pkg@1.0.0",
        resultId: "result-id",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      expect(mockAstResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should handle payload with partial fields", async () => {
      const payload = {
        fileName: "utils.ts",
        line: 10,
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);

      await commandHandler(payload);

      expect(mockAstResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });

    it("should handle empty payload object", async () => {
      const payload = {};

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);

      await commandHandler(payload);

      expect(mockAstResultsProvider.handleOpenDetailsFromDiagnostic.called).to
        .be.true;
    });
  });

  describe("error scenarios", () => {
    let commandHandler: Function;

    beforeEach(() => {
      diagnosticCommand.registerOpenDetailsFromDiagnostic();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      commandHandler = call.args[1];
    });

    it("should handle SAST provider throwing error", async () => {
      const payload = {
        uniqueId: "error-sast",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.throws(
        new Error("SAST provider error")
      );

      await commandHandler(payload);

      expect(mockLogs.error.called).to.be.true;
    });

    it("should handle SCA provider throwing error", async () => {
      const payload = {
        uniqueId: "error-sca",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.resolves(false);
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.throws(
        new Error("SCA provider error")
      );

      await commandHandler(payload);

      expect(mockLogs.error.called).to.be.true;
    });

    it("should continue to SCA even if SAST throws", async () => {
      const payload = {
        uniqueId: "fallback",
      };

      mockAstResultsProvider.handleOpenDetailsFromDiagnostic.rejects(
        new Error("SAST failed")
      );
      mockScaResultsProvider.handleOpenDetailsFromDiagnostic.resolves(true);

      await commandHandler(payload);

      expect(mockLogs.error.called).to.be.true;
    });
  });
});
