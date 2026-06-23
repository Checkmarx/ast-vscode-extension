/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import { ScannerRegistry } from "../../realtimeScanners/scanners/scannerRegistry";
import { ConfigurationManager } from "../../realtimeScanners/configuration/configurationManager";
import { constants } from "../../utils/common/constants";
import {
  setExtensionConfig,
  resetExtensionConfig,
} from "../../config/extensionConfig";

describe("ScannerRegistry", () => {
  let sandbox: sinon.SinonSandbox;
  let context: any;
  let logs: any;
  let configManager: ConfigurationManager;
  let registry: ScannerRegistry;

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
    registry = new ScannerRegistry(context, logs, configManager);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  it("should register all five built-in scanners", () => {
    expect(registry.getScanner(constants.ossRealtimeScannerEngineName)).to.exist;
    expect(registry.getScanner(constants.secretsScannerEngineName)).to.exist;
    expect(registry.getScanner(constants.ascaRealtimeScannerEngineName)).to.exist;
    expect(registry.getScanner(constants.containersRealtimeScannerEngineName)).to
      .exist;
    expect(registry.getScanner(constants.iacRealtimeScannerEngineName)).to.exist;
  });

  it("should return undefined for an unknown scanner id", () => {
    expect(registry.getScanner("does-not-exist")).to.be.undefined;
  });

  it("registerScanner should add a custom scanner", () => {
    const fake: any = { register: sandbox.stub(), dispose: sandbox.stub() };
    registry.registerScanner("custom", fake);
    expect(registry.getScanner("custom")).to.equal(fake);
  });

  it("activateAllScanners should call register on every scanner", async () => {
    const ids = [
      constants.ossRealtimeScannerEngineName,
      constants.secretsScannerEngineName,
      constants.ascaRealtimeScannerEngineName,
      constants.containersRealtimeScannerEngineName,
      constants.iacRealtimeScannerEngineName,
    ];
    const stubs = ids.map((id) =>
      sandbox.stub(registry.getScanner(id) as any, "register").resolves()
    );
    await registry.activateAllScanners();
    stubs.forEach((s) => expect(s.called).to.be.true);
  });

  it("deactivateAllScanners should call dispose on every scanner", async () => {
    const ids = [
      constants.ossRealtimeScannerEngineName,
      constants.secretsScannerEngineName,
      constants.ascaRealtimeScannerEngineName,
      constants.containersRealtimeScannerEngineName,
      constants.iacRealtimeScannerEngineName,
    ];
    const stubs = ids.map((id) =>
      sandbox.stub(registry.getScanner(id) as any, "dispose").resolves()
    );
    await registry.deactivateAllScanners();
    stubs.forEach((s) => expect(s.called).to.be.true);
  });

  it("clearAllScanners should call clearProblems on each scanner service", async () => {
    const ossScanner = registry.getScanner(
      constants.ossRealtimeScannerEngineName
    ) as any;
    const svc = ossScanner.getScannerService();
    const clearStub = sandbox.stub(svc, "clearProblems").resolves();
    await registry.clearAllScanners();
    expect(clearStub.called).to.be.true;
  });

  it("clearAllScanners should not throw if a scanner is missing", async () => {
    // Replace the internal map with one missing scanners to exercise the guard
    (registry as any).scanners = new Map();
    await registry.clearAllScanners();
  });
});
