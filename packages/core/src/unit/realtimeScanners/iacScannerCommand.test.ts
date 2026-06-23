/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { IacScannerCommand } from "../../realtimeScanners/scanners/iac/iacScannerCommand";
import { IacScannerService } from "../../realtimeScanners/scanners/iac/iacScannerService";
import { ConfigurationManager } from "../../realtimeScanners/configuration/configurationManager";
import {
  setExtensionConfig,
  resetExtensionConfig,
} from "../../config/extensionConfig";

describe("IacScannerCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let context: any;
  let logs: any;
  let configManager: ConfigurationManager;
  let cmd: IacScannerCommand;
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
    cmd = new IacScannerCommand(context, logs, configManager);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  it("should construct and expose its scanner service", () => {
    expect(cmd.getScannerService()).to.be.instanceOf(IacScannerService);
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
    expect(provideHover(makeDoc("/p/main.tf"), { line: 0, character: 0 })).to.be
      .undefined;
  });

  it("getHover returns a Hover with severity icon and details", async () => {
    await register();
    const svc = cmd.getScannerService();
    const fsPath = "/p/main.tf";
    svc.getHoverData().set(`${fsPath}:3`, [
      {
        similarityId: "sim",
        title: "Open Port",
        description: "desc",
        severity: "High",
        expectedValue: "closed",
        actualValue: "open",
        filePath: fsPath,
        fileType: "tf",
      } as any,
    ]);
    seedDiagnostic(svc, fsPath, 3);

    const hover = provideHover(makeDoc(fsPath), { line: 3, character: 5 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("Open Port");
  });

  it("getHover handles multiple findings and unknown severity (no icon)", async () => {
    await register();
    const svc = cmd.getScannerService();
    const fsPath = "/p/main.tf";
    svc.getHoverData().set(`${fsPath}:4`, [
      {
        similarityId: "a",
        title: "A",
        description: "d",
        severity: "High",
        expectedValue: "x",
        actualValue: "y",
        filePath: fsPath,
        fileType: "tf",
      } as any,
      {
        similarityId: "b",
        title: "B",
        description: "d",
        severity: "Bogus",
        expectedValue: "x",
        actualValue: "y",
        filePath: fsPath,
        fileType: "tf",
      } as any,
    ]);
    seedDiagnostic(svc, fsPath, 4);

    const hover = provideHover(makeDoc(fsPath), { line: 4, character: 5 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("A");
    expect(hover.contents.value).to.include("B");
  });

  it("dispose should not throw", async () => {
    await register();
    await cmd.dispose();
  });
});
