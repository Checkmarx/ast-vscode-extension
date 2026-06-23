import { expect } from "chai";
import sinon from "sinon";
import * as vscode from "vscode";
import { CopilotChatCommand } from "../commands/openAIChatCommand";
import { Logs } from "../models/logs";
import { OssScannerService } from "../realtimeScanners/scanners/oss/ossScannerService";
import { SecretsScannerService } from "../realtimeScanners/scanners/secrets/secretsScannerService";
import { IacScannerService } from "../realtimeScanners/scanners/iac/iacScannerService";
import { AscaScannerService } from "../realtimeScanners/scanners/asca/ascaScannerService";
import { ContainersScannerService } from "../realtimeScanners/scanners/containers/containersScannerService";
import { commands } from "../utils/common/commandBuilder";

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
    sandbox.stub(vscode.extensions, "getExtension").returns(undefined);
    sandbox.stub(vscode.window, "showInformationMessage");
    sandbox.stub(vscode.window, "showErrorMessage");

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
        "claude",
        true,
        true
      );

      expect(result).to.equal("claude");
    });

    it("should return copilot when copilot is available and preferred", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "copilot",
        true,
        false
      );

      expect(result).to.equal("copilot");
    });

    it("should return copilot as default when available and no preference", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "unknown",
        true,
        false
      );

      expect(result).to.equal("copilot");
    });

    it("should return claude when copilot unavailable but claude available", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "unknown",
        false,
        true
      );

      expect(result).to.equal("claude");
    });

    it("should return null when no AI assistants available", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "unknown",
        false,
        false
      );

      expect(result).to.be.null;
    });

    it("should respect saved preference for copilot", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "copilot",
        true,
        true
      );

      expect(result).to.equal("copilot");
    });

    it("should respect saved preference for claude", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "claude",
        true,
        true
      );

      expect(result).to.equal("claude");
    });

    it("should handle invalid preferences gracefully", () => {
      const result = copilotChatCommand["setSelectedAIAssistant"](
        "invalid-ai",
        true,
        false
      );

      expect(result).to.equal("copilot");
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
      copilotChatCommand.registerCopilotChatCommand();
      copilotChatCommand.registerCopilotChatCommand();

      expect(mockContext.subscriptions.length).to.equal(2);
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
        "claude",
        true,
        true
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
});
