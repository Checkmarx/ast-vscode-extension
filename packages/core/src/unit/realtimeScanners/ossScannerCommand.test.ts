/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { OssScannerCommand } from "../../realtimeScanners/scanners/oss/ossScannerCommand";
import { OssScannerService } from "../../realtimeScanners/scanners/oss/ossScannerService";
import { ConfigurationManager } from "../../realtimeScanners/configuration/configurationManager";
import {
  setExtensionConfig,
  resetExtensionConfig,
} from "../../config/extensionConfig";

describe("OssScannerCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let context: any;
  let logs: any;
  let configManager: ConfigurationManager;
  let cmd: OssScannerCommand;

  const makeDoc = (fsPath: string) =>
    ({ uri: { fsPath, scheme: "file", toString: () => fsPath } } as any);

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
    cmd = new OssScannerCommand(context, logs, configManager);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  it("should construct and expose its scanner service", () => {
    expect(cmd.getScannerService()).to.be.instanceOf(OssScannerService);
  });

  it("register (inactive) should clear problems without throwing", async () => {
    sandbox.stub(configManager, "isScannerActive").returns(false);
    await cmd.register();
    expect(logs.info.called).to.be.true;
  });

  it("register (active) should register a hover provider and listeners", async () => {
    sandbox.stub(configManager, "isScannerActive").returns(true);
    const hoverStub = sandbox
      .stub(vscode.languages, "registerHoverProvider")
      .returns({ dispose: () => {} } as any);
    await cmd.register();
    expect(hoverStub.called).to.be.true;
    expect(context.subscriptions.length).to.be.greaterThan(0);
  });

  it("getHover should return undefined when no hover data exists", async () => {
    sandbox.stub(configManager, "isScannerActive").returns(true);
    let provideHover: any;
    sandbox
      .stub(vscode.languages, "registerHoverProvider")
      .callsFake((_sel: any, prov: any) => {
        provideHover = prov.provideHover;
        return { dispose: () => {} } as any;
      });
    await cmd.register();
    const result = provideHover(makeDoc("/p/package.json"), { line: 0 });
    expect(result).to.be.undefined;
  });

  it("getHover should return a Hover for a vulnerable package with a diagnostic", async () => {
    sandbox.stub(configManager, "isScannerActive").returns(true);
    let provideHover: any;
    sandbox
      .stub(vscode.languages, "registerHoverProvider")
      .callsFake((_sel: any, prov: any) => {
        provideHover = prov.provideHover;
        return { dispose: () => {} } as any;
      });
    await cmd.register();

    const svc = cmd.getScannerService();
    const uri = { fsPath: "/p/package.json", scheme: "file", toString: () => "/p/package.json" } as any;
    svc.updateProblems<any>(
      [
        {
          packageManager: "npm",
          packageName: "lodash",
          version: "4.17.0",
          status: "Critical",
          filepath: "/p/package.json",
          locations: [{ line: 2, startIndex: 0, endIndex: 10 }],
          vulnerabilities: [
            { cve: "CVE-1", description: "d", severity: "Critical" },
            { cve: "CVE-2", description: "d", severity: "High" },
          ],
        },
      ],
      uri
    );

    const hover = provideHover(makeDoc("/p/package.json"), { line: 2 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("lodash");
  });

  it("getHover should render the malicious branch", async () => {
    sandbox.stub(configManager, "isScannerActive").returns(true);
    let provideHover: any;
    sandbox
      .stub(vscode.languages, "registerHoverProvider")
      .callsFake((_sel: any, prov: any) => {
        provideHover = prov.provideHover;
        return { dispose: () => {} } as any;
      });
    await cmd.register();

    const svc = cmd.getScannerService();
    const uri = { fsPath: "/p/package.json", scheme: "file", toString: () => "/p/package.json" } as any;
    svc.updateProblems<any>(
      [
        {
          packageManager: "npm",
          packageName: "evil",
          version: "1.0.0",
          status: "Malicious",
          filepath: "/p/package.json",
          locations: [{ line: 3, startIndex: 0, endIndex: 4 }],
          vulnerabilities: [],
        },
      ],
      uri
    );

    const hover = provideHover(makeDoc("/p/package.json"), { line: 3 });
    expect(hover).to.exist;
    expect(hover.contents.value).to.include("evil");
  });

  it("dispose should not throw", async () => {
    sandbox.stub(configManager, "isScannerActive").returns(true);
    sandbox
      .stub(vscode.languages, "registerHoverProvider")
      .returns({ dispose: () => {} } as any);
    await cmd.register();
    await cmd.dispose();
  });

  it("dispose should not throw when never registered", async () => {
    await cmd.dispose();
  });
});
