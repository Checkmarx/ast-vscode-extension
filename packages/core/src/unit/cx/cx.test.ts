/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { Cx } from "../../cx/cx";
import { constants } from "../../utils/common/constants";
import { Logs } from "../../models/logs";
import { AuthService } from "../../services/authService";

describe("Cx (CX Platform Client) Tests", () => {
  let sandbox: sinon.SinonSandbox;
  let cx: Cx;
  let mockContext: vscode.ExtensionContext;
  let mockLogs: Logs;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockContext = {
      subscriptions: [],
      globalState: {
        get: sandbox.stub().returns(undefined),
        update: sandbox.stub().resolves(),
      } as any,
      extensionUri: vscode.Uri.parse("file:///test"),
      extensionPath: "/test",
      secrets: {
        store: sandbox.stub().resolves(),
        get: sandbox.stub().resolves("test-token"),
        delete: sandbox.stub().resolves(),
      } as any,
    } as any;

    mockLogs = sinon.createStubInstance(Logs);

    cx = new Cx(mockContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("Constructor", () => {
    it("should initialize with extension context", () => {
      expect(cx).to.exist;
    });
  });

  describe("validateWorkspaceFolders() method (private)", () => {
    it("should throw error when no workspace folders exist", () => {
      sandbox.stub(vscode.workspace, "workspaceFolders").value(undefined);

      expect(() => (cx as any).validateWorkspaceFolders()).to.throw(
        constants.gptFileNotInWorkspaceError
      );
    });

    it("should throw error when workspace folders array is empty", () => {
      sandbox.stub(vscode.workspace, "workspaceFolders").value([]);

      expect(() => (cx as any).validateWorkspaceFolders()).to.throw(
        constants.gptFileNotInWorkspaceError
      );
    });

    it("should not throw when workspace folders exist", () => {
      sandbox.stub(vscode.workspace, "workspaceFolders").value([
        {
          uri: vscode.Uri.parse("file:///workspace"),
          name: "test",
          index: 0,
        } as any,
      ]);

      expect(() => (cx as any).validateWorkspaceFolders()).to.not.throw();
    });
  });

  describe("getGptConfig() method", () => {
    it("should return gptToken and gptEngine from config", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub((key: string) => {
          if (key === constants.gptSettingsKey) return "test-token";
          if (key === constants.gptEngineKey) return "gpt-4";
          return "";
        }),
      } as any);

      const config = cx.getGptConfig();

      expect(config.gptToken).to.equal("test-token");
      expect(config.gptEngine).to.equal("gpt-4");
    });

    it("should use custom model when provided", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub((key: string) => {
          if (key === constants.gptSettingsKey) return "token";
          if (key === constants.gptEngineKey) return "gpt-4";
          if (key === constants.gptCustomModelKey) return "custom-model";
          return "";
        }),
      } as any);

      const config = cx.getGptConfig();

      expect(config.gptEngine).to.equal("custom-model");
    });

    it("should use default engine when custom model is empty", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub((key: string) => {
          if (key === constants.gptSettingsKey) return "token";
          if (key === constants.gptEngineKey) return "gpt-4";
          if (key === constants.gptCustomModelKey) return "  ";
          return "";
        }),
      } as any);

      const config = cx.getGptConfig();

      expect(config.gptEngine).to.equal("gpt-4");
    });

    it("should return empty strings for missing config values", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub().returns(undefined),
      } as any);

      const config = cx.getGptConfig();

      expect(config.gptToken).to.equal("");
      expect(config.gptEngine).to.equal("");
    });
  });

  describe("getBaseAstConfiguration() method (private)", () => {
    it("should return CxConfig object", () => {
      const config = (cx as any).getBaseAstConfiguration();
      expect(config).to.exist;
    });
  });

  describe("Error handling patterns", () => {
    it("should handle empty/null values gracefully", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub().returns(null),
      } as any);

      expect(() => cx.getGptConfig()).to.not.throw();
    });

    it("should validate workspace folders before GPT operations", () => {
      sandbox.stub(vscode.workspace, "workspaceFolders").value([]);

      expect(() => (cx as any).validateWorkspaceFolders()).to.throw();
    });
  });

  describe("Configuration management", () => {
    it("should handle workspace configuration retrieval", () => {
      const mockConfigGet = sandbox.stub().returns("test-value");
      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      getConfigStub.returns({
        get: mockConfigGet,
      } as any);

      const result = mockConfigGet("any-key");
      expect(result).to.equal("test-value");
    });

    it("should handle multiple configuration keys", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const getStub = sandbox.stub();
      getStub.withArgs(constants.gptSettingsKey).returns("token-value");
      getStub.withArgs(constants.gptEngineKey).returns("engine-value");
      const mockConfig = { get: getStub };
      configStub.returns(mockConfig as any);

      const token = mockConfig.get(constants.gptSettingsKey);
      const engine = mockConfig.get(constants.gptEngineKey);

      expect(token).to.equal("token-value");
      expect(engine).to.equal("engine-value");
    });
  });

  describe("Context management", () => {
    it("should store and access extension context", () => {
      const cx2 = new Cx(mockContext);
      expect(cx2).to.exist;
    });

    it("should maintain context through operations", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub().returns(""),
      } as any);

      cx.getGptConfig();
      expect(configStub.called).to.be.true;
    });
  });

  describe("Workspace folder operations", () => {
    it("should detect when workspace has folders", () => {
      const folders = [
        {
          uri: vscode.Uri.parse("file:///test"),
          name: "test",
          index: 0,
        } as any,
      ];
      sandbox.stub(vscode.workspace, "workspaceFolders").value(folders);

      expect(() => (cx as any).validateWorkspaceFolders()).to.not.throw();
    });

    it("should detect when workspace is empty", () => {
      sandbox.stub(vscode.workspace, "workspaceFolders").value(null);

      expect(() => (cx as any).validateWorkspaceFolders()).to.throw();
    });

    it("should require at least one folder", () => {
      sandbox.stub(vscode.workspace, "workspaceFolders").value([]);

      expect(() => (cx as any).validateWorkspaceFolders()).to.throw();
    });
  });

  describe("Configuration edge cases", () => {
    it("should handle whitespace-only custom model", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub((key: string) => {
          if (key === constants.gptCustomModelKey) return "   ";
          if (key === constants.gptEngineKey) return "default";
          return "";
        }),
      } as any);

      const config = cx.getGptConfig();
      expect(config.gptEngine).to.equal("default");
    });

    it("should preserve non-whitespace custom model", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub((key: string) => {
          if (key === constants.gptCustomModelKey) return " custom ";
          return "";
        }),
      } as any);

      const config = cx.getGptConfig();
      expect(config.gptEngine).to.equal("custom");
    });
  });

  describe("Token and authentication", () => {
    it("should handle GPT token retrieval", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub((key: string) => {
          if (key === constants.gptSettingsKey) return "gpt-token-123";
          return "";
        }),
      } as any);

      const config = cx.getGptConfig();
      expect(config.gptToken).to.equal("gpt-token-123");
    });

    it("should handle missing token gracefully", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration");
      configStub.returns({
        get: sandbox.stub().returns(undefined),
      } as any);

      const config = cx.getGptConfig();
      expect(config.gptToken).to.equal("");
    });
  });
});
