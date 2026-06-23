/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { SecretsScannerCommand } from "../../realtimeScanners/scanners/secrets/secretsScannerCommand";
import { SecretsScannerService } from "../../realtimeScanners/scanners/secrets/secretsScannerService";
import { ConfigurationManager } from "../../realtimeScanners/configuration/configurationManager";
import {
  setExtensionConfig,
  resetExtensionConfig,
} from "../../config/extensionConfig";

describe("SecretsScannerCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let context: any;
  let logs: any;
  let configManager: ConfigurationManager;
  let cmd: SecretsScannerCommand;
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
    cmd = new SecretsScannerCommand(context, logs, configManager);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  it("should construct and expose its scanner service", () => {
    expect(cmd.getScannerService()).to.be.instanceOf(SecretsScannerService);
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
    expect(provideHover(makeDoc("/p/.env"), { line: 0, character: 0 })).to.be
      .undefined;
  });

  it("getHover returns a Hover with severity icon and details for a secret finding", async () => {
    await register();
    const svc = cmd.getScannerService();
    const fsPath = "/p/.env";
    svc.getHoverData().set(`${fsPath}:2`, {
      title: "AWS Access Key",
      secretValue: "AKIA2EXAMPLE",
      severity: "High",
      filePath: fsPath,
      lineNumber: 2,
      startIndex: 0,
      endIndex: 15,
    } as any);
    seedDiagnostic(svc, fsPath, 2);

    const hover = provideHover(makeDoc(fsPath), { line: 2, character: 5 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("AWS Access Key");
  });

  it("getHover handles different severity levels", async () => {
    await register();
    const svc = cmd.getScannerService();
    const fsPath = "/p/config.json";
    svc.getHoverData().set(`${fsPath}:7`, {
      title: "Private Key",
      secretValue: "-----BEGIN PRIVATE KEY-----",
      severity: "Critical",
      filePath: fsPath,
      lineNumber: 7,
      startIndex: 0,
      endIndex: 20,
    } as any);
    seedDiagnostic(svc, fsPath, 7);

    const hover = provideHover(makeDoc(fsPath), { line: 7, character: 5 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("Private Key");
  });

  it("dispose should not throw", async () => {
    await register();
    await cmd.dispose();
  });

  it("dispose should not throw when never registered", async () => {
    await cmd.dispose();
  });
});
