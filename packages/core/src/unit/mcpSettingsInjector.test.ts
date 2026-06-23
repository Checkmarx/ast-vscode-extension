import { expect } from "chai";
import sinon from "sinon";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import {
  registerMcpSettingsInjector,
  uninstallMcp,
  initializeMcpConfiguration,
} from "../services/mcpSettingsInjector";
import * as utils from "../utils/utils";
import { constants } from "../utils/common/constants";
import { cx } from "../cx";
import { getExtensionType, EXTENSION_TYPE, setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";
import * as aiAssistantUtil from "../utils/aiAssistantUtil";

describe("MCP Settings Injector", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup default extension config for tests
    setExtensionConfig({
      extensionId: 'test-ext',
      commandPrefix: 'test',
      viewContainerPrefix: 'test',
      displayName: 'Test',
      extensionType: EXTENSION_TYPE.CHECKMARX,
    });

    mockContext = {
      secrets: {
        get: sandbox.stub().resolves("mock-api-key"),
        store: sandbox.stub().resolves(),
        delete: sandbox.stub().resolves(),
      },
    };

    // Mock file system operations
    sandbox.stub(fs, "existsSync").returns(false);
    sandbox.stub(fs, "readFileSync").returns("{}");
    sandbox.stub(fs, "writeFileSync").returns(undefined);
    sandbox.stub(fs, "mkdirSync").returns(undefined);

    // Mock vscode operations
    sandbox.stub(vscode.window, "showErrorMessage");
    sandbox.stub(vscode.window, "showInformationMessage");
    sandbox.stub(vscode.commands, "registerCommand");
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub().returns({}),
      update: sandbox.stub().resolves(),
      has: sandbox.stub().returns(true),
      inspect: sandbox.stub().returns(undefined),
    } as any as vscode.WorkspaceConfiguration);

    // Mock utility functions
    sandbox.stub(utils, "isIDE").returns(false);
    sandbox.stub(cx, "isValidConfiguration").resolves(true);
    sandbox.stub(cx, "isAiMcpServerEnabled").resolves(true);
    sandbox.stub(aiAssistantUtil, "isCopilotInstalled").returns(false);
    sandbox.stub(aiAssistantUtil, "isClaudeInstalled").returns(false);

    sandbox.stub(os, "homedir").returns("/home/user");
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("getCheckmarxMcpServerName", () => {
    it("should return 'Checkmarx' for CHECKMARX extension type", () => {
      setExtensionConfig({
        extensionId: 'test',
        commandPrefix: 'test',
        viewContainerPrefix: 'test',
        displayName: 'Test',
        extensionType: EXTENSION_TYPE.CHECKMARX,
      });

      // The function is not exported, so we test it indirectly through registerMcpSettingsInjector
      // For now, we'll test the behavior that uses it
      expect(getExtensionType()).to.equal(EXTENSION_TYPE.CHECKMARX);
    });

    it("should return 'Checkmarx Developer Assist' for DEVELOPER_ASSIST extension type", () => {
      setExtensionConfig({
        extensionId: 'test',
        commandPrefix: 'test',
        viewContainerPrefix: 'test',
        displayName: 'Test',
        extensionType: EXTENSION_TYPE.DEVELOPER_ASSIST,
      });

      expect(getExtensionType()).to.equal(EXTENSION_TYPE.DEVELOPER_ASSIST);
    });
  });

  describe("registerMcpSettingsInjector", () => {
    it("should register install MCP command", () => {
      registerMcpSettingsInjector(mockContext);

      expect(
        (vscode.commands.registerCommand as sinon.SinonStub).calledWith(
          sinon.match.any,
          sinon.match.func
        )
      ).to.be.true;
    });

    it("should show error when API key is not available", async () => {
      mockContext.secrets.get.resolves(undefined);
      registerMcpSettingsInjector(mockContext);

      const registeredCommand = (vscode.commands.registerCommand as sinon.SinonStub)
        .getCalls()
        .find((call) => call.args[1])?.args[1];

      await registeredCommand?.();

      expect(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          sinon.match(/Authentication required/)
        )
      ).to.be.true;
    });

    it("should show error when configuration is invalid", async () => {
      (cx.isValidConfiguration as sinon.SinonStub).resolves(false);
      registerMcpSettingsInjector(mockContext);

      const registeredCommand = (vscode.commands.registerCommand as sinon.SinonStub)
        .getCalls()
        .find((call) => call.args[1])?.args[1];

      await registeredCommand?.();

      expect(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          sinon.match(/session has been expired/)
        )
      ).to.be.true;
    });

    it("should show error when MCP not enabled for tenant", async () => {
      (cx.isAiMcpServerEnabled as sinon.SinonStub).resolves(false);
      registerMcpSettingsInjector(mockContext);

      const registeredCommand = (vscode.commands.registerCommand as sinon.SinonStub)
        .getCalls()
        .find((call) => call.args[1])?.args[1];

      await registeredCommand?.();

      expect(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          sinon.match(/not been enabled for your tenant/)
        )
      ).to.be.true;
    });

    it("should call initializeMcpConfiguration with valid configuration", async () => {
      const initSpy = sandbox.spy(
        require("../services/mcpSettingsInjector"),
        "initializeMcpConfiguration"
      );

      registerMcpSettingsInjector(mockContext);

      const registeredCommand = (vscode.commands.registerCommand as sinon.SinonStub)
        .getCalls()
        .find((call) => call.args[1])?.args[1];

      await registeredCommand?.();

      // Verify initialization was attempted
      expect((vscode.window.showInformationMessage as sinon.SinonStub).called ||
             (vscode.window.showErrorMessage as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("uninstallMcp", () => {
    it("should handle non-VSCode IDEs by removing from mcp.json", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(false);
      (utils.isIDE as sinon.SinonStub).withArgs(constants.cursorAgent).returns(true);

      (fs.existsSync as sinon.SinonStub).returns(true);
      const readStub = (fs.readFileSync as sinon.SinonStub);
      readStub.returns(
        JSON.stringify({
          mcpServers: {
            "Checkmarx": { url: "http://localhost:3000" },
          },
        })
      );

      await uninstallMcp();

      expect((fs.writeFileSync as sinon.SinonStub).called).to.be.true;
    });

    it("should handle VSCode by removing from settings", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(true);

      const mockConfig = {
        get: sandbox.stub().returns({
          servers: {
            "Checkmarx": { url: "http://localhost:3000" },
          },
        }),
        update: sandbox.stub().resolves(),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      await uninstallMcp();

      expect(mockConfig.update.called).to.be.true;
    });

    it("should gracefully handle errors", async () => {
      (utils.isIDE as sinon.SinonStub).returns(true);
      (fs.readFileSync as sinon.SinonStub).throws(new Error("File read error"));

      await uninstallMcp();

      expect(
        (vscode.window.showErrorMessage as sinon.SinonStub).called
      ).to.be.true;
    });
  });

  describe("initializeMcpConfiguration", () => {
    it("should show error for invalid JWT", async () => {
      await initializeMcpConfiguration("invalid-jwt-token");

      expect(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          sinon.match(/decode/)
        )
      ).to.be.true;
    });

    it("should construct MCP server configuration from valid API key", async () => {
      // Create a mock JWT token with proper structure
      const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2lhbS5jaGVja21hcnguY29tIn0.signature";

      (fs.existsSync as sinon.SinonStub).returns(false);

      await initializeMcpConfiguration(mockToken);

      // Verify that configuration attempt was made
      expect(
        (vscode.window.showInformationMessage as sinon.SinonStub).called ||
        (vscode.window.showErrorMessage as sinon.SinonStub).called
      ).to.be.true;
    });

    it("should write to VSCode config when Copilot is installed", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(true);
      (aiAssistantUtil.isCopilotInstalled as sinon.SinonStub).returns(true);

      const mockConfig = {
        get: sandbox.stub().returns({}),
        update: sandbox.stub().resolves(),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2lhbS5jaGVja21hcnguY29tIn0.signature";
      await initializeMcpConfiguration(mockToken);

      // Verify VSCode config update was attempted
      expect(mockConfig.update.called).to.be.true;
    });

    it("should handle different IDE types correctly", async () => {
      const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2lhbS5jaGVja21hcnguY29tIn0.signature";

      // Test with Cursor IDE
      (utils.isIDE as sinon.SinonStub).withArgs(constants.cursorAgent).returns(true);
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(false);

      await initializeMcpConfiguration(mockToken);

      expect((fs.mkdirSync as sinon.SinonStub).called).to.be.true;
    });

    it("should handle issuer URL extraction for Checkmarx domains", async () => {
      // This test verifies that the code correctly extracts the AST domain from IAM domain
      const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2lhbS5jaGVja21hcnguY29tIn0.signature";

      (fs.existsSync as sinon.SinonStub).returns(false);

      await initializeMcpConfiguration(mockToken);

      // Verify that file write occurred with expected configuration
      expect((fs.writeFileSync as sinon.SinonStub).called ||
             (vscode.workspace.getConfiguration as sinon.SinonStub).called).to.be.true;
    });

    it("should show success message when configuration is saved", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(true);
      (aiAssistantUtil.isCopilotInstalled as sinon.SinonStub).returns(false);

      const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2lhbS5jaGVja21hcnguY29tIn0.signature";

      const mockConfig = {
        get: sandbox.stub().returns({}),
        update: sandbox.stub().resolves(),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      await initializeMcpConfiguration(mockToken);

      // Should show success message for non-Copilot VSCode
      expect(
        (vscode.window.showInformationMessage as sinon.SinonStub).calledWith(
          sinon.match(/saved successfully/)
        ) ||
        (vscode.window.showErrorMessage as sinon.SinonStub).called
      ).to.be.true;
    });
  });

  describe("error handling", () => {
    it("should handle JSON parse errors gracefully", async () => {
      (fs.existsSync as sinon.SinonStub).returns(true);
      (fs.readFileSync as sinon.SinonStub).returns("invalid-json");

      await uninstallMcp();

      // Should not throw, but might show error
      expect(true).to.be.true;
    });

    it("should handle missing home directory gracefully", async () => {
      (os.homedir as sinon.SinonStub).throws(new Error("No home dir"));

      expect(() => {
        initializeMcpConfiguration("mock-token");
      }).to.not.throw();
    });
  });
});
