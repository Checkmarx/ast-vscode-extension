/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import sinon from "sinon";
import { mock } from "./mocks/vscode-mock";
import "./mocks/vscode-mock";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";
import { resolveMcpTargets } from "../utils/aiAssistantUtil";
import { constants } from "../utils/common/constants";

describe("resolveMcpTargets", () => {
    let sandbox: sinon.SinonSandbox;

    function setAppName(name: string) {
        (mock as any).env = { appName: name };
    }

    function setExtensions(copilot: boolean, claude: boolean) {
        (mock as any).extensions = {
            getExtension: (id: string) => {
                if (id === constants.copilotChatExtensionId) { return copilot ? {} : undefined; }
                if (id === constants.claudeChatExtensionId) { return claude ? {} : undefined; }
                return undefined;
            }
        };
    }

    function setPreferNative(value: boolean) {
        sandbox.stub(mock.workspace, "getConfiguration").returns({
            get: (key: string, def: any) => {
                if (key === "Prefer Native AI Assistant") { return value; }
                return def;
            }
        } as any);
    }

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        setExtensionConfig({
            extensionId: "ast-results",
            commandPrefix: "ast-results",
            viewContainerPrefix: "ast",
            displayName: "Checkmarx",
            extensionType: "checkmarx",
        });
        setAppName("Visual Studio Code");
        setExtensions(false, false);
    });

    afterEach(() => {
        sandbox.restore();
        resetExtensionConfig();
        (mock as any).env = { appName: "Visual Studio Code", openExternal: () => Promise.resolve(true), clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve("") } };
        (mock as any).extensions = { getExtension: () => undefined, all: [], onDidChange: () => ({ dispose: () => { } }) };
    });

    // ── Claude IDE ──────────────────────────────────────────────────────────────

    describe("Claude IDE", () => {
        it("returns ['claude-settings'] regardless of installed extensions", () => {
            setAppName("Claude");
            expect(resolveMcpTargets()).to.deep.equal(["claude-settings"]);
        });
    });

    // ── VS Code ─────────────────────────────────────────────────────────────────

    describe("VS Code", () => {
        it("returns [] when no AI extension is installed", () => {
            expect(resolveMcpTargets()).to.deep.equal([]);
        });

        it("returns ['vscode-settings'] when only Copilot is installed", () => {
            setExtensions(true, false);
            expect(resolveMcpTargets()).to.deep.equal(["vscode-settings"]);
        });

        it("returns ['claude-settings'] when only Claude Code is installed", () => {
            setExtensions(false, true);
            expect(resolveMcpTargets()).to.deep.equal(["claude-settings"]);
        });

        it("returns both targets when Copilot and Claude Code are installed", () => {
            setExtensions(true, true);
            expect(resolveMcpTargets()).to.deep.equal(["vscode-settings", "claude-settings"]);
        });
    });

    // ── Cursor ───────────────────────────────────────────────────────────────────

    describe("Cursor IDE", () => {
        beforeEach(() => setAppName("Cursor"));

        describe("Prefer Native = true", () => {
            it("returns ['ide-native-json'] with no extensions installed", () => {
                setPreferNative(true);
                expect(resolveMcpTargets()).to.deep.equal(["ide-native-json"]);
            });

            it("returns ['ide-native-json'] when only Copilot is installed", () => {
                setPreferNative(true);
                setExtensions(true, false);
                expect(resolveMcpTargets()).to.deep.equal(["ide-native-json"]);
            });

            it("returns ['ide-native-json', 'claude-settings'] when Claude Code is installed", () => {
                setPreferNative(true);
                setExtensions(false, true);
                expect(resolveMcpTargets()).to.deep.equal(["ide-native-json", "claude-settings"]);
            });

            it("returns both targets when Copilot and Claude Code are installed", () => {
                setPreferNative(true);
                setExtensions(true, true);
                expect(resolveMcpTargets()).to.deep.equal(["ide-native-json", "claude-settings"]);
            });
        });

        describe("Prefer Native = false", () => {
            it("returns [] when no extensions are installed", () => {
                setPreferNative(false);
                expect(resolveMcpTargets()).to.deep.equal([]);
            });

            it("returns ['ide-native-json'] when only Copilot is installed", () => {
                setPreferNative(false);
                setExtensions(true, false);
                expect(resolveMcpTargets()).to.deep.equal(["ide-native-json"]);
            });

            it("returns ['claude-settings'] when only Claude Code is installed", () => {
                setPreferNative(false);
                setExtensions(false, true);
                expect(resolveMcpTargets()).to.deep.equal(["claude-settings"]);
            });

            it("returns both targets when Copilot and Claude Code are installed", () => {
                setPreferNative(false);
                setExtensions(true, true);
                expect(resolveMcpTargets()).to.deep.equal(["ide-native-json", "claude-settings"]);
            });
        });
    });

    // ── Windsurf ──────────────────────────────────────────────────────────────────

    describe("Windsurf IDE", () => {
        beforeEach(() => setAppName("Windsurf"));

        it("Prefer Native = true, no extensions → ['ide-native-json']", () => {
            setPreferNative(true);
            expect(resolveMcpTargets()).to.deep.equal(["ide-native-json"]);
        });

        it("Prefer Native = false, Claude Code installed → ['claude-settings']", () => {
            setPreferNative(false);
            setExtensions(false, true);
            expect(resolveMcpTargets()).to.deep.equal(["claude-settings"]);
        });
    });

    // ── Kiro ──────────────────────────────────────────────────────────────────────

    describe("Kiro IDE", () => {
        beforeEach(() => setAppName("Kiro"));

        it("Prefer Native = true, no extensions → ['ide-native-json']", () => {
            setPreferNative(true);
            expect(resolveMcpTargets()).to.deep.equal(["ide-native-json"]);
        });

        it("Prefer Native = false, no extensions → []", () => {
            setPreferNative(false);
            expect(resolveMcpTargets()).to.deep.equal([]);
        });
    });
});
