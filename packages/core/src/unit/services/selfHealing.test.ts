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
  getCopilotCliPluginDir,
  getCxDevAssistInstallLocations,
  installCopilotPluginInVsCode,
  isCxDevAssistPluginAvailable,
  isCxDevAssistPluginInstalled,
  isCxDevAssistPluginInstalledInVsCode,
  isSelfHealingSupportedHost,
  onPluginDetectionChanged,
  onSelfHealingLogout,
  onSelfHealingPostAuth,
  mergePluginMarketplaces,
  openVsCodePluginBrowser,
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
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: marketplaceRunCopy(), nonce: "1" }]));
        expect(isCxDevAssistPluginInstalledInVsCode({ homeDir, userDataDir })).to.equal(true);
      });

      it("detects the cx-devassist-marketplace/cx-devassist path as the Copilot CLI install", () => {
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: cliRunCopy(), nonce: "1" }]));
        expect(getCxDevAssistInstallLocations({ homeDir, userDataDir })).to.deep.equal([
          { source: "copilotCli", path: path.join(homeDir, ".copilot", "installed-plugins", "cx-devassist-marketplace", "cx-devassist") },
        ]);
      });

      it("ignores an entry whose folder no longer exists (plugin removed)", () => {
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([
          { uri: cliRunCopy(true), nonce: "1" },
          { uri: CACHE_URI_MARKETPLACE_REPO, nonce: "2" },
        ]));
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(false);
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
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: marketplaceRunCopy() }]));
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(true);
      });

      it("returns false when neither is installed", () => {
        expect(isCxDevAssistPluginAvailable({ homeDir, userDataDir })).to.equal(false);
      });

      it("reports each install location once, Copilot CLI first", () => {
        writeCopilotConfig(homeDir, JSON.stringify({ installedPlugins: [PLUGIN_ENTRY] }));
        const profileFile = path.join(userDataDir, "User", "agent-plugins", "installed.json");
        writeFile(profileFile, JSON.stringify([{ name: "cx-devassist", marketplace: "Checkmarx/cx-agentic-ai" }]));
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: cliRunCopy() }, { uri: cliRunCopy() }]));
        expect(getCxDevAssistInstallLocations({ homeDir, userDataDir })).to.deep.equal([
          { source: "copilotCli", path: PLUGIN_ENTRY.cache_path },
          { source: "vscode", path: profileFile },
        ]);
      });

      it("suppresses the plugin message when VS Code installed the plugin", async () => {
        sandbox.stub(mock.extensions, "getExtension").callsFake((id: string) =>
          id === constants.copilotChatExtensionId ? ({ id } as any) : undefined
        );
        writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: marketplaceRunCopy() }]));
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
        value: ["github/awesome-copilot#marketplace", "Checkmarx/cx-agentic-ai#master"],
        changed: true,
      });
    });

    it("uses the VS Code default when no default can be inspected", () => {
      expect(mergePluginMarketplaces(undefined, undefined).value).to.deep.equal([
        "github/awesome-copilot#marketplace",
        "Checkmarx/cx-agentic-ai#master",
      ]);
    });

    it("leaves the value unchanged when the marketplace is already present", () => {
      for (const existing of ["Checkmarx/cx-agentic-ai#master", "checkmarx/cx-agentic-ai#master", "https://github.com/Checkmarx/cx-agentic-ai.git"]) {
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
        "Checkmarx/cx-agentic-ai#master",
      ]);
    });

    it("replaces a Checkmarx entry VS Code would read from the missing main branch", () => {
      for (const stale of ["Checkmarx/cx-agentic-ai", "checkmarx/cx-agentic-ai#main"]) {
        expect(mergePluginMarketplaces(["github/awesome-copilot#marketplace", stale, "acme/plugins"], [])).to.deep.equal({
          value: ["github/awesome-copilot#marketplace", "acme/plugins", "Checkmarx/cx-agentic-ai#master"],
          changed: true,
        });
      }
    });
  });

  describe("installCopilotPluginInVsCode", () => {
    const installArgs = ["plugin", "install", "cx-devassist@cx-devassist-marketplace"];
    const addArgs = ["plugin", "marketplace", "add", "https://github.com/Checkmarx/cx-agentic-ai"];
    let copilotInstalled: boolean;

    beforeEach(() => {
      copilotInstalled = true;
      sandbox.stub(mock.extensions, "getExtension").callsFake((id: string) =>
        id === constants.copilotChatExtensionId && copilotInstalled ? ({ id } as any) : undefined
      );
    });

    it("offers to install GitHub Copilot first and runs nothing", async () => {
      copilotInstalled = false;
      const run = sandbox.stub().resolves({ ok: true, output: "" });
      setCopilotCliDeps({ find: () => "copilot", run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(selfHealingMessages.installCopilotButton as any);
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await installCopilotPluginInVsCode();
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.installCopilot);
      expect(execute.firstCall.args).to.deep.equal(["extension.open", constants.copilotChatExtensionId]);
      expect(run.called).to.equal(false);
    });

    it("says the plugin is already installed and runs nothing", async () => {
      writeCopilotConfig(homeDir, JSON.stringify({ installedPlugins: [PLUGIN_ENTRY] }));
      const run = sandbox.stub().resolves({ ok: true, output: "" });
      setCopilotCliDeps({ find: () => "copilot", run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCopilotPluginInVsCode();
      expect(run.called).to.equal(false);
      expect(show.firstCall.args as any[]).to.deep.equal([
        `${selfHealingMessages.pluginAlreadyInstalled}: Copilot CLI (${PLUGIN_ENTRY.cache_path}). ${selfHealingMessages.selfHealingActive}`,
      ]);
    });

    it("installs again when only a stale cache.json entry is left", async () => {
      const userDataDir = path.join(homeDir, "AppData", "Roaming", "Code");
      writeFile(getVsCodeAgentPluginsCachePath(userDataDir), JSON.stringify([{ uri: CACHE_URI_COPILOT_CLI }]));
      const run = sandbox.stub().resolves({ ok: true, output: "" });
      setCopilotCliDeps({ find: () => "copilot", run });
      sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCopilotPluginInVsCode({ globalStorageUri: { fsPath: path.join(userDataDir, "User", "globalStorage", "x") } } as any);
      expect(run.calledTwice).to.equal(true);
    });

    it("adds the marketplace and installs the plugin with the Copilot CLI", async () => {
      const run = sandbox.stub().resolves({ ok: true, output: "Installed" });
      setCopilotCliDeps({ find: () => "C:\cli\copilot.exe", run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await installCopilotPluginInVsCode();
      expect(run.args).to.deep.equal([
        ["C:\cli\copilot.exe", addArgs],
        ["C:\cli\copilot.exe", installArgs],
      ]);
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.pluginInstalled);
      expect(execute.called).to.equal(false);
    });

    it("still installs when the marketplace is already added", async () => {
      const run = sandbox.stub();
      run.onFirstCall().resolves({ ok: false, output: "Marketplace already exists" });
      run.onSecondCall().resolves({ ok: true, output: "" });
      setCopilotCliDeps({ find: () => "copilot", run });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCopilotPluginInVsCode();
      expect(run.secondCall.args[1]).to.deep.equal(installArgs);
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.pluginInstalled);
    });

    it("mentions an existing install the Copilot CLI reports", async () => {
      setCopilotCliDeps({ find: () => "copilot", run: () => Promise.resolve({ ok: false, output: "Plugin cx-devassist is already installed" }) });
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await installCopilotPluginInVsCode();
      expect((show.firstCall.args as any[])[0]).to.equal(
        `${alreadyInstalledMessage([{ source: "copilotCli", path: getCopilotCliPluginDir(homeDir) }])} ${selfHealingMessages.selfHealingActive}`
      );
    });

    it("shows the failure and can open the plugin browser", async () => {
      setCopilotCliDeps({ find: () => "copilot", run: () => Promise.resolve({ ok: false, output: "Access is denied. (os error 5)\nmore" }) });
      const error = sandbox.stub(mock.window, "showErrorMessage").resolves(selfHealingMessages.openPluginBrowserButton as any);
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({ globalValue: ["Checkmarx/cx-agentic-ai"] }, sandbox.stub().resolves()));
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await installCopilotPluginInVsCode();
      expect((error.firstCall.args as any[])[0]).to.equal(`${selfHealingMessages.pluginInstallFailed} Access is denied. (os error 5)`);
      expect(execute.firstCall.args[0]).to.equal("workbench.extensions.search");
    });

    it("falls back to the plugin browser without the Copilot CLI", async () => {
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({ globalValue: ["Checkmarx/cx-agentic-ai"] }, sandbox.stub().resolves()));
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await installCopilotPluginInVsCode();
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.copilotCliNotFound);
      expect(execute.firstCall.args[0]).to.equal("workbench.extensions.search");
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

  describe("openVsCodePluginBrowser", () => {
    it("adds the marketplace to the user settings and opens the plugin browser", async () => {
      const update = sandbox.stub().resolves();
      const getConfiguration = sandbox.stub(mock.workspace, "getConfiguration").returns(
        fakeConfig({ defaultValue: ["github/awesome-copilot#marketplace"] }, update)
      );
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await openVsCodePluginBrowser();
      expect(getConfiguration.firstCall.args[0]).to.equal("chat.plugins");
      expect(update.firstCall.args).to.deep.equal([
        "marketplaces",
        ["github/awesome-copilot#marketplace", "Checkmarx/cx-agentic-ai#master"],
        mock.ConfigurationTarget.Global,
      ]);
      expect(execute.firstCall.args).to.deep.equal(["workbench.extensions.search", "@agentPlugins cx-devassist"]);
    });

    it("falls back to the plugin browser when the search command fails", async () => {
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({}, sandbox.stub().resolves()));
      const execute = sandbox.stub(mock.commands, "executeCommand");
      execute.onFirstCall().rejects(new Error("command 'workbench.extensions.search' not found"));
      execute.onSecondCall().resolves();
      await openVsCodePluginBrowser();
      expect(execute.secondCall.args[0]).to.equal("workbench.agentPlugins.browse");
    });

    it("explains that agent plugins are off instead of opening the browser when chat.plugins.enabled is false", async () => {
      const update = sandbox.stub().resolves();
      sandbox.stub(mock.workspace, "getConfiguration").returns({
        get: (key: string, def?: unknown) => (key === "enabled" ? false : def),
        inspect: () => undefined,
        update,
      } as any);
      const warn = sandbox.stub(mock.window, "showWarningMessage").resolves(selfHealingMessages.openSettingButton as any);
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await openVsCodePluginBrowser();
      expect((warn.firstCall.args as any[])[0]).to.equal(selfHealingMessages.pluginsDisabled);
      expect(update.called).to.equal(false);
      expect(execute.firstCall.args).to.deep.equal(["workbench.action.openSettings", "chat.plugins.enabled"]);
    });

    it("does not rewrite the setting when the marketplace is already there", async () => {
      const update = sandbox.stub().resolves();
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({ globalValue: ["Checkmarx/cx-agentic-ai#master"] }, update));
      sandbox.stub(mock.commands, "executeCommand").resolves();
      await openVsCodePluginBrowser();
      expect(update.called).to.equal(false);
    });

    it("explains where to find the plugin browser when the command is missing", async () => {
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({}, sandbox.stub().resolves()));
      sandbox.stub(mock.commands, "executeCommand").rejects(new Error("command 'workbench.agentPlugins.browse' not found"));
      const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined);
      await openVsCodePluginBrowser();
      expect((show.firstCall.args as any[])[0]).to.equal(selfHealingMessages.browsePluginsFallback);
    });

    it("still opens the plugin browser when the setting cannot be updated", async () => {
      sandbox.stub(mock.workspace, "getConfiguration").returns(fakeConfig({}, sandbox.stub().rejects(new Error("not registered"))));
      const warn = sandbox.stub(mock.window, "showWarningMessage").resolves(undefined);
      const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
      await openVsCodePluginBrowser();
      expect(warn.calledOnce).to.equal(true);
      expect(execute.firstCall.args[0]).to.equal("workbench.extensions.search");
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

    it("writes Self-Healing ON after login and OFF with every scanner after logout", async () => {
      const context = makeContext(undefined);
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };
      sandbox.stub(mock.workspace, "getConfiguration").callsFake(() => ({ get: (_k: string, def?: unknown) => def }) as any);
      registerSelfHealing(context, logs);
      try {
        await flush();
        await onSelfHealingPostAuth(context, logs);
        expect(fs.readFileSync(propsFile(), "utf8")).to.contain("cx_self_healing_enabled=true");

        onSelfHealingLogout(context, logs);
        const content = fs.readFileSync(propsFile(), "utf8");
        expect(content).to.contain("cx_self_healing_enabled=false");
        for (const key of ["asca", "sca", "secret", "kics", "containers"]) {
          expect(content).to.contain(`cx_${key}_scanner_enabled=false`);
        }
      } finally {
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });

    it("turns Self-Healing back on after a successful login", async () => {
      let selfHealing = false;
      const update = sandbox.stub().callsFake((_key: string, value: boolean) => {
        selfHealing = value;
        return Promise.resolve();
      });
      sandbox.stub(mock.workspace, "getConfiguration").callsFake((section: string) => ({
        get: (key: string, def?: unknown) =>
          section === "Checkmarx Developer Assist Self-Healing" && key === "Enable Self-Healing" ? selfHealing : def,
        update,
      }) as any);
      sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
      const context = makeContext("token");
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };
      registerSelfHealing(context, logs);
      try {
        await flush();
        expect(update.called).to.equal(false);
        expect(fs.readFileSync(propsFile(), "utf8")).to.contain("cx_self_healing_enabled=false");

        await onSelfHealingPostAuth(context, logs);
        expect(update.calledOnceWith("Enable Self-Healing", true, mock.ConfigurationTarget.Global)).to.equal(true);
        expect(fs.readFileSync(propsFile(), "utf8")).to.contain("cx_self_healing_enabled=true");
      } finally {
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });

    describe("installed confirmation", () => {
      const installPlugin = () => writeCopilotConfig(homeDir, JSON.stringify({ installedPlugins: [PLUGIN_ENTRY] }));
      const logs = () => ({ info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() }) as any;

      it("confirms once when the plugin goes from not detected to detected while logged in", async () => {
        const context = makeContext("token");
        registerSelfHealing(context, logs());
        try {
          await flush();
          const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
          await onPluginDetectionChanged(context);
          expect(show.called).to.equal(false);

          installPlugin();
          await onPluginDetectionChanged(context);
          expect(show.firstCall.args as any[]).to.deep.equal([
            `${selfHealingMessages.pluginInstalledDetected} ${selfHealingMessages.selfHealingActive}`,
          ]);

          await onPluginDetectionChanged(context);
          expect(show.calledOnce).to.equal(true);
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
        const context = makeContext("token");
        registerSelfHealing(context, logs());
        try {
          await flush();
          installPlugin();
          const show = sandbox.stub(mock.window, "showInformationMessage").resolves(undefined as any);
          await getRegisteredCommandCallback("cx-dev-assist.installCopilotPlugin")();
          expect(show.calledOnce).to.equal(true);
          expect(show.firstCall.args as any[]).to.deep.equal([
            `${selfHealingMessages.pluginAlreadyInstalled}: Copilot CLI (${PLUGIN_ENTRY.cache_path}). ${selfHealingMessages.selfHealingActive}`,
          ]);
        } finally {
          context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
        }
      });
    });

    it("registers the install command, writes the properties file and copies the commands", async () => {
      const context = makeContext("token");
      const logs: any = { info: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };

      registerSelfHealing(context, logs);
      try {
        await flush();
        const content = fs.readFileSync(propsFile(), "utf8");
        expect(content).to.contain("cx_self_healing_enabled=true");
        expect(content).to.contain("cx_ide_extension=cx-dev-assist");
        expect(content).to.contain("cx_ide_extension_version=1.26.0");

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

        // GitHub Copilot is installed; there is no Copilot CLI, so it falls back to the plugin browser
        sandbox.stub(mock.extensions, "getExtension").callsFake((id: string) =>
          id === constants.copilotChatExtensionId ? ({ id } as any) : undefined
        );
        show.resolves(selfHealingMessages.installInVsCodeButton as any);
        const update = sandbox.stub().resolves();
        sandbox.stub(mock.workspace, "getConfiguration").returns(
          fakeConfig({ defaultValue: ["github/awesome-copilot#marketplace"] }, update)
        );
        const execute = sandbox.stub(mock.commands, "executeCommand").resolves();
        await callback();
        expect(update.calledOnce).to.equal(true);
        expect(execute.firstCall.args[0]).to.equal("workbench.extensions.search");
      } finally {
        context.subscriptions.forEach((d: { dispose: () => void }) => d.dispose());
      }
    });
  });
});
