/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { mock, getRegisteredCommandCallback } from "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as path from "path";
import {
  decideSelfHealingPrompt,
  getCopilotConfigPath,
  getPluginDetectionWatchPaths,
  getVsCodeAgentPluginsCachePath,
  getVsCodeInstalledPluginsPath,
  getVsCodeUserDataDir,
  installCopilotPluginInVsCode,
  isCxDevAssistPluginAvailable,
  isCxDevAssistPluginInstalled,
  isCxDevAssistPluginInstalledInVsCode,
  isSelfHealingSupportedHost,
  onSelfHealingPostAuth,
  mergePluginMarketplaces,
  maybeShowSelfHealingPrompt,
  registerSelfHealing,
  resetSelfHealingSessionState,
  selfHealingMessages,
  SelfHealingPromptState,
  stripJsonComments,
} from "../../services/selfHealing";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs: typeof import("fs") = require("fs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const osAny: any = require("os");

const PLUGIN_ENTRY = {
  name: "cx-devassist",
  marketplace: "cx-devassist-marketplace",
  version: "1.0.3",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  cache_path: "C:\\Users\\me\\.copilot\\installed-plugins\\cx-devassist-marketplace\\cx-devassist",
  enabled: true,
};

function writeCopilotConfig(homeDir: string, text: string) {
  fs.mkdirSync(path.join(homeDir, ".copilot"), { recursive: true });
  fs.writeFileSync(getCopilotConfigPath(homeDir), text, "utf8");
}

function writeFile(filePath: string, text: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

const CACHE_URI_MARKETPLACE_REPO =
  "file:///c%3A/Users/me/AppData/Roaming/Code/agentPlugins/" +
  "file-c-3A-Users-me-vscode-agent-plugins-marketplace-repositories-github-com-Checkmarx-cx-agentic-ai-ref-main/plugins/cx-devassist";
const CACHE_URI_COPILOT_CLI = "file:///c%3A/Users/me/.copilot/installed-plugins/cx-devassist-marketplace/cx-devassist";

function fakeConfig(inspected: { globalValue?: unknown; defaultValue?: unknown } | undefined, update: sinon.SinonStub) {
  return { get: (_k: string, def?: unknown) => def, inspect: () => inspected, update } as any;
}

describe("Checkmarx Self-Healing", () => {
  let sandbox: sinon.SinonSandbox;
  let homeDir: string;
  let originalHomedir: () => string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    homeDir = fs.mkdtempSync(path.join(osAny.tmpdir(), "cx-self-heal-"));
    originalHomedir = osAny.homedir;
    osAny.homedir = () => homeDir;
    resetSelfHealingSessionState();
    setExtensionConfig({
      extensionId: "cx-dev-assist",
      commandPrefix: "cx-dev-assist",
      viewContainerPrefix: "ignite",
      displayName: "Checkmarx Developer Assist",
      extensionType: "cx-dev-assist",
    });
  });

  afterEach(() => {
    sandbox.restore();
    osAny.homedir = originalHomedir;
    resetExtensionConfig();
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  describe("stripJsonComments", () => {
    it("removes line and block comments and trailing commas but keeps strings intact", () => {
      const text = [
        "// User settings belong in settings.json.",
        "{",
        "  /* block */ \"url\": \"https://example.com//not-a-comment\",",
        "  \"path\": \"C:\\\\dir\\\\\", // trailing",
        "  \"text\": \"a,}\",",
        "  \"list\": [1, 2,],",
        "}",
      ].join("\n");
      expect(JSON.parse(stripJsonComments(text))).to.deep.equal({
        url: "https://example.com//not-a-comment",
        path: "C:\\dir\\",
        text: "a,}",
        list: [1, 2],
      });
    });
  });

  describe("isCxDevAssistPluginInstalled", () => {
    it("detects the plugin in a config.json with // comments", () => {
      writeCopilotConfig(
        homeDir,
        "// User settings belong in settings.json.\n// This file is managed automatically.\n" +
          JSON.stringify({ firstLaunchAt: "x", installedPlugins: [PLUGIN_ENTRY] }, null, 2)
      );
      expect(isCxDevAssistPluginInstalled(homeDir)).to.equal(true);
    });

    it("treats a missing enabled flag as enabled", () => {
      const { enabled, ...entry } = PLUGIN_ENTRY;
      void enabled;
      writeCopilotConfig(homeDir, JSON.stringify({ installedPlugins: [entry] }));
      expect(isCxDevAssistPluginInstalled(homeDir)).to.equal(true);
    });

    it("returns false when the file is missing", () => {
      expect(isCxDevAssistPluginInstalled(homeDir)).to.equal(false);
    });

    it("returns false when the plugin is disabled", () => {
      writeCopilotConfig(homeDir, JSON.stringify({ installedPlugins: [{ ...PLUGIN_ENTRY, enabled: false }] }));
      expect(isCxDevAssistPluginInstalled(homeDir)).to.equal(false);
    });

    it("returns false for another marketplace, no plugins or invalid JSON", () => {
      writeCopilotConfig(homeDir, JSON.stringify({ installedPlugins: [{ ...PLUGIN_ENTRY, marketplace: "other" }] }));
      expect(isCxDevAssistPluginInstalled(homeDir)).to.equal(false);
      writeCopilotConfig(homeDir, JSON.stringify({ firstLaunchAt: "x" }));
      expect(isCxDevAssistPluginInstalled(homeDir)).to.equal(false);
      writeCopilotConfig(homeDir, "{ not json");
      expect(isCxDevAssistPluginInstalled(homeDir)).to.equal(false);
    });

    it("reads ~/.copilot/config.json by default", () => {
      writeCopilotConfig(homeDir, JSON.stringify({ installedPlugins: [PLUGIN_ENTRY] }));
      expect(isCxDevAssistPluginInstalled()).to.equal(true);
    });
  });

  describe("VS Code plugin detection", () => {
    let userDataDir: string;

    beforeEach(() => {
      userDataDir = path.join(homeDir, "AppData", "Roaming", "Code");
    });

    describe("installed.json", () => {
      it("detects cx-devassist from Checkmarx/cx-agentic-ai", () => {
        writeFile(
          getVsCodeInstalledPluginsPath(homeDir),
          JSON.stringify([
            { name: "other", marketplace: "github/awesome-copilot" },
            { pluginUri: "file:///home/me/.vscode/agent-plugins/github.com/Checkmarx/cx-agentic-ai/plugins/cx-devassist", enabled: true },
          ])
        );
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(true);
      });

      it("matches copilot-devassist case-insensitively, also as a map key", () => {
        writeFile(
          getVsCodeInstalledPluginsPath(homeDir),
          JSON.stringify({ "https://github.com/CHECKMARX/CX-AGENTIC-AI/Copilot-DevAssist": { files: ["a", "b"] } })
        );
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(true);
      });

      it("returns false when the file is missing", () => {
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir, userDataDir })).to.equal(false);
      });

      it("does not combine two different entries into a match", () => {
        writeFile(
          getVsCodeInstalledPluginsPath(homeDir),
          JSON.stringify({
            plugins: [
              { name: "cx-devassist", marketplace: "someone/else" },
              { name: "other-plugin", marketplace: "Checkmarx/cx-agentic-ai" },
            ],
          })
        );
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(false);
      });

      it("falls back to a text search when the file is not valid JSON", () => {
        writeFile(getVsCodeInstalledPluginsPath(homeDir), "{ broken cx-devassist Checkmarx/cx-agentic-ai");
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(true);
        writeFile(getVsCodeInstalledPluginsPath(homeDir), "{ broken cx-devassist");
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(false);
      });

      it("accepts comments in the file", () => {
        writeFile(
          getVsCodeInstalledPluginsPath(homeDir),
          "// managed by VS Code\n" + JSON.stringify([{ name: "cx-devassist", marketplace: "Checkmarx/cx-agentic-ai" }])
        );
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(true);
      });
    });

    describe("agentPlugins/cache.json", () => {
      it("detects a marketplace-repo run copy of cx-devassist", () => {
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: CACHE_URI_MARKETPLACE_REPO, nonce: "1" }]));
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir, userDataDir })).to.equal(true);
      });

      it("detects the cx-devassist-marketplace/cx-devassist path", () => {
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: CACHE_URI_COPILOT_CLI, nonce: "1" }]));
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir, userDataDir })).to.equal(true);
      });

      it("returns false for other plugins, invalid JSON or no user-data dir", () => {
        const cachePath = getVsCodeAgentPluginsCachePath(userDataDir);
        writeFile(cachePath, JSON.stringify([{ uri: "file:///c%3A/x/github-com-github-awesome-copilot/plugins/foo", nonce: "1" }]));
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir, userDataDir })).to.equal(false);
        writeFile(cachePath, "[{ \"uri\": \"file:///x/other\", ");
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir, userDataDir })).to.equal(false);
        writeFile(cachePath, JSON.stringify([{ uri: CACHE_URI_COPILOT_CLI }]));
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(false);
      });
    });

    describe("getVsCodeUserDataDir", () => {
      it("walks up from the default profile's global storage", () => {
        const storage = path.join(userDataDir, "User", "globalStorage", "checkmarx.cx-dev-assist");
        expect(getVsCodeUserDataDir({ globalStorageUri: { fsPath: storage } } as any)).to.equal(path.resolve(userDataDir));
      });

      it("walks up from a named profile's global storage", () => {
        const storage = path.join(userDataDir, "User", "profiles", "-5a1b2c3d", "globalStorage", "checkmarx.ast-results");
        expect(getVsCodeUserDataDir({ globalStorageUri: { fsPath: storage } } as any)).to.equal(path.resolve(userDataDir));
      });

      it("returns undefined without global storage or without a User folder", () => {
        expect(getVsCodeUserDataDir(undefined)).to.equal(undefined);
        expect(getVsCodeUserDataDir({} as any)).to.equal(undefined);
        expect(getVsCodeUserDataDir({ globalStorageUri: { fsPath: path.join(homeDir, "x", "y") } } as any)).to.equal(undefined);
      });

      it("watches the cache.json of the derived user-data dir", () => {
        const storage = path.join(userDataDir, "User", "globalStorage", "checkmarx.cx-dev-assist");
        expect(getPluginDetectionWatchPaths({ globalStorageUri: { fsPath: storage } } as any)).to.deep.equal([
          getCopilotConfigPath(homeDir),
          getVsCodeInstalledPluginsPath(homeDir),
          path.join(path.resolve(userDataDir), "User", "agent-plugins", "installed.json"),
          getVsCodeAgentPluginsCachePath(path.resolve(userDataDir)),
        ]);
      });
    });

    describe("profile installed.json (VS Code's own installs)", () => {
      const entry = JSON.stringify([{ name: "cx-devassist", marketplace: "Checkmarx/cx-agentic-ai" }]);

      it("detects the default profile's <user-data>/User/agent-plugins/installed.json", () => {
        writeFile(path.join(userDataDir, "User", "agent-plugins", "installed.json"), entry);
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("detects a named profile's installed.json", () => {
        writeFile(path.join(userDataDir, "User", "profiles", "abc123", "agent-plugins", "installed.json"), entry);
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("ignores other plugins", () => {
        writeFile(path.join(userDataDir, "User", "agent-plugins", "installed.json"),
          JSON.stringify([{ name: "other", marketplace: "github/awesome-copilot" }]));
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(false);
      });
    });

    describe("isCxDevAssistPluginAvailable", () => {
      it("still detects a Copilot CLI-only install", () => {
        writeCopilotConfig(homeDir, JSON.stringify({ installedPlugins: [PLUGIN_ENTRY] }));
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("detects a VS Code-only install", () => {
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: CACHE_URI_MARKETPLACE_REPO }]));
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("returns false when neither is installed", () => {
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(false);
      });

      it("suppresses the plugin message when VS Code installed the plugin", async () => {
        sandbox.stub(mock.extensions, "getExtension").callsFake((id: string) =>
          id === constants.copilotChatExtensionId ? ({ id } as any) : undefined
        );
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: CACHE_URI_MARKETPLACE_REPO }]));
        const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
        const context: any = {
          globalState: { get: (_k: string, def?: unknown) => def, update: () => Promise.resolve() },
          globalStorageUri: { fsPath: path.join(userDataDir, "User", "globalStorage", "checkmarx.cx-dev-assist") },
        };
        expect(await maybeShowSelfHealingPrompt(context)).to.equal(undefined);
        expect(show.called).to.equal(false);
      });
    });
  });

  describe("mergePluginMarketplaces", () => {
    it("starts from the inspected default when the user value is unset", () => {
      expect(mergePluginMarketplaces(undefined, ["github/awesome-copilot#marketplace"])).to.deep.equal({
        value: ["github/awesome-copilot#marketplace", "Checkmarx/cx-agentic-ai"],
        changed: true,
      });
    });

    it("uses the VS Code default when no default can be inspected", () => {
      expect(mergePluginMarketplaces(undefined, undefined).value).to.deep.equal([
        "github/awesome-copilot#marketplace",
        "Checkmarx/cx-agentic-ai",
      ]);
    });

    it("leaves the value unchanged when the marketplace is already present", () => {
      for (const existing of ["Checkmarx/cx-agentic-ai", "checkmarx/cx-agentic-ai#main", "https://github.com/Checkmarx/cx-agentic-ai.git"]) {
        const userValue = ["github/awesome-copilot#marketplace", existing];
        expect(mergePluginMarketplaces(userValue, ["github/awesome-copilot#marketplace"])).to.deep.equal({
          value: userValue,
          changed: false,
        });
      }
    });

    it("keeps other user entries", () => {
      expect(mergePluginMarketplaces(["acme/plugins", "github/awesome-copilot#marketplace"], []).value).to.deep.equal([
        "acme/plugins",
        "github/awesome-copilot#marketplace",
        "Checkmarx/cx-agentic-ai",
      ]);
    });
  });

  describe("installCopilotPluginInVsCode", () => {
    it("adds the marketplace to the user settings and opens the plugin browser", async () => {
      const update = sandbox.stub().resolves();
      const getConfiguration = sandbox.stub(mock.workspace, "getConfiguration").returns(
        fakeConfig({ defaultValue: ["github/awesome-copilot#marketplace"] }, update)
      );
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await installCopilotPluginInVsCode();
      expect(getConfiguration.firstCall.args[0]).to.equal("chat.plugins");
      expect(update.firstCall.args).to.deep.equal([
        "marketplaces",
        ["github/awesome-copilot#marketplace", "Checkmarx/cx-agentic-ai"],
        mock.ConfigurationTarget.Global,
      ]);
      expect(execute.firstCall.args[0]).to.equal("workbench.agentPlugins.browse");
    });

    it("does not rewrite the setting when the marketplace is already there", async () => {
      const update = sandbox.stub().resolves();
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({ globalValue: ["Checkmarx/cx-agentic-ai"] }, update));
      sandbox.stub(mock.commands, "executeCommand").resolves();
      await installCopilotPluginInVsCode();
      expect(update.called).to.equal(false);
    });

    it("explains where to find the plugin browser when the command is missing", async () => {
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({}, sandbox.stub().resolves()));
      sandbox.stub(mock.commands, "executeCommand").rejects(new Error("command 'workbench.agentPlugins.browse' not found"));
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCopilotPluginInVsCode();
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.browsePluginsFallback);
    });

    it("still opens the plugin browser when the setting cannot be updated", async () => {
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({}, sandbox.stub().rejects(new Error("not registered"))));
      const warn = sandbox.stub(mock.window, "showWarningMessage").resolves(undefined);
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await installCopilotPluginInVsCode();
      expect(warn.calledOnce).to.equal(true);
      expect(execute.firstCall.args[0]).to.equal("workbench.agentPlugins.browse");
    });
  });

  describe("decideSelfHealingPrompt", () => {
    const base: SelfHealingPromptState = {
      selfHealingEnabled: true,
      copilotInstalled: true,
      pluginInstalled: true,
      dismissed: false,
      shownThisSession: false,
    };

    it("asks to install Copilot when Copilot is missing", () => {
      expect(decideSelfHealingPrompt({ ...base, copilotInstalled: false, pluginInstalled: false })).to.equal("installCopilot");
    });

    it("asks to install the plugin when Copilot is present but the plugin is not", () => {
      expect(decideSelfHealingPrompt({ ...base, pluginInstalled: false })).to.equal("installPlugin");
    });

    it("shows nothing when everything is installed", () => {
      expect(decideSelfHealingPrompt(base)).to.equal(undefined);
    });

    it("shows nothing when Self-Healing is off, dismissed or already shown", () => {
      const missing = { ...base, copilotInstalled: false };
      expect(decideSelfHealingPrompt({ ...missing, selfHealingEnabled: false })).to.equal(undefined);
      expect(decideSelfHealingPrompt({ ...missing, dismissed: true })).to.equal(undefined);
      expect(decideSelfHealingPrompt({ ...missing, shownThisSession: true })).to.equal(undefined);
    });
  });

  describe("maybeShowSelfHealingPrompt", () => {
    let globalState: Record<string, unknown>;
    let context: any;

    beforeEach(() => {
      globalState = {};
      context = {
        subscriptions: [],
        globalState: {
          get: (key: string, def?: unknown) => (key in globalState ? globalState[key] : def),
          update: (key: string, value: unknown) => {
            globalState[key] = value;
            return Promise.resolve();
          },
        },
        extension: { packageJSON: { version: "1.26.0" } },
      };
    });

    it("shows the Copilot message at most once per session", async () => {
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      expect(await maybeShowSelfHealingPrompt(context)).to.equal("installCopilot");
      expect(await maybeShowSelfHealingPrompt(context)).to.equal(undefined);
      expect(show.calledOnce).to.equal(true);
      expect(show.firstCall.args).to.deep.equal([
        selfHealingMessages.installCopilot,
        selfHealingMessages.installCopilotButton,
        selfHealingMessages.dontShowAgainButton,
      ]);
    });

    it("shows the plugin message when Copilot is installed and the plugin is not", async () => {
      sandbox.stub(mock.extensions, "getExtension").callsFake((id: string) =>
        id === constants.copilotChatExtensionId ? ({ id } as any) : undefined
      );
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      expect(await maybeShowSelfHealingPrompt(context)).to.equal("installPlugin");
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.installPlugin);
    });

    it("stores Don't show again per extension and then stays silent", async () => {
      sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.dontShowAgainButton as any);
      await maybeShowSelfHealingPrompt(context);
      await new Promise(resolve => setImmediate(resolve));
      expect(globalState[constants.getSelfHealingDontShowAgainKey()]).to.equal(true);
      expect(constants.getSelfHealingDontShowAgainKey()).to.equal("selfHealingPromptDismissedDevAssist");

      resetSelfHealingSessionState();
      expect(await maybeShowSelfHealingPrompt(context)).to.equal(undefined);
    });

    it("stays silent when Self-Healing is off", async () => {
      sandbox.stub(mock.workspace, "getConfiguration").callsFake(() => ({
        get: (key: string, def?: unknown) => (key === constants.activateSelfHealing ? false : def),
      }) as any);
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      expect(await maybeShowSelfHealingPrompt(context)).to.equal(undefined);
      expect(show.called).to.equal(false);
    });
  });

  describe("VS Code forks", () => {
    it("isSelfHealingSupportedHost accepts VS Code only", () => {
      expect(isSelfHealingSupportedHost("Visual Studio Code")).to.equal(true);
      expect(isSelfHealingSupportedHost("Visual Studio Code - Insiders")).to.equal(true);
      for (const fork of ["Cursor", "Windsurf", "Windsurf - Next", "Kiro", "Devin", "Devin - Next", "VSCodium", ""]) {
        expect(isSelfHealingSupportedHost(fork), fork).to.equal(false);
      }
    });

    it("does nothing in a fork except explain the command", async () => {
      const origAppName = mock.env.appName;
      (mock.env as any).appName = "Cursor";
      const context: any = {
        subscriptions: [],
        globalState: { get: () => undefined, update: () => Promise.resolve() },
        extension: { packageJSON: { version: "1.26.0" } },
      };
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };
      try {
        registerSelfHealing(context, logs);
        await onSelfHealingPostAuth(context, logs);
        expect(fs.existsSync(path.join(homeDir, ".checkmarx", "cx-onboarding-ide.properties"))).to.equal(false);
        expect(context.subscriptions.length).to.equal(1);
        const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
        await getRegisteredCommandCallback("cx-dev-assist.installCopilotPlugin")();
        expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.vsCodeOnly);
      } finally {
        (mock.env as any).appName = origAppName;
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });
  });

  describe("registerSelfHealing", () => {
    it("registers the install command, writes the properties file and copies the commands", async () => {
      const context: any = {
        subscriptions: [],
        globalState: { get: () => undefined, update: () => Promise.resolve() },
        extension: { packageJSON: { version: "1.26.0" } },
      };
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };

      registerSelfHealing(context, logs);
      try {
        const content = fs.readFileSync(path.join(homeDir, ".checkmarx", "cx-onboarding-ide.properties"), "utf8");
        expect(content).to.contain("cx_self_healing_enabled=true");
        expect(content).to.contain("cx_ide_extension=cx-dev-assist");
        expect(content).to.contain("cx_ide_version=1.26.0");

        const callback = getRegisteredCommandCallback("cx-dev-assist.installCopilotPlugin");
        expect(callback).to.be.a("function");
        const show = sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.copyCommandsButton as any);
        const writeText = sandbox.stub(mock.env.clipboard, "writeText").resolves();
        await callback();
        expect((writeText.firstCall.args as any[])[0]).to.equal(
          "/plugin marketplace add Checkmarx/cx-agentic-ai\n/plugin install cx-devassist@cx-devassist-marketplace"
        );
        expect((show.firstCall.args as any[]).slice(1)).to.deep.equal([
          selfHealingMessages.installInVsCodeButton,
          selfHealingMessages.copyCommandsButton,
          selfHealingMessages.openGuideButton,
        ]);

        show.resolves(selfHealingMessages.installInVsCodeButton as any);
        const update = sandbox.stub().resolves();
        sandbox.stub(mock.workspace, "getConfiguration").returns(
          fakeConfig({ defaultValue: ["github/awesome-copilot#marketplace"] }, update)
        );
        const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
        await callback();
        expect(update.calledOnce).to.equal(true);
        expect(execute.firstCall.args[0]).to.equal("workbench.agentPlugins.browse");
      } finally {
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });
  });
});
