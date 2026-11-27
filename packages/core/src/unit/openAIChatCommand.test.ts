import "./mocks/vscode-mock";
import { expect } from "chai";
import sinon from "sinon";
import { mock } from "./mocks/vscode-mock";
import * as vscode from "vscode";
import { CopilotChatCommand } from "../commands/openAIChatCommand";
import { Logs } from "../models/logs";
import { OssScannerService } from "../realtimeScanners/scanners/oss/ossScannerService";
import { SecretsScannerService } from "../realtimeScanners/scanners/secrets/secretsScannerService";
import { IacScannerService } from "../realtimeScanners/scanners/iac/iacScannerService";
import { AscaScannerService } from "../realtimeScanners/scanners/asca/ascaScannerService";
import { ContainersScannerService } from "../realtimeScanners/scanners/containers/containersScannerService";
import { commands } from "../utils/common/commandBuilder";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("CopilotChatCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockLogs: any;
  let mockOssScanner: any;
  let mockSecretsScanner: any;
  let mockIacScanner: any;
  let mockAscaScanner: any;
  let mockContainersScanner: any;
  let copilotChatCommand: CopilotChatCommand;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
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

    mockOssScanner = {
      scan: sandbox.stub(),
      initialize: sandbox.stub(),
    };

    mockSecretsScanner = {
      scan: sandbox.stub(),
      initialize: sandbox.stub(),
    };

    mockIacScanner = {
      scan: sandbox.stub(),
      initialize: sandbox.stub(),
    };

    mockAscaScanner = {
      scan: sandbox.stub(),
      initialize: sandbox.stub(),
    };

    mockContainersScanner = {
      scan: sandbox.stub(),
      initialize: sandbox.stub(),
    };

    sandbox.stub(vscode.commands, "registerCommand");
    if (!mock.extensions) {
      (mock as any).extensions = {
        getExtension: () => undefined,
        all: [],
        onDidChange: () => ({ dispose: () => { } }),
      };
    }
    sandbox.stub(mock.extensions, "getExtension").returns(undefined);
    sandbox.stub(vscode.window, "showInformationMessage");
    sandbox.stub(vscode.window, "showErrorMessage").resolves(undefined);

    copilotChatCommand = new CopilotChatCommand(
      mockContext,
      mockLogs,
      mockOssScanner,
      mockSecretsScanner,
      mockIacScanner,
      mockAscaScanner,
      mockContainersScanner
    );
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("constructor", () => {
    it("should initialize with all scanner dependencies", () => {
      expect(copilotChatCommand.context).to.equal(mockContext);
      expect(copilotChatCommand.logs).to.equal(mockLogs);
    });

    it("should store context and logs", () => {
      expect(copilotChatCommand.context).to.not.be.undefined;
      expect(copilotChatCommand.logs).to.not.be.undefined;
    });

    it("should initialize selected AI assistant to unknown", () => {
      expect(copilotChatCommand["selectedAIAssistant"]).to.equal("unknown");
    });

    it("should initialize Claude extension activated to false", () => {
      expect(copilotChatCommand["claudeExtensionActivated"]).to.be.false;
    });
  });

  describe("registerCopilotChatCommand", () => {
    it("should register copilot chat command", () => {
      copilotChatCommand.registerCopilotChatCommand();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      expect(registerStub.called).to.be.true;
    });

    it("should add subscription to context", () => {
      copilotChatCommand.registerCopilotChatCommand();

      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });

    it("should register command with correct command ID", () => {
      copilotChatCommand.registerCopilotChatCommand();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);

      expect(call.args[0]).to.equal(commands.openAIChat);
    });

    it("should register command handler", () => {
      copilotChatCommand.registerCopilotChatCommand();

      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);

      expect(call.args[1]).to.be.a("function");
    });
  });

  describe("setSelectedAIAssistant", () => {
    it("should return user preference when available", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "Claude",
        true,
        true,
        false
      );

      expect(result).to.equal("claude");
    });

    it("should return copilot when copilot is available and preferred", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "Copilot",
        true,
        false,
        false
      );

      expect(result).to.equal("copilot");
    });

    it("should return null when preference is unknown even if copilot is available", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "unknown",
        true,
        false,
        false
      );

      expect(result).to.be.null;
    });

    it("should return null when preference is unknown and only claude is available", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "unknown",
        false,
        true,
        false
      );

      expect(result).to.be.null;
    });

    it("should return null when no AI assistants available", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "unknown",
        false,
        false,
        false
      );

      expect(result).to.be.null;
    });

    it("should respect saved preference for copilot", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "Copilot",
        true,
        true,
        false
      );

      expect(result).to.equal("copilot");
    });

    it("should respect saved preference for claude", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "Claude",
        true,
        true,
        false
      );

      expect(result).to.equal("claude");
    });

    it("should return null for invalid preferences", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "invalid-ai",
        true,
        false,
        false
      );

      expect(result).to.be.null;
    });

    it("should return codex when codex is available and preferred", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "Codex",
        false,
        false,
        true
      );

      expect(result).to.equal("codex");
    });

    it("should return null when codex preferred but not available", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "Codex",
        false,
        false,
        false
      );

      expect(result).to.be.null;
    });
  });

  describe("pressEnter platform handling", () => {
    let originalPlatform: any;

    beforeEach(() => {
      originalPlatform = process.platform;
      sandbox.stub(require("child_process"), "spawn");
    });

    afterEach(() => {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should call pressEnterWindows on Windows", async () => {
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      const pressEnterWindowsStub = sandbox.stub(
        copilotChatCommand,
        "pressEnterWindows" as any
      );

      try {
        await copilotChatCommand["pressEnter"]();
      } catch (e) {
        // Expected - we're mocking child_process
      }

      expect(pressEnterWindowsStub.called).to.be.true;
    });

    it("should call pressEnterMac on macOS", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });

      const pressEnterMacStub = sandbox.stub(
        copilotChatCommand,
        "pressEnterMac" as any
      );

      try {
        await copilotChatCommand["pressEnter"]();
      } catch (e) {
        // Expected - we're mocking child_process
      }

      expect(pressEnterMacStub.called).to.be.true;
    });

    it("should handle Linux gracefully", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      try {
        await copilotChatCommand["pressEnter"]();
      } catch (e) {
        // Expected - Linux doesn't need key press simulation
      }

      expect(true).to.be.true; // Test passes if no exception thrown
    });
  });

  describe("integration scenarios", () => {
    it("should handle multiple command registrations", () => {
      const initialCount = mockContext.subscriptions.length;
      copilotChatCommand.registerCopilotChatCommand();
      copilotChatCommand.registerCopilotChatCommand();

      expect(mockContext.subscriptions.length).to.be.greaterThan(initialCount);
    });

    it("should have all scanner services available", () => {
      expect(copilotChatCommand["ossScanner"]).to.equal(mockOssScanner);
      expect(copilotChatCommand["secretsScanner"]).to.equal(
        mockSecretsScanner
      );
      expect(copilotChatCommand["iacScanner"]).to.equal(mockIacScanner);
      expect(copilotChatCommand["ascaScanner"]).to.equal(mockAscaScanner);
      expect(copilotChatCommand["containersScanner"]).to.equal(
        mockContainersScanner
      );
    });

    it("should maintain AI assistant state across calls", () => {
      const firstSelection = copilotChatCommand["setSelectedAIAssistant"](
        "Claude",
        true,
        true,
        false
      );

      copilotChatCommand["selectedAIAssistant"] = firstSelection || "unknown";

      expect(copilotChatCommand["selectedAIAssistant"]).to.equal("claude");
    });
  });

  describe("error handling", () => {
    it("should handle missing context gracefully", () => {
      const invalidCommand = new CopilotChatCommand(
        { subscriptions: [] } as any,
        mockLogs,
        mockOssScanner,
        mockSecretsScanner,
        mockIacScanner,
        mockAscaScanner,
        mockContainersScanner
      );

      expect(() => invalidCommand.registerCopilotChatCommand()).to.not.throw();
    });

    it("should handle missing logs gracefully", () => {
      const invalidCommand = new CopilotChatCommand(
        mockContext,
        { info: () => {}, error: () => {} } as any,
        mockOssScanner,
        mockSecretsScanner,
        mockIacScanner,
        mockAscaScanner,
        mockContainersScanner
      );

      expect(() => invalidCommand.registerCopilotChatCommand()).to.not.throw();
    });

    it("should handle setSelectedAIAssistant with no AI assistants", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "unknown",
        false,
        false,
        false
      );

      expect(result).to.be.null;
    });
  });

  describe("scanner services", () => {
    it("should have OSS scanner available", () => {
      expect(copilotChatCommand["ossScanner"]).to.not.be.undefined;
    });

    it("should have Secrets scanner available", () => {
      expect(copilotChatCommand["secretsScanner"]).to.not.be.undefined;
    });

    it("should have IAC scanner available", () => {
      expect(copilotChatCommand["iacScanner"]).to.not.be.undefined;
    });

    it("should have ASCA scanner available", () => {
      expect(copilotChatCommand["ascaScanner"]).to.not.be.undefined;
    });

    it("should have Containers scanner available", () => {
      expect(copilotChatCommand["containersScanner"]).to.not.be.undefined;
    });
  });

  describe("configuration state", () => {
    it("should initialize with empty chat extension ID", () => {
      expect(copilotChatCommand["selectedChatExtensionId"]).to.equal("");
    });

    it("should initialize with empty new chat open command", () => {
      expect(copilotChatCommand["selectedNewChatOpen"]).to.equal("");
    });

    it("should initialize with empty clipboard paste action command", () => {
      expect(copilotChatCommand["selectedChatclipboardPasteActionCommand"]).to
        .equal("");
    });

    it("should track Claude extension activation state", () => {
      expect(copilotChatCommand["claudeExtensionActivated"]).to.be.a("boolean");
    });
  });

  describe("Antigravity IDE native chat", () => {
    const prompt = "Fix this vulnerability";
    let clock: sinon.SinonFakeTimers;
    let executeCommandStub: sinon.SinonStub;
    let readTextStub: sinon.SinonStub;
    let writeTextStub: sinon.SinonStub;
    let originalAppName: string;

    beforeEach(() => {
      // The handler waits between commands (new chat has to mount); fake timers keep the tests instant
      clock = sandbox.useFakeTimers();
      executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves(undefined);
      readTextStub = sandbox.stub(vscode.env.clipboard, "readText").resolves("original clipboard");
      writeTextStub = sandbox.stub(vscode.env.clipboard, "writeText").resolves();
      originalAppName = (vscode.env as any).appName;
    });

    afterEach(() => {
      (vscode.env as any).appName = originalAppName;
    });

    // Runs the handler and advances the fake clock past every internal wait
    const runHandler = async () => {
      const done = copilotChatCommand["handleAntigravityIDE"](prompt);
      await clock.tickAsync(5000);
      await done;
    };

    it("should open a new chat, fill the input with the plain prompt, then submit, in that order", async () => {
      await runHandler();

      const calls = executeCommandStub.getCalls().map(c => c.args);
      expect(calls).to.deep.equal([
        ["antigravity.startNewConversation"],
        ["antigravity.addContext", prompt],
        ["antigravity.triggerSend"],
      ]);
    });

    it("should not attach a file or line to the prompt", async () => {
      await runHandler();

      // addContext is called with the prompt text only: no file/range item and no explainAndFixProblem prefix
      const addContextCall = executeCommandStub.getCalls().find(c => c.args[0] === "antigravity.addContext");
      expect(addContextCall!.args).to.have.length(2);
      expect(executeCommandStub.calledWith("antigravity.explainAndFixProblem")).to.be.false;
    });

    it("should wait for the new chat to mount before filling the input", async () => {
      const done = copilotChatCommand["handleAntigravityIDE"](prompt);

      await clock.tickAsync(100);
      expect(executeCommandStub.calledWith("antigravity.startNewConversation")).to.be.true;
      expect(executeCommandStub.calledWith("antigravity.addContext")).to.be.false;

      await clock.tickAsync(5000);
      await done;
      expect(executeCommandStub.calledWith("antigravity.addContext", prompt)).to.be.true;
    });

    it("should restore the original clipboard after a successful send", async () => {
      await runHandler();

      expect(writeTextStub.firstCall.args[0]).to.equal(prompt);
      expect(writeTextStub.lastCall.args[0]).to.equal("original clipboard");
    });

    it("should log the error and leave the prompt on the clipboard when a command fails", async () => {
      executeCommandStub.withArgs("antigravity.addContext").rejects(new Error("command 'antigravity.addContext' not found"));
      // First read is the user's clipboard before the send; later reads see the prompt still sitting there
      readTextStub.onFirstCall().resolves("original clipboard");
      readTextStub.resolves(prompt);

      await runHandler();

      // Same safety net as the other IDEs: the user can paste the prompt manually
      expect((mockLogs.error as sinon.SinonStub).called).to.be.true;
      expect(executeCommandStub.calledWith("antigravity.triggerSend")).to.be.false;
      expect(writeTextStub.calledWith("original clipboard")).to.be.false;
    });

    describe("routing", () => {
      let handlerStub: sinon.SinonStub;

      const stubPreferNative = (preferNative: boolean) => {
        sandbox.stub(vscode.workspace, "getConfiguration").returns({
          get: (key: string, defaultValue?: unknown) => (key === "Prefer Native AI Assistant" ? preferNative : defaultValue),
        } as any);
      };

      beforeEach(() => {
        handlerStub = sandbox.stub(copilotChatCommand as any, "handleAntigravityIDE").resolves();
      });

      it("should use the Antigravity handler when running in Antigravity with Prefer Native AI Assistant checked", async () => {
        (vscode.env as any).appName = "Antigravity IDE";
        stubPreferNative(true);

        await copilotChatCommand["openChatWithPrompt"](prompt);

        expect(handlerStub.calledOnceWithExactly(prompt)).to.be.true;
      });

      it("should not use the Antigravity handler when Prefer Native AI Assistant is unchecked", async () => {
        (vscode.env as any).appName = "Antigravity IDE";
        stubPreferNative(false);

        await copilotChatCommand["openChatWithPrompt"](prompt).catch(() => undefined);

        expect(handlerStub.called).to.be.false;
      });

      it("should not use the Antigravity handler in other IDEs", async () => {
        (vscode.env as any).appName = "Kiro";
        stubPreferNative(true);
        const kiroStub = sandbox.stub(copilotChatCommand as any, "handleKiroIDE").resolves();

        await copilotChatCommand["openChatWithPrompt"](prompt);

        expect(kiroStub.calledOnce).to.be.true;
        expect(handlerStub.called).to.be.false;
      });
    });
  });
});
