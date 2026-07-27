/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { ContainersScannerCommand } from "../../realtimeScanners/scanners/containers/containersScannerCommand";
import { ContainersScannerService } from "../../realtimeScanners/scanners/containers/containersScannerService";
import { ConfigurationManager } from "../../realtimeScanners/configuration/configurationManager";
import {
  setExtensionConfig,
  resetExtensionConfig,
} from "../../config/extensionConfig";

describe("ContainersScannerCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let context: any;
  let logs: any;
  let configManager: ConfigurationManager;
  let cmd: ContainersScannerCommand;
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
    cmd = new ContainersScannerCommand(context, logs, configManager);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  it("should construct and expose its scanner service", () => {
    expect(cmd.getScannerService()).to.be.instanceOf(ContainersScannerService);
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
    expect(provideHover(makeDoc("/p/Dockerfile"), { line: 0, character: 0 })).to
      .be.undefined;
  });

  it("getHover returns a Hover for a vulnerable image", async () => {
    await register();
    const svc = cmd.getScannerService();
    const fsPath = "/p/Dockerfile";
    svc.getHoverData().set(`${fsPath}:1`, {
      imageName: "nginx",
      imageTag: "latest",
      status: "High" as any,
      vulnerabilities: [
        { cve: "CVE-1", severity: "High" },
        { cve: "CVE-2", severity: "Low" },
      ],
      fileType: "dockerfile",
      filePath: fsPath,
    } as any);
    seedDiagnostic(svc, fsPath, 1);

    const hover = provideHover(makeDoc(fsPath), { line: 1, character: 5 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("nginx");
  });

  it("getHover renders the malicious branch", async () => {
    await register();
    const svc = cmd.getScannerService();
    const fsPath = "/p/Dockerfile";
    svc.getHoverData().set(`${fsPath}:2`, {
      imageName: "evil",
      imageTag: "1.0",
      status: "Malicious" as any,
      vulnerabilities: [],
      fileType: "dockerfile",
      filePath: fsPath,
    } as any);
    seedDiagnostic(svc, fsPath, 2);

    const hover = provideHover(makeDoc(fsPath), { line: 2, character: 5 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("evil");
  });

  it("dispose should not throw", async () => {
    await register();
    await cmd.dispose();
  });
});
