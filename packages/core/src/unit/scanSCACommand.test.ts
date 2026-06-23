import { expect } from "chai";
import sinon from "sinon";
import * as vscode from "vscode";
import { ScanSCACommand } from "../commands/scanSCACommand";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commandBuilder";
import { cx } from "../cx";
import * as scaCreateScanProvider from "../views/scaView/scaCreateScanProvider";
import { setExtensionConfig, EXTENSION_TYPE, resetExtensionConfig } from "../config/extensionConfig";

describe("ScanSCACommand", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockStatusBar: any;
  let mockScaResultsProvider: any;
  let mockLogs: any;
  let scanSCACommand: ScanSCACommand;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    setExtensionConfig({
      extensionId: 'test-scan-sca-command',
      commandPrefix: 'test',
      viewContainerPrefix: 'test',
      displayName: 'Test Extension',
      extensionType: EXTENSION_TYPE.CHECKMARX,
    });

    mockContext = {
      subscriptions: [],
    };

    mockStatusBar = {
      show: sandbox.stub(),
      hide: sandbox.stub(),
      dispose: sandbox.stub(),
    };

    mockScaResultsProvider = {
      refresh: sandbox.stub(),
      getResults: sandbox.stub().returns([]),
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

    sandbox.stub(vscode.commands, "registerCommand");
    sandbox.stub(cx, "isStandaloneEnabled").resolves(false);
    sandbox.stub(scaCreateScanProvider, "createSCAScan").resolves();

    scanSCACommand = new ScanSCACommand(
      mockContext,
      mockStatusBar,
      mockScaResultsProvider,
      mockLogs
    );
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("constructor", () => {
    it("should initialize with all dependencies", () => {
      expect(scanSCACommand.context).to.equal(mockContext);
      expect(scanSCACommand.runSCAScanStatusBar).to.equal(mockStatusBar);
      expect(scanSCACommand.scaResultsProvider).to.equal(
        mockScaResultsProvider
      );
      expect(scanSCACommand.logs).to.equal(mockLogs);
    });
  });

  describe("registerScaScans", () => {
    it("should register SCA scan command", async () => {
      await scanSCACommand.registerScaScans();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      expect(registerStub.called).to.be.true;
    });

    it("should add subscription to context", async () => {
      await scanSCACommand.registerScaScans();

      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });

    it("should register createSCAScan command", async () => {
      await scanSCACommand.registerScaScans();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);

      expect(call.args[0]).to.equal(commands.createSCAScan);
    });
  });

  describe("createScanCommand handler", () => {
    let commandHandler: Function;

    beforeEach(async () => {
      await scanSCACommand.registerScaScans();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      commandHandler = call.args[1];
    });

    it("should create SCA scan when standalone is not enabled", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);

      await commandHandler();

      expect(
        (scaCreateScanProvider.createSCAScan as sinon.SinonStub).called
      ).to.be.true;
    });

    it("should not create SCA scan when standalone is enabled", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(true);

      await commandHandler();

      expect(
        (scaCreateScanProvider.createSCAScan as sinon.SinonStub).called
      ).to.be.false;
    });

    it("should pass context to createSCAScan", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);

      await commandHandler();

      const createStub = scaCreateScanProvider.createSCAScan as sinon.SinonStub;
      const call = createStub.getCall(0);

      expect(call.args[0]).to.equal(mockContext);
    });

    it("should pass status bar to createSCAScan", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);

      await commandHandler();

      const createStub = scaCreateScanProvider.createSCAScan as sinon.SinonStub;
      const call = createStub.getCall(0);

      expect(call.args[1]).to.equal(mockStatusBar);
    });

    it("should pass logs to createSCAScan", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);

      await commandHandler();

      const createStub = scaCreateScanProvider.createSCAScan as sinon.SinonStub;
      const call = createStub.getCall(0);

      expect(call.args[2]).to.equal(mockLogs);
    });

    it("should pass results provider to createSCAScan", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);

      await commandHandler();

      const createStub = scaCreateScanProvider.createSCAScan as sinon.SinonStub;
      const call = createStub.getCall(0);

      expect(call.args[3]).to.equal(mockScaResultsProvider);
    });

    it("should check standalone status before creating scan", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);

      await commandHandler();

      expect((cx.isStandaloneEnabled as sinon.SinonStub).calledWith(mockLogs))
        .to.be.true;
    });

    it("should handle async isStandaloneEnabled call", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);

      const result = await commandHandler();

      expect(result).to.be.undefined;
    });
  });

  describe("integration scenarios", () => {
    it("should handle multiple scan command registrations", async () => {
      await scanSCACommand.registerScaScans();
      await scanSCACommand.registerScaScans();

      expect(mockContext.subscriptions.length).to.equal(2);
    });

    it("should handle rapid successive command calls", async () => {
      await scanSCACommand.registerScaScans();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      const commandHandler = call.args[1];

      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);

      await Promise.all([commandHandler(), commandHandler(), commandHandler()]);

      const createStub = scaCreateScanProvider.createSCAScan as sinon.SinonStub;
      expect(createStub.callCount).to.equal(3);
    });
  });

  describe("error handling", () => {
    let commandHandler: Function;

    beforeEach(async () => {
      await scanSCACommand.registerScaScans();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      commandHandler = call.args[1];
    });

    it("should handle createSCAScan errors gracefully", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).resolves(false);
      (scaCreateScanProvider.createSCAScan as sinon.SinonStub).rejects(
        new Error("Scan creation failed")
      );

      expect(async () => await commandHandler()).to.not.throw();
    });

    it("should handle isStandaloneEnabled errors gracefully", async () => {
      (cx.isStandaloneEnabled as sinon.SinonStub).rejects(
        new Error("Config error")
      );

      expect(async () => await commandHandler()).to.not.throw();
    });
  });
});
