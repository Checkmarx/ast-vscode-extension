/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { mock } from "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as os from "os";
import * as path from "path";
import {
  buildIdeOnboardingProperties,
  getIdeOnboardingPropertiesPath,
  getIdeOnboardingValues,
  getIdeOnboardingConfigKeys,
  IdeOnboardingValues,
  setIdeOnboardingAuthenticated,
  readSeverityThresholdFromFile,
  writeIdeOnboardingProperties,
} from "../../services/ideOnboardingProperties";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

// Use the real module object so sinon stubs are seen by the code under test
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs: typeof import("fs") = require("fs");

describe("IDE onboarding properties writer", () => {
  let sandbox: sinon.SinonSandbox;
  let homeDir: string;

  const values: IdeOnboardingValues = {
    selfHealingEnabled: true,
    ascaEnabled: true,
    scaEnabled: false,
    secretEnabled: true,
    kicsEnabled: false,
    containersEnabled: true,
    severityThreshold: "low",
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cx-ide-props-"));
    setIdeOnboardingAuthenticated(true);
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
  });

  afterEach(() => {
    sandbox.restore();
    setIdeOnboardingAuthenticated(false);
    resetExtensionConfig();
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  it("builds the content in the spec format", () => {
    const content = buildIdeOnboardingProperties(values, "2026-10-23T00:00:00.000Z");
    expect(content).to.equal(
      [
        "cx_schema_version=1",
        "cx_self_healing_enabled=true",
        "cx_asca_scanner_enabled=true",
        "cx_sca_scanner_enabled=false",
        "cx_secret_scanner_enabled=true",
        "cx_kics_scanner_enabled=false",
        "cx_containers_scanner_enabled=true",
        "cx_severity_threshold=low",
        "cx_updated_at=2026-10-23T00:00:00.000Z",
        "",
      ].join("\n")
    );
  });

  it("creates ~/.checkmarx and writes the file", () => {
    const result = writeIdeOnboardingProperties({ ...values, selfHealingEnabled: false }, { homeDir });
    expect(result).to.equal("written");
    const filePath = getIdeOnboardingPropertiesPath(homeDir);
    expect(filePath).to.equal(path.join(homeDir, ".checkmarx", "cx-onboarding-ide.properties"));
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).to.contain("cx_self_healing_enabled=false\n");
    expect(content).to.match(/cx_updated_at=\d{4}-\d{2}-\d{2}T[\d:.]+Z\n$/);
  });

  it("writes atomically via a temp file in the same directory and leaves no temp files", () => {
    const renameSpy = sandbox.spy(fs, "renameSync");
    writeIdeOnboardingProperties(values, { homeDir });
    expect(renameSpy.calledOnce).to.equal(true);
    const [from, to] = renameSpy.firstCall.args as [string, string];
    expect(path.dirname(from)).to.equal(path.dirname(to));
    expect(to).to.equal(getIdeOnboardingPropertiesPath(homeDir));
    expect(fs.readdirSync(path.join(homeDir, ".checkmarx"))).to.deep.equal(["cx-onboarding-ide.properties"]);
  });

  it("keeps the previous file and cleans the temp file when the rename fails", () => {
    writeIdeOnboardingProperties(values, { homeDir, now: new Date("2026-01-01T00:00:00Z") });
    const before = fs.readFileSync(getIdeOnboardingPropertiesPath(homeDir), "utf8");
    sandbox.stub(fs, "renameSync").throws(new Error("EPERM"));
    const logs = { info: sandbox.stub(), error: sandbox.stub() } as any;

    const result = writeIdeOnboardingProperties({ ...values, selfHealingEnabled: false }, { homeDir, logs });

    expect(result).to.equal("error");
    expect(logs.error.calledOnce).to.equal(true);
    expect(fs.readFileSync(getIdeOnboardingPropertiesPath(homeDir), "utf8")).to.equal(before);
    expect(fs.readdirSync(path.join(homeDir, ".checkmarx"))).to.deep.equal(["cx-onboarding-ide.properties"]);
  });

  it("skips the write when only the timestamp would change", () => {
    writeIdeOnboardingProperties(values, { homeDir, now: new Date("2026-01-01T00:00:00Z") });
    const result = writeIdeOnboardingProperties(values, { homeDir, now: new Date("2026-02-02T00:00:00Z") });
    expect(result).to.equal("unchanged");
    expect(fs.readFileSync(getIdeOnboardingPropertiesPath(homeDir), "utf8")).to.contain("cx_updated_at=2026-01-01T00:00:00.000Z");
  });

  it("rewrites the file when a value changes", () => {
    writeIdeOnboardingProperties(values, { homeDir, now: new Date("2026-01-01T00:00:00Z") });
    const result = writeIdeOnboardingProperties({ ...values, kicsEnabled: true }, { homeDir, now: new Date("2026-02-02T00:00:00Z") });
    expect(result).to.equal("written");
    const content = fs.readFileSync(getIdeOnboardingPropertiesPath(homeDir), "utf8");
    expect(content).to.contain("cx_kics_scanner_enabled=true");
    expect(content).to.contain("cx_updated_at=2026-02-02T00:00:00.000Z");
  });

  it("never throws when the directory cannot be created", () => {
    sandbox.stub(fs, "mkdirSync").throws(new Error("EACCES"));
    expect(writeIdeOnboardingProperties(values, { homeDir })).to.equal("error");
  });

  it("reads the self-heal and scanner settings of the running extension", () => {
    const settings = new Map<string, boolean>([
      ["Checkmarx Self-Healing.Enable Self-Healing", false],
      ["Checkmarx AI Secure Coding Assistant (ASCA) Realtime Scanner.Activate ASCA Realtime", true],
      ["Checkmarx Open Source Realtime Scanner (OSS-Realtime).Activate OSS-Realtime", true],
      ["Checkmarx Secret Detection Realtime Scanner.Activate Secret Detection Realtime", false],
      ["Checkmarx IAC Realtime Scanner.Activate IAC Realtime", true],
      ["Checkmarx Containers Realtime Scanner.Activate Containers Realtime", false],
    ]);
    sandbox.stub(mock.workspace, "getConfiguration").callsFake((section: string) => ({
      get: (key: string, def?: unknown) => settings.get(`${section}.${key}`) ?? def,
    }) as any);

    const result = getIdeOnboardingValues();

    expect(result).to.deep.equal({
      selfHealingEnabled: false,
      ascaEnabled: true,
      scaEnabled: true,
      secretEnabled: false,
      kicsEnabled: true,
      containersEnabled: false,
      severityThreshold: "low",
    });
  });

  it("defaults self-healing to OFF when the setting is not set", () => {
    expect(getIdeOnboardingValues().selfHealingEnabled).to.equal(false);
  });

  it("reports self-healing and every scanner OFF while logged out, whatever the settings say", () => {
    sandbox.stub(mock.workspace, "getConfiguration").callsFake(() => ({ get: () => true }) as any);
    setIdeOnboardingAuthenticated(false);

    const result = getIdeOnboardingValues();

    expect(result).to.deep.equal({
      selfHealingEnabled: false,
      ascaEnabled: false,
      scaEnabled: false,
      secretEnabled: false,
      kicsEnabled: false,
      containersEnabled: false,
      severityThreshold: "low",
    });
  });

  it("uses the per-extension config keys", () => {
    resetExtensionConfig();
    setExtensionConfig({
      extensionId: "cx-dev-assist",
      commandPrefix: "cx-dev-assist",
      viewContainerPrefix: "ignite",
      displayName: "Checkmarx Developer Assist",
      extensionType: "cx-dev-assist",
    });
    const keys = getIdeOnboardingConfigKeys();
    expect(keys[0]).to.equal("Checkmarx Developer Assist Self-Healing.Enable Self-Healing");
    expect(keys).to.have.length(6);
  });
});

describe("cx_severity_threshold in the IDE file", () => {
  let homeDir: string;
  const values: IdeOnboardingValues = {
    selfHealingEnabled: true,
    ascaEnabled: true,
    scaEnabled: false,
    secretEnabled: true,
    kicsEnabled: false,
    containersEnabled: true,
    severityThreshold: "low",
  };
  const propsFile = () => path.join(homeDir, ".checkmarx", "cx-onboarding-ide.properties");
  const readFile = () => fs.readFileSync(propsFile(), "utf8");
  const thresholdLine = () => readFile().split("\n").find((l: string) => l.startsWith("cx_severity_threshold="));
  const setThreshold = (from: string, to: string) => fs.writeFileSync(propsFile(), readFile().replace(from, to));

  beforeEach(() => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cx-ide-threshold-"));
  });

  afterEach(() => {
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  it("writes low when the file does not exist", () => {
    writeIdeOnboardingProperties(values, { homeDir });
    expect(thresholdLine()).to.equal("cx_severity_threshold=low");
  });

  it("keeps a valid threshold the user set by hand, on every sync", () => {
    writeIdeOnboardingProperties(values, { homeDir });
    setThreshold("cx_severity_threshold=low", "cx_severity_threshold=high");
    expect(writeIdeOnboardingProperties({ ...values, selfHealingEnabled: false }, { homeDir })).to.equal("written");
    expect(thresholdLine()).to.equal("cx_severity_threshold=high");
    expect(writeIdeOnboardingProperties(values, { homeDir })).to.equal("written");
    expect(thresholdLine()).to.equal("cx_severity_threshold=high");
  });

  it("reports unchanged when only the timestamp would change and the threshold is kept", () => {
    writeIdeOnboardingProperties(values, { homeDir });
    setThreshold("cx_severity_threshold=low", "cx_severity_threshold=medium");
    expect(writeIdeOnboardingProperties(values, { homeDir })).to.equal("unchanged");
    expect(thresholdLine()).to.equal("cx_severity_threshold=medium");
  });

  it("falls back to low when the value in the file is invalid", () => {
    writeIdeOnboardingProperties(values, { homeDir });
    setThreshold("cx_severity_threshold=low", "cx_severity_threshold=banana");
    writeIdeOnboardingProperties({ ...values, selfHealingEnabled: false }, { homeDir });
    expect(thresholdLine()).to.equal("cx_severity_threshold=low");
  });

  it("reads the last valid value, ignoring case, comments and a BOM", () => {
    expect(readSeverityThresholdFromFile("# cx_severity_threshold=critical\ncx_severity_threshold=High\n")).to.equal("high");
    expect(readSeverityThresholdFromFile("cx_severity_threshold=medium\ncx_severity_threshold=\n")).to.equal(undefined);
    expect(readSeverityThresholdFromFile("\uFEFFcx_severity_threshold=critical\r\n")).to.equal("critical");
    expect(readSeverityThresholdFromFile("cx_schema_version=1\n")).to.equal(undefined);
  });
});
