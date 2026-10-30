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
  alreadyInstalledMessage,
  findCopilotCli,
  parseCopilotShimProbe,
  resolveCopilotCli,
  getCopilotCliPluginDir,
  getCopilotCliPluginLocation,
  getCxDevAssistInstallLocations,
  installCxDevAssistPluginInVsCode,
  isCxDevAssistPluginAvailable,
  isCxDevAssistPluginInstalled,
  isCxDevAssistPluginInstalledInVsCode,
  isSelfHealingSupportedHost,
  onPluginDetectionChanged,
  onSelfHealingLogout,
  onSelfHealingPostAuth,
  onSelfHealingTurnedOn,
  maybeShowSelfHealingPrompt,
  registerSelfHealing,
  resetSelfHealingSessionState,
  selfHealingMessages,
  setPluginDetectedForTests,
  SelfHealingPromptState,
  setCopilotCliDeps,
  stripJsonComments,
} from "../../services/selfHealing";
import { pathToFileURL } from "url";
import { commands } from "../../utils/common/commandBuilder";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";
import { setIdeOnboardingAuthenticated } from "../../services/ideOnboardingProperties";

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

/** `copilot plugin list --json` reports cx-devassist (the CLI's own answer, see getCopilotCliPluginLocation). */
function stubCopilotCliListing(plugins: unknown[] = [PLUGIN_ENTRY]) {
  setCopilotCliDeps({ find: () => "copilot", run: () => Promise.resolve({ ok: true, output: JSON.stringify(plugins) }) });
}

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
    // Never run the real Copilot CLI from the tests
    setCopilotCliDeps({ find: () => undefined, run: () => Promise.resolve({ ok: false, output: "not in tests" }) });
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
    setCopilotCliDeps();
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

  describe("turning Self-Healing on", () => {
    const context = (): any => ({ subscriptions: [], globalState: { get: () => undefined, update: () => Promise.resolve() } });
    const logs = (): any => ({ info: sinon.stub(), warn: sinon.stub(), error: sinon.stub() });
    const flush = () => new Promise(resolve => setImmediate(resolve));

    it("tells other editors that Self-Healing is not supported", async () => {
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
      await onSelfHealingTurnedOn(context(), logs(), "Cursor");
      expect(show.calledOnce).to.equal(true);
      expect((show.firstCall.args as any[])[0]).to.equal(`${selfHealingMessages.unsupportedEditor} (Cursor)`);
    });

    it("shows the ready message in VS Code when cx-devassist is installed", async () => {
      stubCopilotCliListing();
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
      await onSelfHealingTurnedOn(context(), logs(), "Visual Studio Code");
      expect(show.calledOnce).to.equal(true);
      expect(show.firstCall.args).to.deep.equal([selfHealingMessages.pluginReady]);
    });

    it("prompts to install cx-devassist in VS Code when it is missing", async () => {
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
      await onSelfHealingTurnedOn(context(), logs(), "Visual Studio Code");
      expect(show.firstCall.args).to.deep.equal([
        selfHealingMessages.pluginNeeded,
        selfHealingMessages.installPluginButton,
        selfHealingMessages.installationGuideButton,
      ]);
    });

    it("runs the install command or opens the guide from the missing-plugin popup", async () => {
      const executeCommand = sandbox.stub(mock.commands, "executeCommand").resolves(undefined as any);
      const openExternal = sandbox.stub(mock.env, "openExternal").resolves(true as any);

      sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.installPluginButton as any);
      await onSelfHealingTurnedOn(context(), logs(), "Visual Studio Code");
      await flush();
      expect(executeCommand.calledWith(commands.installCxDevAssistPlugin)).to.equal(true);

      (mock.window.showInformationMessage as sinon.SinonStub).resolves(selfHealingMessages.installationGuideButton as any);
      await onSelfHealingTurnedOn(context(), logs(), "Visual Studio Code");
      await flush();
      expect(openExternal.calledOnce).to.equal(true);
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

    /** A file: uri for a plugin folder under the temp home, created unless `missing`. */
    function folderUri(segments: string[], missing = false): string {
      const dir = path.join(homeDir, ...segments);
      if (!missing) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return pathToFileURL(dir).href;
    }
    const marketplaceRunCopy = () => folderUri(["AppData", "Roaming", "Code", "agentPlugins",
      "file-c-3A-Users-me-vscode-agent-plugins-marketplace-repositories-github-com-Checkmarx-cx-agentic-ai-ref-main", "plugins", "cx-devassist"]);
    const cliRunCopy = (missing = false) => folderUri([".copilot", "installed-plugins", "cx-devassist-marketplace", "cx-devassist"], missing);

    describe("installed.json", () => {
      it("detects cx-devassist from Checkmarx/cx-agentic-ai", async () => {
        writeFile(
          getVsCodeInstalledPluginsPath(homeDir),
          JSON.stringify([
            { name: "other", marketplace: "github/awesome-copilot" },
            { pluginUri: "file:///home/me/.vscode/agent-plugins/github.com/Checkmarx/cx-agentic-ai/plugins/cx-devassist", enabled: true },
          ])
        );
        expect(await isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(true);
      });

      it("matches copilot-devassist case-insensitively, also as a map key", async () => {
        writeFile(
          getVsCodeInstalledPluginsPath(homeDir),
          JSON.stringify({ "https://github.com/CHECKMARX/CX-AGENTIC-AI/Copilot-DevAssist": { files: ["a", "b"] } })
        );
        expect(await isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(true);
      });

      it("returns false when the file is missing", async () => {
        expect(await isCxDevAssistPluginInstalledInVsCode({ homeDir, userDataDir })).to.equal(false);
      });

      it("does not combine two different entries into a match", async () => {
        writeFile(
          getVsCodeInstalledPluginsPath(homeDir),
          JSON.stringify({
            plugins: [
              { name: "cx-devassist", marketplace: "someone/else" },
              { name: "other-plugin", marketplace: "Checkmarx/cx-agentic-ai" },
            ],
          })
        );
        expect(await isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(false);
      });

      it("falls back to a text search when the file is not valid JSON", async () => {
        writeFile(getVsCodeInstalledPluginsPath(homeDir), "{ broken cx-devassist Checkmarx/cx-agentic-ai");
        expect(await isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(true);
        writeFile(getVsCodeInstalledPluginsPath(homeDir), "{ broken cx-devassist");
        expect(await isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(false);
      });

      it("accepts comments in the file", async () => {
        writeFile(
          getVsCodeInstalledPluginsPath(homeDir),
          "// managed by VS Code\n" + JSON.stringify([{ name: "cx-devassist", marketplace: "Checkmarx/cx-agentic-ai" }])
        );
        expect(await isCxDevAssistPluginInstalledInVsCode({ homeDir })).to.equal(true);
      });
    });

    describe("Copilot CLI (copilot plugin list --json)", () => {
      const listing = (plugins: unknown) =>
        setCopilotCliDeps({ find: () => "copilot", run: sandbox.stub().resolves({ ok: true, output: JSON.stringify(plugins) }) });

      it("detects cx-devassist in the CLI's own listing", async () => {
        listing([PLUGIN_ENTRY]);
        expect(await getCopilotCliPluginLocation()).to.equal("copilot");
      });

      it("accepts a listing wrapped in a plugins array", async () => {
        listing({ plugins: [PLUGIN_ENTRY] });
        expect(await getCopilotCliPluginLocation()).to.equal("copilot");
      });

      it("ignores an empty listing, a disabled plugin or another plugin", async () => {
        listing([]);
        expect(await getCopilotCliPluginLocation()).to.equal(undefined);
        listing([{ ...PLUGIN_ENTRY, enabled: false }]);
        expect(await getCopilotCliPluginLocation()).to.equal(undefined);
        listing([{ ...PLUGIN_ENTRY, name: "other-plugin" }]);
        expect(await getCopilotCliPluginLocation()).to.equal(undefined);
      });

      it("returns nothing when the CLI is missing, fails or prints invalid JSON", async () => {
        setCopilotCliDeps({ find: () => undefined, run: sandbox.stub().resolves({ ok: true, output: "[]" }) });
        expect(await getCopilotCliPluginLocation()).to.equal(undefined);
        setCopilotCliDeps({ find: () => "copilot", run: sandbox.stub().resolves({ ok: false, output: "error" }) });
        expect(await getCopilotCliPluginLocation()).to.equal(undefined);
        setCopilotCliDeps({ find: () => "copilot", run: sandbox.stub().resolves({ ok: true, output: "not json" }) });
        expect(await getCopilotCliPluginLocation()).to.equal(undefined);
      });

      it("runs copilot plugin list --json", async () => {
        const run = sandbox.stub().resolves({ ok: true, output: "[]" });
        setCopilotCliDeps({ find: () => "copilot", run });
        await getCopilotCliPluginLocation();
        expect(run.calledWith("copilot", ["plugin", "list", "--json"])).to.equal(true);
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

      it("detects the default profile's <user-data>/User/agent-plugins/installed.json", async () => {
        writeFile(path.join(userDataDir, "User", "agent-plugins", "installed.json"), entry);
        expect(await isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("detects a named profile's installed.json", async () => {
        writeFile(path.join(userDataDir, "User", "profiles", "abc123", "agent-plugins", "installed.json"), entry);
        expect(await isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("ignores other plugins", async () => {
        writeFile(path.join(userDataDir, "User", "agent-plugins", "installed.json"),
          JSON.stringify([{ name: "other", marketplace: "github/awesome-copilot" }]));
        expect(await isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(false);
      });
    });

    describe("isCxDevAssistPluginAvailable", () => {
      it("detects a Copilot CLI-only install", async () => {
        setCopilotCliDeps({ find: () => "copilot", run: sandbox.stub().resolves({ ok: true, output: JSON.stringify([PLUGIN_ENTRY]) }) });
        expect(await isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("detects a VS Code-only install", async () => {
        writeFile(path.join(userDataDir, "User", "agent-plugins", "installed.json"),
          JSON.stringify([{ name: "cx-devassist", marketplace: "Checkmarx/cx-agentic-ai" }]));
        expect(await isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("returns false when neither is installed", async () => {
        expect(await isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(false);
      });

      it("reports each install location, Copilot CLI first", async () => {
        setCopilotCliDeps({ find: () => "copilot", run: sandbox.stub().resolves({ ok: true, output: JSON.stringify([PLUGIN_ENTRY]) }) });
        const profileFile = path.join(userDataDir, "User", "agent-plugins", "installed.json");
        writeFile(profileFile, JSON.stringify([{ name: "cx-devassist", marketplace: "Checkmarx/cx-agentic-ai" }]));
        expect(await getCxDevAssistInstallLocations({ homeDir, userDataDir })).to.deep.equal([
          { source: "copilotCli", path: "copilot" },
          { source: "vscode", path: profileFile },
        ]);
      });

      it("suppresses the plugin message when VS Code installed the plugin", async () => {
        sandbox.stub(mock.extensions, "getExtension").callsFake((id: string) =>
          id === constants.copilotChatExtensionId ? ({ id } as any) : undefined
        );
        writeFile(path.join(userDataDir, "User", "agent-plugins", "installed.json"),
          JSON.stringify([{ name: "cx-devassist", marketplace: "Checkmarx/cx-agentic-ai" }]));
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

  describe("installCxDevAssistPluginInVsCode", () => {
    const installArgs = ["plugin", "install", "cx-devassist@cx-devassist-marketplace"];
    const addArgs = ["plugin", "marketplace", "add", "https://github.com/Checkmarx/cx-agentic-ai"];

    it("shows error message when user is not authenticated", async () => {
      setIdeOnboardingAuthenticated(false);
      const error = sandbox.stub(mock.window, "showErrorMessage").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(error.calledOnce).to.equal(true);
      expect((error.firstCall.args as any[])[0]).to.include("Authentication required");
    });

    it("installs without asking about the GitHub Copilot extension", async () => {
      setIdeOnboardingAuthenticated(true);
      sandbox.stub(mock.extensions, "getExtension").returns(undefined);
      const run = sandbox.stub().resolves({ ok: true, output: "" });
      setCopilotCliDeps({ find: () => "copilot", run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(run.called).to.equal(true);
      expect(show.calledOnce).to.equal(true);
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.pluginInstalled);
    });

    it("says the plugin is already installed and runs nothing", async () => {
      setIdeOnboardingAuthenticated(true);
      stubCopilotCliListing();
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(show.calledOnce).to.equal(true);
      expect((show.firstCall.args as any[])[0]).to.include(selfHealingMessages.pluginAlreadyInstalled);
    });

    it("installs again when only a stale cache.json entry is left", async () => {
      setIdeOnboardingAuthenticated(true);
      const userDataDir = path.join(homeDir, "AppData", "Roaming", "Code");
      writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: CACHE_URI_COPILOT_CLI }]));
      const run = sandbox.stub().resolves({ ok: true, output: "" });
      setCopilotCliDeps({ find: () => "copilot", run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCxDevAssistPluginInVsCode({ globalStorageUri: { fsPath: path.join(userDataDir, "User", "globalStorage", "x") } } as any);
      expect(run.called).to.equal(true);
      expect(show.called).to.equal(true);
    });

    it("adds the marketplace and installs the plugin with the Copilot CLI", async () => {
      setIdeOnboardingAuthenticated(true);
      const run = sandbox.stub().resolves({ ok: true, output: "Installed" });
      setCopilotCliDeps({ find: () => "C:\cli\copilot.exe", run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await installCxDevAssistPluginInVsCode();
      expect(run.called).to.equal(true);
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.pluginInstalled);
      expect(execute.called).to.equal(false);
    });


    it("still installs when the marketplace is already added", async () => {
      setIdeOnboardingAuthenticated(true);
      const run = sandbox.stub().resolves({ ok: true, output: "" });
      setCopilotCliDeps({ find: () => "copilot", run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(run.called).to.equal(true);
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.pluginInstalled);
    });

    it("mentions an existing install the Copilot CLI reports", async () => {
      setIdeOnboardingAuthenticated(true);
      setCopilotCliDeps({ find: () => "copilot", run: () => Promise.resolve({ ok: false, output: "Plugin cx-devassist is already installed" }) });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(show.calledOnce).to.equal(true);
      expect((show.firstCall.args as any[])[0]).to.include("already installed");
    });

    it("opens the plugin browser when the Copilot CLI install fails", async () => {
      setIdeOnboardingAuthenticated(true);
      setCopilotCliDeps({ find: () => "copilot", run: () => Promise.resolve({ ok: false, output: "Access is denied. (os error 5)\nmore" }) });
      const warn = sandbox.stub(mock.window, "showWarningMessage").resolves(selfHealingMessages.installationGuideButton);
      const openExternal = sandbox.stub(mock.env, "openExternal").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(warn.calledOnce).to.equal(true);
      expect(openExternal.calledOnce).to.equal(true);
    });

    it("installs the Copilot CLI first, then the plugin with it", async () => {
      setIdeOnboardingAuthenticated(true);
      const run = sandbox.stub().resolves({ ok: true, output: "" });
      setCopilotCliDeps({ find: () => undefined, run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.installationGuideButton);
      const openExternal = sandbox.stub(mock.env, "openExternal").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(show.calledOnce).to.equal(true);
      expect(openExternal.calledOnce).to.equal(true);
    });

    it("opens the plugin browser when the Copilot CLI is not installed", async () => {
      setIdeOnboardingAuthenticated(true);
      setCopilotCliDeps({ find: () => undefined, run: sandbox.stub() });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.installationGuideButton);
      const openExternal = sandbox.stub(mock.env, "openExternal").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(show.calledOnce).to.equal(true);
      expect(openExternal.calledOnce).to.equal(true);
    });

    it("does not ask about the Copilot CLI when it is already found", async () => {
      setIdeOnboardingAuthenticated(true);
      const installCli = sandbox.stub().resolves(undefined);
      setCopilotCliDeps({ find: () => "copilot", run: sandbox.stub().resolves({ ok: true, output: "" }), installCli });
      sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(installCli.called).to.equal(false);
    });

    it("opens the plugin browser without the Copilot CLI", async () => {
      setIdeOnboardingAuthenticated(true);
      setCopilotCliDeps({ find: () => undefined, run: sandbox.stub() });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.installationGuideButton);
      const openExternal = sandbox.stub(mock.env, "openExternal").resolves(undefined);
      await installCxDevAssistPluginInVsCode();
      expect(show.calledOnce).to.equal(true);
      expect(openExternal.calledOnce).to.equal(true);
    });
  });

  describe("findCopilotCli", () => {
    const exeName = process.platform === "win32" ? "copilot.exe" : "copilot";

    it("finds copilot on PATH", () => {
      const bin = path.join(homeDir, "npm");
      writeFile(path.join(bin, exeName), "");
      expect(findCopilotCli([path.join(homeDir, "empty"), bin].join(path.delimiter), undefined)).to.equal(path.join(bin, exeName));
    });

    it("finds the shim VS Code ships above appRoot", () => {
      const install = path.join(homeDir, "Microsoft VS Code");
      const shim = path.join(install, "bin", "copilot-shim", exeName);
      writeFile(shim, "");
      expect(findCopilotCli("", path.join(install, "e646868227", "resources", "app"))).to.equal(shim);
    });

    it("prefers copilot.exe over copilot.cmd on Windows", () => {
      const bin = path.join(homeDir, "bin");
      writeFile(path.join(bin, "copilot.cmd"), "");
      writeFile(path.join(bin, "copilot.exe"), "");
      expect(findCopilotCli(bin, undefined, "win32")).to.equal(path.join(bin, "copilot.exe"));
    });

    it("returns undefined when there is no Copilot CLI", () => {
      expect(findCopilotCli(path.join(homeDir, "nothing"), undefined)).to.equal(undefined);
    });
  });

  describe("resolveCopilotCli", () => {
    const shim = path.join("C:", "Microsoft VS Code", "bin", "copilot-shim", "copilot.exe");
    const probeWriting = (contents: string) =>
      sandbox.stub().callsFake((_exe: string, args: string[]) => {
        writeFile(args[args.indexOf("--result-file") + 1], contents);
        return Promise.resolve({ ok: true, output: "" });
      });

    it("keeps a Copilot CLI that is not the VS Code shim without probing", async () => {
      const run = sandbox.stub();
      expect(await resolveCopilotCli("C:\\npm\\copilot.cmd", run)).to.equal("C:\\npm\\copilot.cmd");
      expect(run.called).to.equal(false);
    });

    it("uses the real Copilot CLI the shim reports", async () => {
      const run = probeWriting("[probe]\nprotocol=1\ncliFound=1\ncliPath=C:\\npm\\copilot.cmd\n");
      expect(await resolveCopilotCli(shim, run)).to.equal("C:\\npm\\copilot.cmd");
      expect(run.firstCall.args[1].slice(0, 2)).to.deep.equal(["--vscode-shim", "probe"]);
    });

    it("returns undefined when the shim reports no Copilot CLI", async () => {
      expect(await resolveCopilotCli(shim, probeWriting("[probe]\ncliFound=0\ncliPath=\n"))).to.equal(undefined);
    });

    it("keeps an older shim that has no probe", async () => {
      const run = sandbox.stub().resolves({ ok: false, output: "unknown option" });
      expect(await resolveCopilotCli(shim, run)).to.equal(shim);
    });

    it("parses only cliFound=1 with a path", () => {
      expect(parseCopilotShimProbe("cliFound=1\r\ncliPath=/usr/local/bin/copilot\r\n")).to.equal("/usr/local/bin/copilot");
      expect(parseCopilotShimProbe("cliFound=1\ncliPath=\n")).to.equal(undefined);
      expect(parseCopilotShimProbe("")).to.equal(undefined);
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
      sandbox.stub(mock.extensions, "getExtension").returns(undefined);
    });

    it("shows the Copilot message at most once per session", async () => {
      sandbox.stub(mock.workspace, "getConfiguration").callsFake(() => ({
        get: (key: string, def?: unknown) => (key === "Enable Self-Healing" ? true : def),
      }) as any);
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

    it("stores Don't show again per extension and then stays silent", async () => {
      sandbox.stub(mock.workspace, "getConfiguration").callsFake(() => ({
        get: (key: string, def?: unknown) => (key === "Enable Self-Healing" ? true : def),
      }) as any);
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
        await getRegisteredCommandCallback("cx-dev-assist.installCxDevAssistPlugin")();
        expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.vsCodeOnly);
      } finally {
        (mock.env as any).appName = origAppName;
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });
  });

  describe("registerSelfHealing", () => {
    const propsFile = () => path.join(homeDir, ".checkmarx", "cx-onboarding-ide.properties");
    const flush = () => new Promise(resolve => setImmediate(resolve));
    function makeContext(token: string | undefined): any {
      return {
        subscriptions: [],
        globalState: { get: () => undefined, update: () => Promise.resolve() },
        extension: { packageJSON: { version: "1.26.0" } },
        secrets: { get: sandbox.stub().resolves(token), onDidChange: sandbox.stub().returns({ dispose: () => undefined }) },
      };
    }

    it("writes everything OFF on activation when logged out", async () => {
      const context = makeContext(undefined);
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };
      registerSelfHealing(context, logs);
      try {
        await flush();
        const content = fs.readFileSync(propsFile(), "utf8");
        expect(content).to.contain("cx_self_healing_enabled=false");
        expect(content).to.contain("cx_asca_scanner_enabled=false");
      } finally {
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });

    it("keeps a saved Self-Healing ON after login and writes everything OFF after logout", async () => {
      const context = makeContext(undefined);
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };
      sandbox.stub(mock.workspace, "getConfiguration").callsFake(() => ({
        get: (key: string, def?: unknown) => (key === "Enable Self-Healing" ? true : def),
      }) as any);
      registerSelfHealing(context, logs);
      try {
        await flush();
        await onSelfHealingPostAuth(context, logs);
        expect(fs.readFileSync(propsFile(), "utf8")).to.contain("cx_self_healing_enabled=true");

        onSelfHealingLogout(logs);
        const content = fs.readFileSync(propsFile(), "utf8");
        expect(content).to.contain("cx_self_healing_enabled=false");
        for (const key of ["asca", "sca", "secret", "kics", "containers"]) {
          expect(content).to.contain(`cx_${key}_scanner_enabled=false`);
        }
      } finally {
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });

    it("keeps a fresh user OFF after a successful login", async () => {
      const update = sandbox.stub().resolves();
      sandbox.stub(mock.workspace, "getConfiguration").callsFake(() => ({
        get: (_key: string, def?: unknown) => def,
        update,
      }) as any);
      sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
      const context = makeContext("token");
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };
      registerSelfHealing(context, logs);
      try {
        await flush();
        await onSelfHealingPostAuth(context, logs);
        expect(update.called).to.equal(false);
        expect(fs.readFileSync(propsFile(), "utf8")).to.contain("cx_self_healing_enabled=false");
      } finally {
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });

    describe("installed confirmation", () => {
      const installPlugin = () => stubCopilotCliListing();
      const logs = () => ({ info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() }) as any;

      it("confirms once when the plugin goes from not detected to detected while logged in", async () => {
        sandbox.stub(mock.extensions, "getExtension").callsFake((id: string) =>
          id === constants.copilotChatExtensionId ? ({ id } as any) : undefined
        );
        const context = makeContext("token");
        registerSelfHealing(context, logs());
        try {
          await flush();
          const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
          await onPluginDetectionChanged(context);
          expect(show.called).to.equal(false);

          installPlugin();
          await onPluginDetectionChanged(context);
          expect(show.calledOnce).to.equal(true);
          expect((show.firstCall.args as any[])[0]).to.include(selfHealingMessages.pluginInstalledDetected);
        } finally {
          context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
        }
      });

      it("stays quiet when the plugin was already installed at startup or the user is logged out", async () => {
        const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
        installPlugin();
        await onPluginDetectionChanged({} as any);
        setPluginDetectedForTests(false);
        await onPluginDetectionChanged({} as any);
        expect(show.called).to.equal(false);
      });

      it("offers to turn Self-Healing on when it is off", async () => {
        const update = sandbox.stub().resolves();
        sandbox.stub(mock.workspace, "getConfiguration").returns({ get: () => false, update } as any);
        const context = makeContext("token");
        registerSelfHealing(context, logs());
        try {
          await flush();
          const show = sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.enableSelfHealingButton as any);
          installPlugin();
          await onPluginDetectionChanged(context);
          expect(show.firstCall.args as any[]).to.deep.equal([
            `${selfHealingMessages.pluginInstalledDetected} ${selfHealingMessages.selfHealingOff}`,
            selfHealingMessages.enableSelfHealingButton,
          ]);
          expect(update.calledWith("Enable Self-Healing", true, mock.ConfigurationTarget.Global)).to.equal(true);
        } finally {
          context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
        }
      });

      it("only says the plugin is already installed from the install command, without buttons", async () => {
        sandbox.stub(mock.extensions, "getExtension").callsFake((id: string) =>
          id === constants.copilotChatExtensionId ? ({ id } as any) : undefined
        );
        const context = makeContext("token");
        registerSelfHealing(context, logs());
        try {
          await flush();
          installPlugin();
          const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
          await getRegisteredCommandCallback("cx-dev-assist.installCxDevAssistPlugin")();
          expect(show.calledOnce).to.equal(true);
          expect((show.firstCall.args as any[])[0]).to.include(selfHealingMessages.pluginAlreadyInstalled);
        } finally {
          context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
        }
      });
    });

    it("registers the install command, writes the properties file and installs without asking", async () => {
      const context = makeContext("token");
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };

      registerSelfHealing(context, logs);
      try {
        await flush();
        const content = fs.readFileSync(propsFile(), "utf8");
        expect(content).to.contain("cx_self_healing_enabled=false");

        const callback = getRegisteredCommandCallback("cx-dev-assist.installCxDevAssistPlugin");
        expect(callback).to.be.a("function");
        // No CLI found, so it shows notification with documentation link
        const show = sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.installationGuideButton as any);
        const openExternal = sandbox.stub(mock.env, "openExternal").resolves(undefined);
        await callback();
        expect(show.calledOnce).to.equal(true);
        expect(openExternal.calledOnce).to.equal(true);
      } finally {
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });
  });
});
