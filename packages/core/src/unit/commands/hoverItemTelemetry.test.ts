/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import * as sinon from "sinon";
import { mock } from "../mocks/vscode-mock";
import {
  emitHoverClickEvent,
  emitRemediationEvent,
  getEngine,
  getSeverity,
  getVulnerabilityId,
} from "../../commands/hoverItemTelemetry";
import { toAiProviderName } from "../../models/telemetryEvent";
import { resetIdeInfoCache } from "../../utils/ideInfo";
import { flushPromises, stubSendTelemetry } from "../helpers/telemetryTestUtils";

const ossItem: any = { packageManager: "npm", packageName: "lodash", version: "4.17.20", status: "High", filePath: "/repo/package.json", line: 3 };
const containersItem: any = { imageName: "nginx", imageTag: "1.19", status: "Critical", vulnerabilities: [], fileType: "dockerfile", filePath: "/repo/Dockerfile" };
const ascaItem: any = { ruleName: "Avoid eval", ruleId: 3, description: "d", severity: "Medium", remediationAdvise: "r", filePath: "/repo/a.js" };
const iacItem: any = { similarityId: "sim-123", title: "t", description: "d", severity: "Low", expectedValue: "", actualValue: "", filePath: "/tmp/x.tf", originalFilePath: "/repo/x.tf", fileType: "tf" };
const secretsItem: any = { title: "generic-api-key", description: "d", severity: "Critical", secretValue: "s", filePath: "/repo/.env" };

describe("hoverItemTelemetry", () => {
  let sandbox: sinon.SinonSandbox;
  const originalAppName = (mock as any).env.appName;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    (mock as any).env.appName = originalAppName;
    resetIdeInfoCache();
  });

  it("getEngine returns the engine name for each item type", () => {
    expect(getEngine(ossItem)).to.equal("Oss");
    expect(getEngine(containersItem)).to.equal("Containers");
    expect(getEngine(ascaItem)).to.equal("Asca");
    expect(getEngine(iacItem)).to.equal("IaC");
    expect(getEngine(secretsItem)).to.equal("Secrets");
  });

  it("getSeverity uses severity or status", () => {
    expect(getSeverity(ossItem)).to.equal("High");
    expect(getSeverity(containersItem)).to.equal("Critical");
    expect(getSeverity(ascaItem)).to.equal("Medium");
    expect(getSeverity(iacItem)).to.equal("Low");
    expect(getSeverity(secretsItem)).to.equal("Critical");
  });

  it("getVulnerabilityId returns the identifier for each engine", () => {
    expect(getVulnerabilityId(ossItem)).to.equal("lodash@4.17.20");
    expect(getVulnerabilityId(containersItem)).to.equal("nginx:1.19");
    expect(getVulnerabilityId(ascaItem)).to.equal("3");
    expect(getVulnerabilityId({ ...ascaItem, ruleId: undefined })).to.equal("Avoid eval");
    expect(getVulnerabilityId(iacItem)).to.equal("sim-123");
    expect(getVulnerabilityId(secretsItem)).to.equal("generic-api-key");
  });

  describe("emitRemediationEvent", () => {
    it("sends a successful remediation with the assistant that was used", async () => {
      const stub = stubSendTelemetry(sandbox);
      emitRemediationEvent(ossItem, "Copilot");
      await flushPromises();
      const payload = stub.firstCall.args[0];
      expect(payload).to.include({
        eventType: "click",
        subType: "fixWithAIChat",
        engine: "Oss",
        problemSeverity: "High",
        aiProvider: "Copilot",
        status: "Success",
        statusResult: "Remediation completed successfully.",
      });
      expect(payload.eventAttributes).to.deep.equal({ vulnerabilityId: "lodash@4.17.20", remediationMode: "DevAssist" });
    });

    it("sends a failure when no assistant was available", async () => {
      const stub = stubSendTelemetry(sandbox);
      emitRemediationEvent(secretsItem, null, "No AI assistant available");
      await flushPromises();
      const payload = stub.firstCall.args[0];
      expect(payload).to.include({ status: "Failure", aiProvider: "" });
      expect(payload.statusResult).to.equal("Remediation failed. Reason: No AI assistant available, Error Code: N/A");
    });
  });

  describe("emitHoverClickEvent", () => {
    it("keeps the IDE-based aiProvider for other clicks", async () => {
      const stub = stubSendTelemetry(sandbox);
      (mock as any).env.appName = "Windsurf";
      resetIdeInfoCache();
      emitHoverClickEvent("viewDetails", ascaItem);
      await flushPromises();
      expect(stub.firstCall.args[0]).to.include({ eventType: "click", subType: "viewDetails", aiProvider: "Cascade", agent: "Windsurf" });
    });

    it("uses VS Code as aiProvider in VS Code", async () => {
      const stub = stubSendTelemetry(sandbox);
      (mock as any).env.appName = "Visual Studio Code";
      resetIdeInfoCache();
      emitHoverClickEvent("ignorePackage", ossItem);
      await flushPromises();
      expect(stub.firstCall.args[0]).to.include({ subType: "ignorePackage", aiProvider: "VS Code" });
    });
  });

  it("toAiProviderName maps the internal assistant ids", () => {
    expect(toAiProviderName("copilot")).to.equal("Copilot");
    expect(toAiProviderName("claude")).to.equal("Claude");
    expect(toAiProviderName("codex")).to.equal("Codex");
    expect(toAiProviderName("Cascade")).to.equal("Cascade");
    expect(toAiProviderName(null)).to.equal(null);
  });
});
