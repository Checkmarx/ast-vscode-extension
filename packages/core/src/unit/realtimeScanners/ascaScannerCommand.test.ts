/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { AscaScannerCommand } from "../../realtimeScanners/scanners/asca/ascaScannerCommand";
import { AscaScannerService } from "../../realtimeScanners/scanners/asca/ascaScannerService";
import { ConfigurationManager } from "../../realtimeScanners/configuration/configurationManager";
import { cx } from "../../cx";
import {
  setExtensionConfig,
  resetExtensionConfig,
} from "../../config/extensionConfig";

describe("AscaScannerCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let context: any;
  let logs: any;
  let configManager: ConfigurationManager;
  let cmd: AscaScannerCommand;
  let provideHover: any;

  const makeDoc = (fsPath: string) =>
    ({ uri: { fsPath, scheme: "file", toString: () => fsPath } } as any);

  const seedDiagnostic = (svc: any, fsPath: string, line: number) => {
    const range = new (vscode as any).Range(
      { line, character: 0 },
      { line, character: 20 }
    );
    svc.getDiagnosticsMap().set(fsPath, [{ range } as any]);
  };

  const register = async () => {
    sandbox.stub(configManager, "isScannerActive").returns(true);
    // Mock cx.installAsca to prevent actual installation
    sandbox.stub(cx, "installAsca").resolves({ error: null } as any);
    sandbox
      .stub(vscode.languages, "registerHoverProvider")
      .callsFake((_sel: any, prov: any) => {
        provideHover = prov.provideHover;
        return { dispose: () => {} } as any;
      });
    await cmd.register();
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
    context = { subscriptions: [] };
    logs = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
    };
    configManager = new ConfigurationManager();
    cmd = new AscaScannerCommand(context, logs, configManager);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  it("should construct and expose its scanner service", () => {
    expect(cmd.getScannerService()).to.be.instanceOf(AscaScannerService);
  });

  it("register (inactive) should not throw", async () => {
    sandbox.stub(configManager, "isScannerActive").returns(false);
    await cmd.register();
    expect(logs.info.called).to.be.true;
  });

  it("register (active) should register a hover provider", async () => {
    await register();
    expect(provideHover).to.be.a("function");
  });

  it("getHover returns undefined without data", async () => {
    await register();
    expect(provideHover(makeDoc("/p/main.py"), { line: 0, character: 0 })).to.be
      .undefined;
  });

  it("getHover returns a Hover with severity icon and details for a SAST finding", async () => {
    await register();
    const svc = cmd.getScannerService();
    const fsPath = "/p/main.py";
    svc.getHoverData().set(`${fsPath}:5`, [
      {
        ruleName: "SQL Injection",
        description: "User input used in SQL query",
        severity: "High",
        filePath: fsPath,
        lineNumber: 5,
      } as any,
    ]);
    seedDiagnostic(svc, fsPath, 5);

    const hover = provideHover(makeDoc(fsPath), { line: 5, character: 5 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("SQL Injection");
  });

  it("getHover handles multiple findings with different severities", async () => {
    await register();
    const svc = cmd.getScannerService();
    const fsPath = "/p/app.java";
    svc.getHoverData().set(`${fsPath}:10`, [
      {
        ruleName: "Hardcoded Password",
        description: "Password is hardcoded",
        severity: "Critical",
        filePath: fsPath,
        lineNumber: 10,
      } as any,
      {
        ruleName: "Weak Encryption",
        description: "Weak encryption algorithm used",
        severity: "Medium",
        filePath: fsPath,
        lineNumber: 10,
      } as any,
    ]);
    seedDiagnostic(svc, fsPath, 10);

    const hover = provideHover(makeDoc(fsPath), { line: 10, character: 5 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("Hardcoded Password");
    expect(hover.contents.value).to.include("Weak Encryption");
  });

  it("dispose should not throw", async () => {
    await register();
    await cmd.dispose();
  });

  it("dispose should not throw when never registered", async () => {
    await cmd.dispose();
  });
});
