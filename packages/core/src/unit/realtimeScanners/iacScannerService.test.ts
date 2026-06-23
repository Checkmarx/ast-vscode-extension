/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { mockDiagnosticCollection } from "../mocks/vscode-mock";
import { IacScannerService } from "../../realtimeScanners/scanners/iac/iacScannerService";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("IacScannerService", () => {
  let service: IacScannerService;
  let sandbox: sinon.SinonSandbox;

  const makeUri = (fsPath: string): vscode.Uri =>
    ({ fsPath, scheme: "file", toString: () => fsPath } as any);

  const makeIac = (overrides: any = {}) => ({
    title: "Insecure config",
    description: "Resource is publicly accessible",
    similarityID: "sim-1",
    filepath: "/test/main.tf",
    severity: "Critical",
    expectedValue: "private",
    actualValue: "public",
    locations: [{ line: 4, startIndex: 0, endIndex: 12 }],
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
    service = new IacScannerService();
    mockDiagnosticCollection.set.reset();
    mockDiagnosticCollection.delete.reset();
    mockDiagnosticCollection.clear.reset();
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("Constructor", () => {
    it("should instantiate with iac engine config", () => {
      expect(service).to.exist;
      expect(service.config.engineName).to.equal(constants.iacRealtimeScannerEngineName);
    });

    it("should start with empty maps", () => {
      expect(service.getHoverData().size).to.equal(0);
      expect(service.getDiagnosticsMap().size).to.equal(0);
    });
  });

  describe("shouldScanFile", () => {
    it("should return true for a .tf file", () => {
      const doc = { uri: makeUri("/project/main.tf") } as any;
      expect(service.shouldScanFile(doc)).to.be.true;
    });

    it("should return true for a Dockerfile", () => {
      const doc = { uri: makeUri("/project/Dockerfile") } as any;
      expect(service.shouldScanFile(doc)).to.be.true;
    });

    it("should return false for a non-file scheme", () => {
      const doc = { uri: { fsPath: "/project/main.tf", scheme: "untitled" } } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for an unsupported extension", () => {
      const doc = { uri: makeUri("/project/readme.txt") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for files in node_modules", () => {
      const doc = { uri: makeUri("/project/node_modules/x/main.tf") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });
  });

  describe("updateProblems", () => {
    it("should create a diagnostic for a detected IaC issue", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>([makeIac()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/main.tf");
      expect(diagnostics).to.exist;
      expect(diagnostics!.length).to.equal(1);
      expect(diagnostics![0].message).to.equal("Insecure config");
    });

    it("should store hover data keyed by filePath and line", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>([makeIac()], uri);

      const hover = service.getHoverData().get("/test/main.tf:4");
      expect(hover).to.exist;
      expect(hover![0].title).to.equal("Insecure config");
      expect(hover![0].severity).to.equal("Critical");
    });

    it("should set source to Cx AI", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>([makeIac()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/main.tf");
      expect(diagnostics![0].source).to.equal(constants.getCxAi());
    });

    it("should attach iac engine type to diagnostic data", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>([makeIac()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/main.tf");
      const data = (diagnostics![0] as any).data;
      expect(data.cxType).to.equal(constants.iacRealtimeScannerEngineName);
    });

    it("should group multiple issues on the same line into one diagnostic", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>(
        [
          makeIac({ title: "Issue A", locations: [{ line: 7, startIndex: 0, endIndex: 5 }] }),
          makeIac({ title: "Issue B", locations: [{ line: 7, startIndex: 0, endIndex: 5 }] }),
        ],
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/main.tf");
      expect(diagnostics!.length).to.equal(1);
      expect(diagnostics![0].message).to.include("2 IaC vulnerabilities");
    });

    it("should keep separate diagnostics for issues on different lines", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>(
        [
          makeIac({ locations: [{ line: 1, startIndex: 0, endIndex: 5 }] }),
          makeIac({ locations: [{ line: 9, startIndex: 0, endIndex: 5 }] }),
        ],
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/main.tf");
      expect(diagnostics!.length).to.equal(2);
    });

    it("should store multiple hover entries for a grouped line", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>(
        [
          makeIac({ title: "Issue A", locations: [{ line: 7, startIndex: 0, endIndex: 5 }] }),
          makeIac({ title: "Issue B", locations: [{ line: 7, startIndex: 0, endIndex: 5 }] }),
        ],
        uri
      );

      const hover = service.getHoverData().get("/test/main.tf:7");
      expect(hover!.length).to.equal(2);
    });

    it("should handle empty problems array without throwing", () => {
      const uri = makeUri("/test/main.tf");
      expect(() => service.updateProblems<any>([], uri)).to.not.throw();
    });
  });

  describe("clearScanData", () => {
    it("should remove diagnostics for a file", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>([makeIac()], uri);
      expect(service.getDiagnosticsMap().has("/test/main.tf")).to.be.true;

      service.clearScanData(uri);

      expect(service.getDiagnosticsMap().has("/test/main.tf")).to.be.false;
    });

    it("should clear hover data", () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>([makeIac()], uri);

      service.clearScanData(uri);

      expect(service.getHoverData().size).to.equal(0);
    });
  });

  describe("clearProblems", () => {
    it("should clear all diagnostics maps and collection", async () => {
      const uri = makeUri("/test/main.tf");
      service.updateProblems<any>([makeIac()], uri);

      await service.clearProblems();

      expect(service.getDiagnosticsMap().size).to.equal(0);
      expect(mockDiagnosticCollection.clear.called).to.be.true;
    });
  });

  describe("dispose", () => {
    it("should not throw when disposing", () => {
      expect(() => service.dispose()).to.not.throw();
    });
  });
});
