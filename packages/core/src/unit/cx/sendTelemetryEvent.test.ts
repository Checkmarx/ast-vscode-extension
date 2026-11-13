/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import { Cx } from "../../cx/cx";
import { TelemetryPayload } from "../../models/telemetryEvent";
import { setExtensionConfig } from "../../config/extensionConfig";

describe("Cx.sendTelemetryEvent", () => {
  let sandbox: sinon.SinonSandbox;
  let telemetryEvent: sinon.SinonStub;
  let telemetryAIEvent: sinon.SinonStub;
  let wrapper: any;

  function createCx(token: string | undefined = "test-token"): Cx {
    const cx = new Cx({
      subscriptions: [],
      extensionPath: "/test",
      globalState: { get: () => undefined, update: async () => undefined },
      secrets: { get: async () => token, store: async () => undefined, delete: async () => undefined },
    } as any);
    sandbox.stub(cx as any, "createTelemetryWrapper").callsFake(() => wrapper);
    return cx;
  }

  const scanPayload: TelemetryPayload = {
    eventType: "Scan", subType: "scantriggerd", engine: "Asca", status: "Success",
    totalCount: 3, statusResult: "Critical=0, High=2, Medium=0, Low=0, Info=1",
    agent: "VS Code", agentVersion: "1.140.0", pluginType: "IDE",
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    } as any);
    telemetryEvent = sandbox.stub().resolves({ exitCode: 0 });
    telemetryAIEvent = sandbox.stub().resolves({ exitCode: 0 });
    wrapper = { telemetryEvent, telemetryAIEvent };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("returns false without calling the CLI when not authenticated", async () => {
    expect(await createCx("").sendTelemetryEvent(scanPayload)).to.equal(false);
    expect(telemetryEvent.called).to.equal(false);
  });

  it("sends the payload with the analytics method", async () => {
    expect(await createCx().sendTelemetryEvent(scanPayload)).to.equal(true);
    expect(telemetryEvent.calledOnceWith(scanPayload)).to.equal(true);
    expect(telemetryAIEvent.called).to.equal(false);
  });

  it("returns false on other CLI errors without falling back", async () => {
    telemetryEvent.resolves({ exitCode: 1, status: "401 Unauthorized" });
    expect(await createCx().sendTelemetryEvent(scanPayload)).to.equal(false);
    expect(telemetryAIEvent.called).to.equal(false);
  });

  it("falls back to one legacy event per severity when the CLI rejects the new flags", async () => {
    telemetryEvent.resolves({ exitCode: 1, status: "Error: unknown flag: --agent-version" });
    const cx = createCx();
    expect(await cx.sendTelemetryEvent(scanPayload)).to.equal(true);
    expect(telemetryAIEvent.callCount).to.equal(2);
    expect(telemetryAIEvent.firstCall.args).to.deep.equal(["", "", "", "", "", "asca", "High", 2]);
    expect(telemetryAIEvent.secondCall.args).to.deep.equal(["", "", "", "", "", "asca", "Unknown", 1]);

    // The legacy format is used for the rest of the session.
    await cx.sendTelemetryEvent(scanPayload);
    expect(telemetryEvent.callCount).to.equal(1);
  });

  it("sends click events in the legacy format", async () => {
    telemetryEvent.resolves({ exitCode: 1, status: "unknown flag: --event-attributes" });
    const delivered = await createCx().sendTelemetryEvent({
      eventType: "click", subType: "fixWithAIChat", engine: "Oss", problemSeverity: "High", aiProvider: "Copilot", status: "Success",
    });
    expect(delivered).to.equal(true);
    expect(telemetryAIEvent.firstCall.args).to.deep.equal(["Copilot", "click", "fixWithAIChat", "Oss", "High", "", "", 0]);
  });

  it("does not send install, authentication or failed-scan events in the legacy format", async () => {
    telemetryEvent.resolves({ exitCode: 1, status: "unknown flag: --agent-version" });
    const cx = createCx();
    expect(await cx.sendTelemetryEvent({ eventType: "install", subType: "installation", status: "Success" })).to.equal(false);
    expect(await cx.sendTelemetryEvent({ eventType: "authentication", subType: "authentication", status: "Success" })).to.equal(false);
    expect(await cx.sendTelemetryEvent({ ...scanPayload, status: "Failure" })).to.equal(false);
    expect(telemetryAIEvent.called).to.equal(false);
  });

  it("uses the legacy format when the wrapper has no analytics method", async () => {
    wrapper = { telemetryAIEvent };
    expect(await createCx().sendTelemetryEvent(scanPayload)).to.equal(true);
    expect(telemetryAIEvent.callCount).to.equal(2);
  });

  it("never throws", async () => {
    telemetryEvent.rejects(new Error("spawn failed"));
    expect(await createCx().sendTelemetryEvent(scanPayload)).to.equal(false);
  });
});
