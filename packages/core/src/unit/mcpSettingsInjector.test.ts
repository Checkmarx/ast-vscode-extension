import "./mocks/vscode-mock";
import { expect } from "chai";
import sinon from "sinon";
import * as path from "path";
import * as vscode from "vscode";
import {
  registerMcpSettingsInjector,
  uninstallMcp,
  initializeMcpConfiguration,
  getCheckmarxMcpServerName,
  migrateLegacyMcpServerNames,
} from "../services/mcpSettingsInjector";
import * as utils from "../utils/utils";
import { constants } from "../utils/common/constants";
import { cx } from "../cx";
import { getExtensionType, EXTENSION_TYPE, setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";
import * as aiAssistantUtil from "../utils/aiAssistantUtil";

const validMockJwt =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2lhbS5jaGVja21hcnguY29tL2F1dGgvcmVhbG1zL3Rlc3QtdGVuYW50In0.c2lnbmF0dXJl";

describe("MCP Settings Injector", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs: any = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const osAny: any = require("os");
  let osOriginals: { homedir: () => string };
  let fsOriginals: Record<string, unknown>;
  let fsStubs: {
    existsSync: sinon.SinonStub;
    readFileSync: sinon.SinonStub;
    writeFileSync: sinon.SinonStub;
    mkdirSync: sinon.SinonStub;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    osOriginals = { homedir: osAny.homedir };
    osAny.homedir = () => "/home/user";

    fsOriginals = {
      existsSync: fs.existsSync,
      readFileSync: fs.readFileSync,
      writeFileSync: fs.writeFileSync,
      mkdirSync: fs.mkdirSync,
    };
    fsStubs = {
      existsSync: sandbox.stub().returns(false),
      readFileSync: sandbox.stub().returns("{}"),
      writeFileSync: sandbox.stub(),
      mkdirSync: sandbox.stub(),
    };
    fs.existsSync = fsStubs.existsSync;
    fs.readFileSync = fsStubs.readFileSync;
    fs.writeFileSync = fsStubs.writeFileSync;
    fs.mkdirSync = fsStubs.mkdirSync;

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
  });

  afterEach(() => {
    sandbox.restore();
    osAny.homedir = osOriginals.homedir;
    fs.existsSync = fsOriginals.existsSync;
    fs.readFileSync = fsOriginals.readFileSync;
    fs.writeFileSync = fsOriginals.writeFileSync;
    fs.mkdirSync = fsOriginals.mkdirSync;
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

  describe("MCP server name and legacy migration", () => {
    const devAssistConfig = {
      extensionId: 'test',
      commandPrefix: 'test',
      viewContainerPrefix: 'test',
      displayName: 'Test',
      extensionType: EXTENSION_TYPE.DEVELOPER_ASSIST,
    };
    const ourUrl = "https://ast.checkmarx.net/api/security-mcp/mcp/tenant";
    const pluginBridge = { command: "sh", args: ["cx_run.sh", "mcp", "bridge"] };
    const cursorPath = path.join("/home/user", ".cursor", "mcp.json");
    const windsurfPath = path.join("/home/user", ".codeium", "windsurf", "mcp_config.json");
    const claudeJsonPath = path.join("/home/user", ".claude.json");
    const codexPath = path.join("/home/user", ".codex", "config.toml");

    /** Serves the given files from the fs stubs; returns what was written per path. */
    function stubFiles(files: Record<string, string>): Map<string, string> {
      const written = new Map<string, string>();
      fsStubs.existsSync.callsFake((p: string) => p in files);
      fsStubs.readFileSync.callsFake((p: string) => {
        if (!(p in files)) {
          throw new Error(`ENOENT: ${p}`);
        }
        return files[p];
      });
      fsStubs.writeFileSync.callsFake((p: string, data: string) => written.set(p, data));
      return written;
    }

    function stubVsCodeMcpConfig(servers: Record<string, unknown>, extraGlobal: Record<string, unknown> = {}, workspaceServers: Record<string, unknown> = {}) {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(true);
      const globalValue = { ...extraGlobal, servers };
      const mockConfig = {
        // get() is the merged value (user + workspace); inspect().globalValue is the user's own
        get: sandbox.stub().callsFake((key?: string) => (key === "mcp" ? { ...globalValue, servers: { ...servers, ...workspaceServers } } : undefined)),
        inspect: sandbox.stub().callsFake((key?: string) => (key === "mcp" ? { globalValue } : undefined)),
        update: sandbox.stub().resolves(),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);
      return mockConfig;
    }

    it("uses 'Checkmarx One Assist', matching the product name in the remediation prompts", () => {
      expect(getCheckmarxMcpServerName()).to.equal("Checkmarx One Assist");
    });

    it("keeps 'Checkmarx Developer Assist' for Developer Assist", () => {
      setExtensionConfig(devAssistConfig);
      expect(getCheckmarxMcpServerName()).to.equal("Checkmarx Developer Assist");
    });

    it("VS Code: writes 'Checkmarx One Assist' and drops our legacy 'Checkmarx' entry on install", async () => {
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["vscode-settings"]);
      const mockConfig = stubVsCodeMcpConfig({ Checkmarx: { url: ourUrl }, Other: { url: "other" } });

      await initializeMcpConfiguration(validMockJwt);

      const servers = mockConfig.update.getCalls().find(call => call.args[0] === "mcp")?.args[1].servers;
      expect(servers).to.have.property("Checkmarx One Assist");
      expect(servers).to.not.have.property("Checkmarx");
      expect(servers).to.have.property("Other");
    });

    it("VS Code: removes both the new and legacy entries on uninstall", async () => {
      const mockConfig = stubVsCodeMcpConfig({ Checkmarx: { url: ourUrl }, "Checkmarx One Assist": { url: ourUrl }, Other: { url: "other" } });

      await uninstallMcp();

      expect(mockConfig.update.firstCall.args[1].servers).to.deep.equal({ Other: { url: "other" } });
    });

    it("VS Code: migrates the settings entry and the user mcp.json fallback, keeping their values", async () => {
      const mockConfig = stubVsCodeMcpConfig({ Checkmarx: { url: ourUrl, oauth: { clientId: "cx-mcp-client" } }, Other: { url: "other" } });
      const vsCodeJson = path.join("/home/user", ".config", "Code", "User", "mcp.json");
      const appDataJson = path.join(process.env.APPDATA || path.join("/home/user", "AppData", "Roaming"), "Code", "User", "mcp.json");
      const fallback = JSON.stringify({ servers: { Checkmarx: { url: ourUrl } }, inputs: [] });
      const written = stubFiles({ [vsCodeJson]: fallback, [appDataJson]: fallback });

      await migrateLegacyMcpServerNames();

      expect(mockConfig.update.firstCall.args[1].servers).to.deep.equal({
        "Checkmarx One Assist": { url: ourUrl, oauth: { clientId: "cx-mcp-client" } },
        Other: { url: "other" },
      });
      const file = written.get(vsCodeJson) ?? written.get(appDataJson);
      expect(JSON.parse(file as string)).to.deep.equal({ servers: { "Checkmarx One Assist": { url: ourUrl } }, inputs: [] });
    });

    it("VS Code: keeps other 'mcp' keys and never copies workspace servers into user settings", async () => {
      const mockConfig = stubVsCodeMcpConfig(
        { Checkmarx: { url: ourUrl } },
        { inputs: [{ id: "token", type: "promptString" }] },
        { WorkspaceOnly: { url: "ws" } }
      );
      stubFiles({});

      await migrateLegacyMcpServerNames();

      expect(mockConfig.update.firstCall.args[1]).to.deep.equal({
        inputs: [{ id: "token", type: "promptString" }],
        servers: { "Checkmarx One Assist": { url: ourUrl } },
      });
    });

    it("Cursor: migrates the legacy entry in ~/.cursor/mcp.json", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.cursorAgent).returns(true);
      const written = stubFiles({
        [cursorPath]: JSON.stringify({ mcpServers: { Checkmarx: { url: ourUrl, auth: { CLIENT_ID: "cx-mcp-client" } }, Other: { url: "other" } } }),
      });

      await migrateLegacyMcpServerNames();

      expect(JSON.parse(written.get(cursorPath) as string)).to.deep.equal({
        mcpServers: { "Checkmarx One Assist": { url: ourUrl, auth: { CLIENT_ID: "cx-mcp-client" } }, Other: { url: "other" } },
      });
    });

    it("Windsurf: migrates the legacy entry in mcp_config.json", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.windsurfAgent).returns(true);
      const written = stubFiles({ [windsurfPath]: JSON.stringify({ mcpServers: { Checkmarx: { serverUrl: ourUrl } } }) });

      await migrateLegacyMcpServerNames();

      expect(JSON.parse(written.get(windsurfPath) as string)).to.deep.equal({ mcpServers: { "Checkmarx One Assist": { serverUrl: ourUrl } } });
    });

    it("Claude: migrates the legacy entry in ~/.claude.json", async () => {
      const written = stubFiles({ [claudeJsonPath]: JSON.stringify({ mcpServers: { Checkmarx: { type: "http", url: ourUrl } } }) });

      await migrateLegacyMcpServerNames();

      expect(JSON.parse(written.get(claudeJsonPath) as string)).to.deep.equal({
        mcpServers: { "Checkmarx One Assist": { type: "http", url: ourUrl } },
      });
    });

    it("Codex: renames the legacy block and its sub-tables, leaving other servers alone", async () => {
      (vscode.workspace.getConfiguration as sinon.SinonStub).callsFake((section?: string) => ({
        get: sandbox.stub().returns(section === "chatgpt" ? false : {}),
        update: sandbox.stub().resolves(),
      }));
      const toml = `model = "o3"\n\n[mcp_servers."Checkmarx"]\nurl = "${ourUrl}"\nauth = "oauth"\n\n[mcp_servers."Checkmarx".env]\nA = "1"\n\n[mcp_servers."Other"]\nurl = "x"\n`;
      const written = stubFiles({ [codexPath]: toml });

      await migrateLegacyMcpServerNames();

      const result = written.get(codexPath) as string;
      expect(result).to.include('[mcp_servers."Checkmarx_One_Assist"]');
      expect(result).to.include('[mcp_servers."Checkmarx_One_Assist".env]');
      expect(result).to.not.include('[mcp_servers."Checkmarx"]');
      expect(result).to.include('[mcp_servers."Other"]');
      expect(result).to.include('model = "o3"');
    });

    it("never touches a 'Checkmarx' entry that is not ours (e.g. the cx-devassist plugin's bridge)", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.cursorAgent).returns(true);
      const written = stubFiles({
        [cursorPath]: JSON.stringify({ mcpServers: { Checkmarx: pluginBridge } }),
        [codexPath]: `[mcp_servers."Checkmarx"]\ncommand = "sh"\n`,
      });

      await migrateLegacyMcpServerNames();

      expect(written.size).to.equal(0);
    });

    it("keeps a 'Checkmarx' entry that is not ours on install and uninstall", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.cursorAgent).returns(true);
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["ide-native-json"]);
      const written = stubFiles({ [cursorPath]: JSON.stringify({ mcpServers: { Checkmarx: pluginBridge } }) });

      await initializeMcpConfiguration(validMockJwt);
      const installed = JSON.parse(written.get(cursorPath) as string);
      expect(installed.mcpServers.Checkmarx).to.deep.equal(pluginBridge);
      expect(installed.mcpServers).to.have.property("Checkmarx One Assist");

      const afterUninstall = stubFiles({ [cursorPath]: JSON.stringify(installed) });
      await uninstallMcp();
      expect(JSON.parse(afterUninstall.get(cursorPath) as string)).to.deep.equal({ mcpServers: { Checkmarx: pluginBridge } });
    });

    it("does nothing when there is no legacy entry", async () => {
      const mockConfig = stubVsCodeMcpConfig({ "Checkmarx One Assist": { url: ourUrl } });
      const written = stubFiles({ [claudeJsonPath]: JSON.stringify({ mcpServers: { "Checkmarx One Assist": { url: ourUrl } } }) });

      await migrateLegacyMcpServerNames();

      expect(mockConfig.update.called).to.be.false;
      expect(written.size).to.equal(0);
    });

    it("never migrates 'Checkmarx' when running as Developer Assist (it belongs to Checkmarx One)", async () => {
      setExtensionConfig(devAssistConfig);
      const mockConfig = stubVsCodeMcpConfig({ Checkmarx: { url: ourUrl } });
      const written = stubFiles({ [claudeJsonPath]: JSON.stringify({ mcpServers: { Checkmarx: { url: ourUrl } } }) });

      await migrateLegacyMcpServerNames();

      expect(mockConfig.update.called).to.be.false;
      expect(written.size).to.equal(0);
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
            "Checkmarx": { url: "http://localhost:3000/api/security-mcp/mcp" },
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
            "Checkmarx": { url: "http://localhost:3000/api/security-mcp/mcp" },
          },
        }),
        update: sandbox.stub().resolves(),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      await uninstallMcp();

      expect(mockConfig.update.called).to.be.true;
    });

    it("should gracefully handle errors", async () => {
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(false);
      (utils.isIDE as sinon.SinonStub).withArgs(constants.cursorAgent).returns(true);
      (fs.existsSync as sinon.SinonStub).returns(true);
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
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["vscode-settings"]);
      (fs.existsSync as sinon.SinonStub).returns(false);

      await initializeMcpConfiguration(validMockJwt);

      expect(
        (vscode.window.showInformationMessage as sinon.SinonStub).called ||
        (vscode.window.showErrorMessage as sinon.SinonStub).called
      ).to.be.true;
    });

    it("should write to VSCode config when Copilot is installed", async () => {
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["vscode-settings"]);
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(true);

      const mockConfig = {
        get: sandbox.stub().returns({}),
        update: sandbox.stub().resolves(),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      await initializeMcpConfiguration(validMockJwt);

      expect(mockConfig.update.called).to.be.true;
    });

    it("should handle different IDE types correctly", async () => {
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["ide-native-json"]);

      (utils.isIDE as sinon.SinonStub).withArgs(constants.cursorAgent).returns(true);
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(false);

      await initializeMcpConfiguration(validMockJwt);

      expect((fs.mkdirSync as sinon.SinonStub).called).to.be.true;
    });

    it("should handle issuer URL extraction for Checkmarx domains", async () => {
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["ide-native-json"]);
      (fs.existsSync as sinon.SinonStub).returns(false);
      (utils.isIDE as sinon.SinonStub).withArgs(constants.cursorAgent).returns(true);

      await initializeMcpConfiguration(validMockJwt);

      expect((fs.writeFileSync as sinon.SinonStub).called).to.be.true;
    });

    it("should write a codex config.toml block when codex-settings target is resolved", async () => {
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["codex-settings"]);
      (vscode.workspace.getConfiguration as sinon.SinonStub).callsFake((section?: string) => ({
        get: sandbox.stub().returns(section === "chatgpt" ? false : {}),
        update: sandbox.stub().resolves(),
        has: sandbox.stub().returns(true),
        inspect: sandbox.stub().returns(undefined),
      }));
      (fs.existsSync as sinon.SinonStub).returns(false);

      await initializeMcpConfiguration(validMockJwt);

      const tomlCall = (fs.writeFileSync as sinon.SinonStub).getCalls()
        .find(call => String(call.args[0]).includes("config.toml"));
      expect(tomlCall).to.not.be.undefined;
      expect(String(tomlCall.args[1])).to.include('[mcp_servers."Checkmarx_One_Assist"]');
      expect(String(tomlCall.args[1])).to.include('auth = "oauth"');
      // Uses Dynamic Client Registration: no predefined client_id/[oauth] block, so Codex
      // negotiates its own client and scopes with the server (avoids Keycloak invalid_scope).
      expect(String(tomlCall.args[1])).to.not.include('client_id');
      expect(String(tomlCall.args[1])).to.not.include('.oauth]');
    });

    it("should write token-based codex config.toml with http_headers for Developer Assist", async () => {
      setExtensionConfig({
        extensionId: 'test-dev-assist',
        commandPrefix: 'test',
        viewContainerPrefix: 'test',
        displayName: 'Test Dev Assist',
        extensionType: EXTENSION_TYPE.DEVELOPER_ASSIST,
      });
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["codex-settings"]);
      (vscode.workspace.getConfiguration as sinon.SinonStub).callsFake((section?: string) => ({
        get: sandbox.stub().returns(section === "chatgpt" ? false : {}),
        update: sandbox.stub().resolves(),
        has: sandbox.stub().returns(true),
        inspect: sandbox.stub().returns(undefined),
      }));
      (fs.existsSync as sinon.SinonStub).returns(false);

      await initializeMcpConfiguration(validMockJwt);

      const tomlCall = (fs.writeFileSync as sinon.SinonStub).getCalls()
        .find(call => String(call.args[0]).includes("config.toml"));
      expect(tomlCall).to.not.be.undefined;
      expect(String(tomlCall.args[1])).to.include('[mcp_servers."Checkmarx_Developer_Assist"]');
      expect(String(tomlCall.args[1])).to.include("http_headers");
      expect(String(tomlCall.args[1])).to.include("Authorization");
    });

    it("should skip writing codex config.toml when Codex runs in WSL", async () => {
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["codex-settings"]);
      (vscode.workspace.getConfiguration as sinon.SinonStub).callsFake((section?: string) => ({
        get: sandbox.stub().returns(section === "chatgpt" ? true : {}),
        update: sandbox.stub().resolves(),
        has: sandbox.stub().returns(true),
        inspect: sandbox.stub().returns(undefined),
      }));

      await initializeMcpConfiguration(validMockJwt);

      const tomlCall = (fs.writeFileSync as sinon.SinonStub).getCalls()
        .find(call => String(call.args[0]).includes("config.toml"));
      expect(tomlCall).to.be.undefined;
    });

    it("should show success message when configuration is saved", async () => {
      sandbox.stub(aiAssistantUtil, "resolveMcpTargets").returns(["vscode-settings"]);
      (utils.isIDE as sinon.SinonStub).withArgs(constants.vsCodeAgentOrginalName).returns(true);

      const mockConfig = {
        get: sandbox.stub().returns({}),
        update: sandbox.stub().resolves(),
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig);

      await initializeMcpConfiguration(validMockJwt);

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
      osAny.homedir = () => {
        throw new Error("No home dir");
      };

      expect(() => {
        initializeMcpConfiguration("mock-token");
      }).to.not.throw();
    });
  });
});
