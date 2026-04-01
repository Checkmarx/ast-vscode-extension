import { expect } from "chai";
import "./mocks/vscode-mock";
import { KICSRealtimeCommand } from "../commands/kicsRealtimeCommand";
import { commands } from "../utils/common/commandBuilder";
import { cx } from "../cx";
import { getRegisteredCommandCallback, clearCommandsExecuted } from "./mocks/vscode-mock";
import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { KicsProvider } from "../kics/kicsRealtimeProvider";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

class StubProvider extends KicsProvider {
  runKicsIfEnabledCalled = false;
  kicsRemediationCalled = false;
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    super(
      context,
      logs,
      { text: "", tooltip: "", command: undefined, show: () => { }, hide: () => { }, dispose: () => { } } as vscode.StatusBarItem,
      { set: () => { }, delete: () => { }, clear: () => { } } as unknown as vscode.DiagnosticCollection,
      [],
      []
    );
  }
  async runKicsIfEnabled() { this.runKicsIfEnabledCalled = true; }
  async kicsRemediation(): Promise<void> { this.kicsRemediationCalled = true; }
}

const logs: Logs = {
  info: () => { },
  error: () => { },
  warn: () => { },
  show: () => { },
  output: { append: () => { }, appendLine: () => { }, clear: () => { }, show: () => { }, hide: () => { }, dispose: () => { }, replace: () => { }, name: "Test" },
  log: () => { }
} as Logs;

describe("KICSRealtimeCommand standalone gating", () => {
  let prevStandalone: typeof cx.isStandaloneEnabled;
  before(() => {
    prevStandalone = cx.isStandaloneEnabled;

    // Set up extension configuration before tests run
    setExtensionConfig({
      extensionId: 'ast-results',
      commandPrefix: 'ast-results',
      viewContainerPrefix: 'ast',
      displayName: 'Checkmarx',
      extensionType: 'checkmarx',
    });
  });
  after(() => {
    cx.isStandaloneEnabled = prevStandalone;
    resetExtensionConfig();
  });
  beforeEach(() => { clearCommandsExecuted(); });

  it("skip kics realtime scan when standalone enabled", async () => {
    cx.isStandaloneEnabled = async () => true;
    type MockContext = { subscriptions: unknown[]; secrets: { get: (key: string) => Promise<string | undefined> }; globalState: { get: (key: string) => unknown; update: (key: string, value: unknown) => Promise<void> } };
    const context: MockContext = { subscriptions: [], secrets: { get: async () => "token" }, globalState: { get: () => undefined, update: async () => { } } };
    const provider = new StubProvider(context as unknown as vscode.ExtensionContext, logs);
    const cmd = new KICSRealtimeCommand(context as unknown as vscode.ExtensionContext, provider, logs);
    cmd.registerKicsScans();
    const cb = getRegisteredCommandCallback(commands.kicsRealtime);
    expect(cb).to.be.a("function");
    await cb();
    expect(provider.runKicsIfEnabledCalled).to.equal(false);
  });

  it("run kics realtime scan when standalone disabled", async () => {
    cx.isStandaloneEnabled = async () => false;
    type MockContext = { subscriptions: unknown[]; secrets: { get: (key: string) => Promise<string | undefined> }; globalState: { get: (key: string) => unknown; update: (key: string, value: unknown) => Promise<void> } };
    const context: MockContext = { subscriptions: [], secrets: { get: async () => "token" }, globalState: { get: () => undefined, update: async () => { } } };
    const provider = new StubProvider(context as unknown as vscode.ExtensionContext, logs);
    const cmd = new KICSRealtimeCommand(context as unknown as vscode.ExtensionContext, provider, logs);
    cmd.registerKicsScans();
    const cb = getRegisteredCommandCallback(commands.kicsRealtime);
    await cb();
    expect(provider.runKicsIfEnabledCalled).to.equal(true);
  });

  it("skip kicsremediation when standalone enabled", async () => {
    cx.isStandaloneEnabled = async () => true;
    type MockContext = { subscriptions: unknown[]; secrets: { get: (key: string) => Promise<string | undefined> }; globalState: { get: (key: string) => unknown; update: (key: string, value: unknown) => Promise<void> } };
    const context: MockContext = { subscriptions: [], secrets: { get: async () => "token" }, globalState: { get: () => undefined, update: async () => { } } };
    const provider = new StubProvider(context as unknown as vscode.ExtensionContext, logs);
    const cmd = new KICSRealtimeCommand(context as unknown as vscode.ExtensionContext, provider, logs);
    cmd.registerKicsRemediation();
    const cb = getRegisteredCommandCallback(commands.kicsRemediation);
    await cb([], [], { file: "dummy" }, {}, false, false);
    expect(provider.kicsRemediationCalled).to.equal(false);
  });

  it("run kics remediation when standalone disabled", async () => {
    cx.isStandaloneEnabled = async () => false;
    type MockContext = { subscriptions: unknown[]; secrets: { get: (key: string) => Promise<string | undefined> }; globalState: { get: (key: string) => unknown; update: (key: string, value: unknown) => Promise<void> } };
    const context: MockContext = { subscriptions: [], secrets: { get: async () => "token" }, globalState: { get: () => undefined, update: async () => { } } };
    const provider = new StubProvider(context as unknown as vscode.ExtensionContext, logs);
    const cmd = new KICSRealtimeCommand(context as unknown as vscode.ExtensionContext, provider, logs);
    cmd.registerKicsRemediation();
    const cb = getRegisteredCommandCallback(commands.kicsRemediation);
    await cb([], [], { file: "dummy" }, {}, false, false);
    expect(provider.kicsRemediationCalled).to.equal(true);
  });
});
