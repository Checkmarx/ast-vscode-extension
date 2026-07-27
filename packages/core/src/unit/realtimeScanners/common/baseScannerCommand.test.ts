/* eslint-disable @typescript-eslint/no-explicit-any */
import "../../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { BaseScannerCommand } from "../../../realtimeScanners/common/baseScannerCommand";
import { ConfigurationManager } from "../../../realtimeScanners/configuration/configurationManager";
import { IScannerConfig, IScannerService } from "../../../realtimeScanners/common/types";
import {
  setExtensionConfig,
  resetExtensionConfig,
} from "../../../config/extensionConfig";

class TestScannerCommand extends BaseScannerCommand {
  public initCalled = 0;
  public async callRegisterScanOnChangeText() {
    (this as any).registerScanOnChangeText();
  }
  public async callRegisterScanOnFileOpen() {
    (this as any).registerScanOnFileOpen();
  }
  public callOnTextChange(event: any) {
    (this as any).onTextChange(event);
  }
  public callDebounce(fn: any, wait: number) {
    return (this as any).perDocumentDebounce(fn, wait);
  }
  protected async initializeScanner(): Promise<void> {
    this.initCalled++;
    await super.initializeScanner();
  }
}

describe("BaseScannerCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let context: vscode.ExtensionContext;
  let logs: any;
  let config: IScannerConfig;
  let scannerService: IScannerService;
  let configManager: ConfigurationManager;
  let cmd: TestScannerCommand;

  const makeEvent = (uriStr: string, contentChanges: any[] = [{}]) =>
    ({
      document: {
        uri: { toString: () => uriStr, fsPath: uriStr },
        getText: () => "",
      },
      contentChanges,
    } as any);

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });

    context = { subscriptions: [] } as any;
    logs = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
    };
    config = {
      engineName: "test-engine",
      configSection: "test.section",
      activateKey: "activate",
      enabledMessage: "enabled",
      disabledMessage: "disabled",
      errorMessage: "error",
    };
    scannerService = {
      scan: sandbox.stub().resolves(),
      clearProblems: sandbox.stub().resolves(),
      shouldScanFile: sandbox.stub().returns(true),
      updateProblems: sandbox.stub(),
      diagnosticCollection: {} as any,
      dispose: sandbox.stub(),
    };
    configManager = new ConfigurationManager();
    cmd = new TestScannerCommand(context, logs, config, scannerService, configManager);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("register", () => {
    it("should initialize the scanner when active", async () => {
      sandbox.stub(configManager, "isScannerActive").returns(true);
      await cmd.register();
      expect(cmd.initCalled).to.equal(1);
      expect(logs.info.calledWith("enabled")).to.be.true;
      expect(context.subscriptions.length).to.be.greaterThan(0);
    });

    it("should dispose and log disabled message when inactive", async () => {
      sandbox.stub(configManager, "isScannerActive").returns(false);
      await cmd.register();
      expect(cmd.initCalled).to.equal(0);
      expect(logs.info.calledWith("disabled")).to.be.true;
      expect((scannerService.clearProblems as sinon.SinonStub).called).to.be.true;
    });

    it("should log error message when isScannerActive throws", async () => {
      sandbox.stub(configManager, "isScannerActive").throws(new Error("boom"));
      await cmd.register();
      expect(logs.error.calledWith("error")).to.be.true;
    });
  });

  describe("dispose", () => {
    it("should clear problems and not throw with no listeners", async () => {
      await cmd.dispose();
      expect((scannerService.clearProblems as sinon.SinonStub).called).to.be.true;
    });

    it("should dispose existing listeners and reset them", async () => {
      sandbox.stub(configManager, "isScannerActive").returns(true);
      await cmd.register();
      expect((cmd as any).onDidChangeTextDocument).to.exist;
      await cmd.dispose();
      expect((cmd as any).onDidChangeTextDocument).to.be.undefined;
      expect((cmd as any).onDidOpenTextDocument).to.be.undefined;
    });
  });

  describe("registerScanOnFileOpen", () => {
    it("should register an onDidOpenTextDocument listener", () => {
      const stub = sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .callsFake((cb: any) => {
          // immediately invoke the callback to exercise the scan path
          cb({ uri: { toString: () => "x" } });
          return { dispose: () => {} } as any;
        });
      cmd.callRegisterScanOnFileOpen();
      expect(stub.called).to.be.true;
      expect((scannerService.scan as sinon.SinonStub).called).to.be.true;
    });

    it("should swallow errors thrown by scan in the open listener", () => {
      (scannerService.scan as sinon.SinonStub).throws(new Error("scan fail"));
      sandbox.stub(vscode.workspace, "onDidOpenTextDocument").callsFake((cb: any) => {
        expect(() => cb({ uri: { toString: () => "x" } })).to.not.throw();
        return { dispose: () => {} } as any;
      });
      cmd.callRegisterScanOnFileOpen();
    });

    it("should dispose a previous open listener before registering a new one", () => {
      const disposeSpy = sandbox.spy();
      sandbox
        .stub(vscode.workspace, "onDidOpenTextDocument")
        .returns({ dispose: disposeSpy } as any);
      cmd.callRegisterScanOnFileOpen();
      cmd.callRegisterScanOnFileOpen();
      expect(disposeSpy.called).to.be.true;
    });
  });

  describe("registerScanOnChangeText", () => {
    it("should register an onDidChangeTextDocument listener and debounce changes", () => {
      const clock = sandbox.useFakeTimers();
      sandbox
        .stub(vscode.workspace, "onDidChangeTextDocument")
        .callsFake((cb: any) => {
          cb(makeEvent("file://a"));
          return { dispose: () => {} } as any;
        });
      cmd.callRegisterScanOnChangeText();
      clock.tick(1100);
      expect((scannerService.scan as sinon.SinonStub).called).to.be.true;
      clock.restore();
    });

    it("should dispose a previous change listener before registering a new one", () => {
      const disposeSpy = sandbox.spy();
      sandbox
        .stub(vscode.workspace, "onDidChangeTextDocument")
        .returns({ dispose: disposeSpy } as any);
      cmd.callRegisterScanOnChangeText();
      cmd.callRegisterScanOnChangeText();
      expect(disposeSpy.called).to.be.true;
    });
  });

  describe("onTextChange", () => {
    it("should call scannerService.scan", () => {
      cmd.callOnTextChange(makeEvent("file://b"));
      expect((scannerService.scan as sinon.SinonStub).called).to.be.true;
    });

    it("should log a warning when scan throws", () => {
      (scannerService.scan as sinon.SinonStub).throws(new Error("nope"));
      cmd.callOnTextChange(makeEvent("file://b"));
      expect(logs.warn.called).to.be.true;
    });
  });

  describe("perDocumentDebounce", () => {
    it("should debounce repeated calls for the same document", () => {
      const clock = sandbox.useFakeTimers();
      const fn = sandbox.spy();
      const debounced = cmd.callDebounce(fn, 500);
      const ev = makeEvent("file://c");
      debounced(ev);
      debounced(ev);
      clock.tick(600);
      expect(fn.calledOnce).to.be.true;
      clock.restore();
    });

    it("should not throw if event document is malformed", () => {
      const fn = sandbox.spy();
      const debounced = cmd.callDebounce(fn, 500);
      expect(() => debounced({} as any)).to.not.throw();
    });
  });
});
