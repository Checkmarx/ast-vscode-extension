/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { mockDiagnosticCollection } from "../mocks/vscode-mock";
import { AscaScannerService } from "../../realtimeScanners/scanners/asca/ascaScannerService";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("AscaScannerService (diagnostics)", () => {
  let service: AscaScannerService;
  let sandbox: sinon.SinonSandbox;

  const makeUri = (fsPath: string): vscode.Uri =>
    ({ fsPath, scheme: "file", toString: () => fsPath } as any);

  const makeAsca = (scanDetails: any[]) => ({ scanDetails } as any);

  const detail = (overrides: any = {}) => ({
    line: 2,
    problematicLine: "  const x = eval('2+2');",
    ruleName: "Avoid Eval",
    description: "eval is dangerous",
    remediationAdvise: "use safer alternatives",
    severity: "High",
    ruleId: 100,
    ...overrides,
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
    service = new AscaScannerService();
    mockDiagnosticCollection.set.reset();
    mockDiagnosticCollection.delete.reset();
    mockDiagnosticCollection.clear.reset();
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("updateProblems - diagnostics", () => {
    it("should create a diagnostic for a single violation", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(makeAsca([detail()]), uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/app.js");
      expect(diagnostics).to.exist;
      expect(diagnostics!.length).to.equal(1);
      expect(diagnostics![0].message).to.equal("Avoid Eval");
    });

    it("should set the diagnostic source", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(makeAsca([detail()]), uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/app.js");
      expect(diagnostics![0].source).to.equal(constants.getCxAi());
    });

    it("should attach asca data type", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(makeAsca([detail()]), uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/app.js");
      const data = (diagnostics![0] as any).data;
      expect(data.cxType).to.equal("asca");
      expect(data.item.ruleName).to.equal("Avoid Eval");
    });

    it("should compute range start based on leading whitespace", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(makeAsca([detail()]), uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/app.js");
      // "  const..." -> 2 leading spaces, line - 1 = 1
      expect(diagnostics![0].range.start.line).to.equal(1);
      expect(diagnostics![0].range.start.character).to.equal(2);
    });

    it("should group multiple violations on the same line", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(
        makeAsca([
          detail({ line: 3, ruleName: "Rule A" }),
          detail({ line: 3, ruleName: "Rule B", severity: "Critical" }),
        ]),
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/app.js");
      expect(diagnostics!.length).to.equal(1);
      expect(diagnostics![0].message).to.include("2 ASCA violations");
    });

    it("should keep separate diagnostics for different lines", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(
        makeAsca([
          detail({ line: 2 }),
          detail({ line: 8 }),
        ]),
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/app.js");
      expect(diagnostics!.length).to.equal(2);
    });

    it("should store hover data keyed by file and line", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(makeAsca([detail()]), uri);

      const hover = service.getHoverData().get("/test/app.js:1");
      expect(hover).to.exist;
      expect(hover![0].ruleName).to.equal("Avoid Eval");
    });

    it("should fall back to remediationAdvise when description is missing", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(makeAsca([detail({ description: undefined })]), uri);

      const hover = service.getHoverData().get("/test/app.js:1");
      expect(hover![0].description).to.equal("use safer alternatives");
    });

    it("should handle critical/medium/low severities", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(
        makeAsca([
          detail({ line: 2, severity: "Critical" }),
          detail({ line: 4, severity: "Medium" }),
          detail({ line: 6, severity: "Low" }),
        ]),
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/app.js");
      expect(diagnostics!.length).to.equal(3);
    });

    it("should handle empty scanDetails", () => {
      const uri = makeUri("/test/app.js");
      expect(() => service.updateProblems<any>(makeAsca([]), uri)).to.not.throw();
    });
  });

  describe("clearScanData", () => {
    it("should remove diagnostics for the file", () => {
      const uri = makeUri("/test/app.js");
      service.updateProblems<any>(makeAsca([detail()]), uri);
      expect(service.getDiagnosticsMap().has("/test/app.js")).to.be.true;

      service.clearScanData(uri);

      expect(service.getDiagnosticsMap().has("/test/app.js")).to.be.false;
    });
  });

  describe("getDiagnosticsMap / getHoverData", () => {
    it("should return Map instances", () => {
      expect(service.getDiagnosticsMap()).to.be.instanceOf(Map);
      expect(service.getHoverData()).to.be.instanceOf(Map);
    });
  });

  describe("dispose", () => {
    it("should not throw on dispose", () => {
      expect(() => service.dispose()).to.not.throw();
    });
  });
});
