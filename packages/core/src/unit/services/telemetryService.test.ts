/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import * as sinon from "sinon";
import { mock } from "../mocks/vscode-mock";
import {
  buildEnvelope,
  emitLoginEvent,
  emitTelemetry,
  emitTelemetryAndWait,
  initTelemetry,
  sanitizeTelemetryText,
  toPayload,
} from "../../services/telemetryService";
import { resetIdeInfoCache } from "../../utils/ideInfo";
import { createTestContext, flushPromises, stubSendTelemetry } from "../helpers/telemetryTestUtils";

describe("telemetryService", () => {
  let sandbox: sinon.SinonSandbox;
  const originalAppName = (mock as any).env.appName;
  const originalVersion = (mock as any).version;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    (mock as any).env.appName = "Visual Studio Code";
    (mock as any).version = "1.140.0";
    resetIdeInfoCache();
    initTelemetry(createTestContext("2.74.0"));
  });

  afterEach(() => {
    sandbox.restore();
    (mock as any).env.appName = originalAppName;
    (mock as any).version = originalVersion;
    resetIdeInfoCache();
  });

  describe("buildEnvelope", () => {
    it("has the IDE, its version, the plugin version and plugin type", () => {
      expect(buildEnvelope()).to.deep.equal({
        agent: "VS Code",
        agentVersion: "1.140.0",
        cxPluginVersion: "2.74.0",
        pluginType: "IDE",
      });
    });

    it("reports the fork as the agent", () => {
      (mock as any).env.appName = "Cursor";
      resetIdeInfoCache();
      expect(buildEnvelope().agent).to.equal("Cursor");
    });

    it("reads the plugin version from package.json when context.extension is missing", () => {
      initTelemetry({ extensionPath: "/does/not/exist" } as any);
      expect(buildEnvelope().cxPluginVersion).to.equal("");
    });
  });

  describe("toPayload", () => {
    it("merges the envelope with the event fields", () => {
      const payload = toPayload({
        type: "Scan", subType: "scantriggerd", status: "Success", engine: "Asca",
        problemSeverity: "High", totalCount: 2, statusResult: "Critical=0, High=2, Medium=0, Low=0, Info=0",
        repoUrl: "https://github.com/org/repo", eventAttributes: { apiVersion: "v2" },
      });
      expect(payload).to.include({
        agent: "VS Code", agentVersion: "1.140.0", cxPluginVersion: "2.74.0", pluginType: "IDE",
        eventType: "Scan", subType: "scantriggerd", status: "Success", engine: "Asca",
        problemSeverity: "High", totalCount: 2, repoUrl: "https://github.com/org/repo",
      });
      expect(payload.eventAttributes).to.deep.equal({ apiVersion: "v2" });
    });

    it("sanitizes statusResult", () => {
      const payload = toPayload({ type: "Scan", subType: "x", status: "Failure", statusResult: "failed apikey=abc123" });
      expect(payload.statusResult).to.equal("failed apikey=***");
    });
  });

  describe("emitTelemetryAndWait / emitTelemetry", () => {
    it("sends the payload and returns the delivery result", async () => {
      const stub = stubSendTelemetry(sandbox, true);
      const delivered = await emitTelemetryAndWait({ type: "click", subType: "viewDetails", status: "Success" });
      expect(delivered).to.equal(true);
      expect(stub.calledOnce).to.equal(true);
      expect(stub.firstCall.args[0]).to.include({ eventType: "click", subType: "viewDetails", agent: "VS Code" });
    });

    it("returns false when not delivered", async () => {
      stubSendTelemetry(sandbox, false);
      expect(await emitTelemetryAndWait({ type: "click", subType: "x", status: "Success" })).to.equal(false);
    });

    it("never rejects when sending throws", async () => {
      const stub = stubSendTelemetry(sandbox);
      stub.rejects(new Error("boom"));
      expect(await emitTelemetryAndWait({ type: "click", subType: "x", status: "Success" })).to.equal(false);
    });

    it("emitTelemetry sends in the background", async () => {
      const stub = stubSendTelemetry(sandbox);
      emitTelemetry({ type: "click", subType: "x", status: "Success" });
      await flushPromises();
      expect(stub.calledOnce).to.equal(true);
    });
  });

  describe("emitLoginEvent", () => {
    it("sends a successful login with the auth method", async () => {
      const stub = stubSendTelemetry(sandbox);
      emitLoginEvent("OAuth", true);
      await flushPromises();
      const payload = stub.firstCall.args[0];
      expect(payload).to.include({
        eventType: "authentication", subType: "authentication", status: "Success",
        statusResult: "Authentication successful.",
      });
      expect(payload.eventAttributes?.authMethod).to.equal("OAuth");
      expect(payload.eventAttributes?.loginTimestamp).to.match(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("sends a failed login with a sanitized reason", async () => {
      const stub = stubSendTelemetry(sandbox);
      emitLoginEvent("APIKey", false, new Error("invalid token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123"));
      await flushPromises();
      const payload = stub.firstCall.args[0];
      expect(payload.status).to.equal("Failure");
      expect(payload.statusResult).to.match(/^Authentication failed\. Reason: .*, Error Code: N\/A$/);
      expect(payload.statusResult).to.not.contain("eyJ");
      expect(payload.eventAttributes?.authMethod).to.equal("APIKey");
    });
  });

  describe("sanitizeTelemetryText", () => {
    it("keeps ordinary text", () => {
      expect(sanitizeTelemetryText("API Key validation failed")).to.equal("API Key validation failed");
    });

    it("masks key=value secrets", () => {
      expect(sanitizeTelemetryText("bad apikey=abc123 here")).to.equal("bad apikey=*** here");
      expect(sanitizeTelemetryText("token: xyz")).to.equal("token=***");
      expect(sanitizeTelemetryText("Authorization Bearer abc.def")).to.not.contain("abc.def");
    });

    it("masks credentials in URLs", () => {
      expect(sanitizeTelemetryText("cannot reach https://user:pass@host/x")).to.equal("cannot reach https://***@host/x");
    });

    it("masks JWTs and long opaque strings", () => {
      expect(sanitizeTelemetryText("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig")).to.equal("***");
      expect(sanitizeTelemetryText("key " + "a".repeat(40))).to.equal("key ***");
    });

    it("uses the message of an Error", () => {
      expect(sanitizeTelemetryText(new Error("oops"))).to.equal("oops");
    });

    it("collapses whitespace and truncates", () => {
      expect(sanitizeTelemetryText("a\n\n  b")).to.equal("a b");
      expect(sanitizeTelemetryText("word ".repeat(100)).length).to.be.at.most(256);
    });

    it("handles non-string values", () => {
      expect(sanitizeTelemetryText(undefined)).to.equal("undefined");
      expect(sanitizeTelemetryText(42)).to.equal("42");
    });
  });
});
