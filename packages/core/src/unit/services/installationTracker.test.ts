/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import * as sinon from "sinon";
import { mock } from "../mocks/vscode-mock";
import { setExtensionConfig } from "../../config/extensionConfig";
import { constants } from "../../utils/common/constants";
import { resetIdeInfoCache } from "../../utils/ideInfo";
import {
  ensureInstallationId,
  flushPendingInstallEvent,
  generateUuidV4,
  resetInstallationTrackerState,
} from "../../services/installationTracker";
import { reportLoginFailure, reportLoginSuccess, toAuthMethod } from "../../services/loginTelemetry";
import { initTelemetry } from "../../services/telemetryService";
import { createTestContext, flushPromises, stubSendTelemetry } from "../helpers/telemetryTestUtils";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("installationTracker", () => {
  let sandbox: sinon.SinonSandbox;
  const originalAppName = (mock as any).env.appName;

  function useExtension(type: "checkmarx" | "cx-dev-assist") {
    setExtensionConfig({
      extensionId: type === "checkmarx" ? "ast-results" : "cx-dev-assist",
      commandPrefix: type === "checkmarx" ? "ast-results" : "cx-dev-assist",
      viewContainerPrefix: type === "checkmarx" ? "ast" : "cxDevAssist",
      displayName: type === "checkmarx" ? "Checkmarx" : "Checkmarx Developer Assist",
      extensionType: type as any,
    } as any);
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    resetInstallationTrackerState();
    (mock as any).env.appName = "Visual Studio Code";
    resetIdeInfoCache();
    useExtension("checkmarx");
    initTelemetry(createTestContext());
  });

  afterEach(() => {
    sandbox.restore();
    (mock as any).env.appName = originalAppName;
    resetIdeInfoCache();
    // Leave the Checkmarx One config in place for later test files.
    useExtension("checkmarx");
  });

  describe("generateUuidV4", () => {
    it("returns a v4 UUID", () => {
      expect(generateUuidV4()).to.match(UUID_V4);
    });

    it("returns different values", () => {
      expect(generateUuidV4()).to.not.equal(generateUuidV4());
    });
  });

  describe("ensureInstallationId", () => {
    it("creates <ide>-<uuid> and a pending install event on first activation", async () => {
      const context = createTestContext();
      const id = await ensureInstallationId(context);
      expect(id).to.match(/^vscode-/);
      expect(id.substring("vscode-".length)).to.match(UUID_V4);
      expect(context.globalState.get(constants.getInstallationIdKey())).to.equal(id);
      const pending: any = context.globalState.get(constants.getPendingInstallEventKey());
      expect(pending.installationId).to.equal(id);
      expect(pending.installationTimestamp).to.match(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("keeps the same id on later activations", async () => {
      const context = createTestContext();
      const first = await ensureInstallationId(context);
      await context.globalState.update(constants.getPendingInstallEventKey(), undefined);
      const second = await ensureInstallationId(context);
      expect(second).to.equal(first);
      expect(context.globalState.get(constants.getPendingInstallEventKey())).to.equal(undefined);
    });

    it("uses the IDE prefix", async () => {
      for (const [appName, prefix] of [["Cursor", "cursor"], ["Windsurf - Next", "windsurf"], ["Devin", "devin"], ["Kiro", "kiro"]]) {
        (mock as any).env.appName = appName;
        resetIdeInfoCache();
        const id = await ensureInstallationId(createTestContext());
        expect(id.startsWith(`${prefix}-`)).to.equal(true, appName);
      }
    });

    it("uses separate keys for Checkmarx One and Dev Assist", () => {
      useExtension("checkmarx");
      const cxKey = constants.getInstallationIdKey();
      useExtension("cx-dev-assist");
      const devAssistKey = constants.getInstallationIdKey();
      expect(cxKey).to.not.equal(devAssistKey);
    });
  });

  describe("flushPendingInstallEvent", () => {
    it("sends the install event and clears it when delivered", async () => {
      const stub = stubSendTelemetry(sandbox, true);
      const context = createTestContext();
      const id = await ensureInstallationId(context);
      await flushPendingInstallEvent(context);

      expect(stub.calledOnce).to.equal(true);
      const payload = stub.firstCall.args[0];
      expect(payload).to.include({ eventType: "install", subType: "installation", status: "Success" });
      expect(payload.eventAttributes?.installationId).to.equal(id);
      expect(payload.eventAttributes?.installationTimestamp).to.be.a("string");
      expect(context.globalState.get(constants.getPendingInstallEventKey())).to.equal(undefined);
    });

    it("keeps the event pending when it wasn't delivered", async () => {
      stubSendTelemetry(sandbox, false);
      const context = createTestContext();
      await ensureInstallationId(context);
      await flushPendingInstallEvent(context);
      expect(context.globalState.get(constants.getPendingInstallEventKey())).to.not.equal(undefined);
    });

    it("sends nothing when there is no pending event", async () => {
      const stub = stubSendTelemetry(sandbox, true);
      await flushPendingInstallEvent(createTestContext());
      expect(stub.called).to.equal(false);
    });

    it("sends the event exactly once for concurrent calls", async () => {
      const stub = stubSendTelemetry(sandbox, true);
      const context = createTestContext();
      await ensureInstallationId(context);
      await Promise.all([flushPendingInstallEvent(context), flushPendingInstallEvent(context)]);
      await flushPendingInstallEvent(context);
      expect(stub.callCount).to.equal(1);
    });
  });

  describe("loginTelemetry", () => {
    it("reportLoginSuccess sends the login event and the pending install event", async () => {
      const stub = stubSendTelemetry(sandbox, true);
      const context = createTestContext();
      await ensureInstallationId(context);
      reportLoginSuccess(context, "APIKey");
      await flushPromises();
      const types = stub.getCalls().map((c) => c.args[0].eventType);
      expect(types).to.include("authentication");
      expect(types).to.include("install");
    });

    it("reportLoginFailure sends a failed login", async () => {
      const stub = stubSendTelemetry(sandbox, true);
      reportLoginFailure("OAuth", "Token validation failed");
      await flushPromises();
      expect(stub.firstCall.args[0]).to.include({ eventType: "authentication", status: "Failure" });
      expect(stub.firstCall.args[0].statusResult).to.contain("Token validation failed");
    });

    it("toAuthMethod maps the webview value", () => {
      expect(toAuthMethod("oauth")).to.equal("OAuth");
      expect(toAuthMethod("apiKey")).to.equal("APIKey");
      expect(toAuthMethod(undefined)).to.equal("APIKey");
    });
  });
});
