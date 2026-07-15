/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { mockDiagnosticCollection } from "../mocks/vscode-mock";
import { OssScannerService } from "../../realtimeScanners/scanners/oss/ossScannerService";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("OssScannerService", () => {
  let service: OssScannerService;
  let sandbox: sinon.SinonSandbox;

  const makeUri = (fsPath: string): vscode.Uri =>
    ({ fsPath, scheme: "file", toString: () => fsPath } as any);

  const makeOss = (overrides: any = {}) => ({
    packageManager: "npm",
    packageName: "lodash",
    version: "4.17.0",
    filepath: "/test/package.json",
    status: "Critical",
    locations: [{ line: 2, startIndex: 0, endIndex: 10 }],
    vulnerabilities: [{ cve: "CVE-2021-1", description: "proto pollution", severity: "Critical" }],
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
    service = new OssScannerService();
    mockDiagnosticCollection.set.reset();
    mockDiagnosticCollection.delete.reset();
    mockDiagnosticCollection.clear.reset();
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("Constructor", () => {
    it("should instantiate with oss engine config", () => {
      expect(service).to.exist;
      expect(service.config.engineName).to.equal(constants.ossRealtimeScannerEngineName);
    });

    it("should start with empty maps", () => {
      expect(service.getHoverData().size).to.equal(0);
      expect(service.getDiagnosticsMap().size).to.equal(0);
    });
  });

  describe("matchesManifestPattern", () => {
    it("should match package.json", () => {
      expect(service.matchesManifestPattern("/project/package.json")).to.be.true;
    });

    it("should match pom.xml", () => {
      expect(service.matchesManifestPattern("/project/pom.xml")).to.be.true;
    });

    it("should match requirements.txt", () => {
      expect(service.matchesManifestPattern("/project/requirements.txt")).to.be.true;
    });

    it("should match go.mod", () => {
      expect(service.matchesManifestPattern("/project/go.mod")).to.be.true;
    });

    it("should match a .csproj file", () => {
      expect(service.matchesManifestPattern("/project/App.csproj")).to.be.true;
    });

    it("should not match an arbitrary source file", () => {
      expect(service.matchesManifestPattern("/project/index.ts")).to.be.false;
    });

    it("should normalize windows-style separators", () => {
      expect(service.matchesManifestPattern("C:\\project\\package.json")).to.be.true;
    });
  });

  describe("shouldScanFile", () => {
    it("should return true for a manifest file", () => {
      const doc = { uri: makeUri("/project/package.json") } as any;
      expect(service.shouldScanFile(doc)).to.be.true;
    });

    it("should return false for a non-manifest file", () => {
      const doc = { uri: makeUri("/project/index.ts") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for non-file scheme", () => {
      const doc = { uri: { fsPath: "/project/package.json", scheme: "untitled" } } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for manifest in node_modules", () => {
      const doc = { uri: makeUri("/project/node_modules/x/package.json") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });
  });

  describe("updateProblems", () => {
    it("should create a diagnostic for a critical package", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/package.json");
      expect(diagnostics).to.exist;
      expect(diagnostics!.length).to.equal(1);
      expect(diagnostics![0].message).to.include("Critical-risk package");
      expect(diagnostics![0].message).to.include("lodash@4.17.0");
    });

    it("should create a diagnostic for a malicious package", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss({ status: "Malicious", packageName: "evil" })], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/package.json");
      expect(diagnostics![0].message).to.include("Malicious package detected");
    });

    it("should NOT create a diagnostic for an OK package", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss({ status: "OK" })], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/package.json");
      expect(diagnostics!.length).to.equal(0);
    });

    it("should NOT create a diagnostic for an Unknown package", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss({ status: "Unknown" })], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/package.json");
      expect(diagnostics!.length).to.equal(0);
    });

    it("should store hover data for a risky package", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss()], uri);

      const hover = service.getHoverData().get("/test/package.json:2");
      expect(hover).to.exist;
      expect(hover!.packageName).to.equal("lodash");
      expect(hover!.status).to.equal("Critical");
    });

    it("should set source to Cx AI", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/package.json");
      expect(diagnostics![0].source).to.equal(constants.getCxAi());
    });

    it("should attach oss engine type to diagnostic data", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/package.json");
      const data = (diagnostics![0] as any).data;
      expect(data.cxType).to.equal(constants.ossRealtimeScannerEngineName);
      expect(data.item.packageName).to.equal("lodash");
    });

    it("should handle high, medium and low severity packages", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>(
        [
          makeOss({ status: "High", packageName: "a", locations: [{ line: 1, startIndex: 0, endIndex: 3 }] }),
          makeOss({ status: "Medium", packageName: "b", locations: [{ line: 2, startIndex: 0, endIndex: 3 }] }),
          makeOss({ status: "Low", packageName: "c", locations: [{ line: 3, startIndex: 0, endIndex: 3 }] }),
        ],
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/package.json");
      expect(diagnostics!.length).to.equal(3);
    });

    it("should only add a diagnostic for the first location of a package", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>(
        [
          makeOss({
            locations: [
              { line: 2, startIndex: 0, endIndex: 10 },
              { line: 5, startIndex: 0, endIndex: 10 },
            ],
          }),
        ],
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/package.json");
      expect(diagnostics!.length).to.equal(1);
    });

    it("should handle empty problems array", () => {
      const uri = makeUri("/test/package.json");
      expect(() => service.updateProblems<any>([], uri)).to.not.throw();
    });
  });

  describe("clearScanData", () => {
    it("should remove diagnostics and hover data for a file", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss()], uri);
      expect(service.getDiagnosticsMap().has("/test/package.json")).to.be.true;

      service.clearScanData(uri);

      expect(service.getDiagnosticsMap().has("/test/package.json")).to.be.false;
    });

    it("should delete from the diagnostic collection", () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss()], uri);

      service.clearScanData(uri);

      expect(mockDiagnosticCollection.delete.called).to.be.true;
    });
  });

  describe("clearProblems", () => {
    it("should clear all diagnostics and collection", async () => {
      const uri = makeUri("/test/package.json");
      service.updateProblems<any>([makeOss()], uri);

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
