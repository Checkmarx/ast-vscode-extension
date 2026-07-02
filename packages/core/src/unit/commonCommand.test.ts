import { expect } from "chai";
import "./mocks/vscode-mock";
import "./mocks/cxWrapper-mock";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { CommonCommand } from "../commands/commonCommand";
import { Logs } from "../models/logs";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";
import { commands } from "../utils/common/commandBuilder";
import { initialize } from "../cx";

import { getCommandsExecuted, clearCommandsExecuted } from "./mocks/vscode-mock";

describe("CommonCommand", () => {
  let commonCommand: CommonCommand;
  let logs: Logs;
  let mockContext: any;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clearCommandsExecuted();

    setExtensionConfig({
      extensionId: 'ast-results',
      commandPrefix: 'ast-results',
      viewContainerPrefix: 'ast',
      displayName: 'Checkmarx',
      extensionType: 'checkmarx',
    });

    const mockOutputChannel = {
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      replace: () => {},
      name: "Test"
    };

    logs = {
      info: () => {},
      error: () => {},
      output: mockOutputChannel,
      log: () => {},
      warn: () => {},
      debug: () => {},
      show: () => {}
    } as Logs;

    mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.parse("file:///test"),
      extensionPath: "/test",
      workspaceState: {
        get: sandbox.stub(),
        update: sandbox.stub().resolves(),
      },
      globalState: {
        get: sandbox.stub().returns(undefined),
        update: sandbox.stub().resolves(),
      },
      secrets: {
        get: () => Promise.resolve("valid-api-key"),
        store: () => Promise.resolve(),
        delete: () => Promise.resolve(),
      },
    } as any;

    initialize(mockContext);
    commonCommand = new CommonCommand(mockContext, logs);
    sandbox.stub(vscode.commands, "registerCommand").callsFake((_name: string, cb: () => void) => {
      if (_name === commands.showError) {
        (commonCommand as any)._showErrorHandler = cb;
      }
      return { dispose: () => { } };
    });
    sandbox.stub(vscode.commands, "executeCommand").resolves();
    sandbox.stub(vscode.window, "showErrorMessage").resolves();
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("registerSettings", () => {
    it("should register settings command", () => {
      commonCommand.registerSettings();
      expect((vscode.commands.registerCommand as sinon.SinonStub).calledWith(commands.setings)).to.be.true;
    });
  });

  describe("registerErrors", () => {
    it("should show stored error when present", () => {
      mockContext.workspaceState.get.returns("configuration failed");
      commonCommand.registerErrors();
      (commonCommand as any)._showErrorHandler();
      expect((vscode.window.showErrorMessage as sinon.SinonStub).calledWith("configuration failed")).to.be.true;
    });

    it("should not show message when no error stored", () => {
      mockContext.workspaceState.get.returns(undefined);
      commonCommand.registerErrors();
      (commonCommand as any)._showErrorHandler();
      expect((vscode.window.showErrorMessage as sinon.SinonStub).called).to.be.false;
    });
  });

  describe("executeCheckSettings", () => {
    it("should execute setContext command with correct parameters", async () => {
      await commonCommand.executeCheckSettings();
      expect((vscode.commands.executeCommand as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("executeCheckScanEnabled", () => {
    it("should set scan enabled context from cx", async () => {
      await commonCommand.executeCheckScanEnabled();
      expect((vscode.commands.executeCommand as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("executeCheckStandaloneEnabled", () => {
    it("should set standalone enabled context from cx", async () => {
      await commonCommand.executeCheckStandaloneEnabled();
      expect((vscode.commands.executeCommand as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("executeCheckCxOneAssistEnabled", () => {
    it("should set cx one assist enabled context from cx", async () => {
      await commonCommand.executeCheckCxOneAssistEnabled();
      expect((vscode.commands.executeCommand as sinon.SinonStub).called).to.be.true;
    });
  });
}); 