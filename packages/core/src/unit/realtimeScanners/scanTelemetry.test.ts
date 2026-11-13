/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import * as sinon from "sinon";
import "../mocks/vscode-mock";
import { logScanFailure, logScanResults } from "../../realtimeScanners/scanners/common";
import { createEmptySeverityCounts, formatSeverityCounts, parseSeverityCounts, toSeverityLabel } from "../../models/telemetryEvent";
import { flushPromises, stubSendTelemetry } from "../helpers/telemetryTestUtils";

describe("scan telemetry", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("toSeverityLabel", () => {
    it("maps scanner severities and statuses", () => {
      expect(toSeverityLabel("Critical")).to.equal("Critical");
      expect(toSeverityLabel("MALICIOUS")).to.equal("Critical");
      expect(toSeverityLabel("high")).to.equal("High");
      expect(toSeverityLabel("Medium")).to.equal("Medium");
      expect(toSeverityLabel("low")).to.equal("Low");
      expect(toSeverityLabel("Info")).to.equal("Info");
      expect(toSeverityLabel("Unknown")).to.equal("Info");
      expect(toSeverityLabel(undefined)).to.equal("Info");
      expect(toSeverityLabel("OK")).to.equal(undefined);
    });
  });

  describe("formatSeverityCounts / parseSeverityCounts", () => {
    it("round-trips", () => {
      const counts = createEmptySeverityCounts();
      counts["Critical"] = 1;
      counts["Medium"] = 2;
      counts["Info"] = 3;
      const text = formatSeverityCounts(counts);
      expect(text).to.equal("Critical=1, High=0, Medium=2, Low=0, Info=3");
      expect(parseSeverityCounts(text)).to.deep.equal([
        { label: "Critical", count: 1 }, { label: "High", count: 0 }, { label: "Medium", count: 2 },
        { label: "Low", count: 0 }, { label: "Info", count: 3 },
      ]);
    });

    it("ignores malformed parts", () => {
      expect(parseSeverityCounts("Critical=2, Bogus=1, High=x")).to.deep.equal([{ label: "Critical", count: 2 }]);
      expect(parseSeverityCounts(undefined)).to.deep.equal([]);
    });
  });

  describe("logScanResults", () => {
    it("sends exactly one event per scan with the severity breakdown", async () => {
      const stub = stubSendTelemetry(sandbox);
      logScanResults("Asca", ["High", "high", "Medium", "Low", "Unknown"], "/repo/file.ts");
      await flushPromises();

      expect(stub.callCount).to.equal(1);
      const payload = stub.firstCall.args[0];
      expect(payload).to.include({
        eventType: "Scan",
        subType: "scantriggerd",
        engine: "Asca",
        problemSeverity: "High",
        totalCount: 5,
        status: "Success",
        statusResult: "Critical=0, High=2, Medium=1, Low=1, Info=1",
      });
      expect(payload.eventAttributes).to.deep.equal({ apiVersion: "v2" });
    });

    it("counts OSS and Containers statuses, skipping OK", async () => {
      const stub = stubSendTelemetry(sandbox);
      logScanResults("Oss", ["OK", "Malicious", "Critical", "OK", "Low"]);
      await flushPromises();
      expect(stub.firstCall.args[0]).to.include({
        problemSeverity: "Critical",
        totalCount: 3,
        statusResult: "Critical=2, High=0, Medium=0, Low=1, Info=0",
      });
    });

    it("sends a scan with no findings", async () => {
      const stub = stubSendTelemetry(sandbox);
      logScanResults("Secrets", []);
      await flushPromises();
      expect(stub.callCount).to.equal(1);
      expect(stub.firstCall.args[0]).to.include({
        problemSeverity: "",
        totalCount: 0,
        statusResult: "Critical=0, High=0, Medium=0, Low=0, Info=0",
      });
    });
  });

  describe("logScanFailure", () => {
    it("sends a Failure scan event with a sanitized reason", async () => {
      const stub = stubSendTelemetry(sandbox);
      logScanFailure("IaC", new Error("docker not found token=abc"), "/repo/main.tf");
      await flushPromises();
      const payload = stub.firstCall.args[0];
      expect(payload).to.include({ eventType: "Scan", engine: "IaC", status: "Failure" });
      expect(payload.statusResult).to.equal("Scan failed. Reason: docker not found token=***, Error Code: N/A");
    });
  });
});
