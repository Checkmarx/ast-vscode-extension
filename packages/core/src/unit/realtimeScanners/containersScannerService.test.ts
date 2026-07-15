/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { mockDiagnosticCollection } from "../mocks/vscode-mock";
import { ContainersScannerService } from "../../realtimeScanners/scanners/containers/containersScannerService";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("ContainersScannerService", () => {
  let service: ContainersScannerService;
  let sandbox: sinon.SinonSandbox;

  const makeUri = (fsPath: string): vscode.Uri =>
    ({ fsPath, scheme: "file", toString: () => fsPath } as any);

  const makeImage = (overrides: any = {}) => ({
    imageName: "nginx",
    imageTag: "1.19",
    filepath: "/test/Dockerfile",
    status: "Critical",
    locations: [{ line: 1, startIndex: 0, endIndex: 12 }],
    vulnerabilities: [{ cve: "CVE-2021-2", severity: "Critical" }],
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
    service = new ContainersScannerService();
    mockDiagnosticCollection.set.reset();
    mockDiagnosticCollection.delete.reset();
    mockDiagnosticCollection.clear.reset();
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("Constructor", () => {
    it("should instantiate with containers engine config", () => {
      expect(service).to.exist;
      expect(service.config.engineName).to.equal(constants.containersRealtimeScannerEngineName);
    });

    it("should start with empty maps", () => {
      expect(service.getHoverData().size).to.equal(0);
      expect(service.getDiagnosticsMap().size).to.equal(0);
    });
  });

  describe("shouldScanFile", () => {
    it("should return true for a Dockerfile", () => {
      const doc = { uri: makeUri("/project/Dockerfile") } as any;
      expect(service.shouldScanFile(doc)).to.be.true;
    });

    it("should return true for docker-compose.yml", () => {
      const doc = { uri: makeUri("/project/docker-compose.yml") } as any;
      expect(service.shouldScanFile(doc)).to.be.true;
    });

    it("should return false for a regular source file", () => {
      const doc = { uri: makeUri("/project/index.ts") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for non-file scheme", () => {
      const doc = { uri: { fsPath: "/project/Dockerfile", scheme: "untitled" } } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for Dockerfile in node_modules", () => {
      const doc = { uri: makeUri("/project/node_modules/x/Dockerfile") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });
  });

  describe("updateProblems", () => {
    it("should create a diagnostic for a critical image", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/Dockerfile");
      expect(diagnostics).to.exist;
      expect(diagnostics!.length).to.equal(1);
      expect(diagnostics![0].message).to.include("nginx:1.19");
    });

    it("should create a diagnostic for a malicious image", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage({ status: "Malicious", imageName: "evil" })], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/Dockerfile");
      expect(diagnostics![0].message).to.include("Malicious container image detected");
    });

    it("should NOT create a diagnostic for an OK image", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage({ status: "OK" })], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/Dockerfile");
      expect(diagnostics!.length).to.equal(0);
    });

    it("should store hover data for a risky image", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage()], uri);

      const hover = service.getHoverData().get("/test/Dockerfile:1");
      expect(hover).to.exist;
      expect(hover!.imageName).to.equal("nginx");
    });

    it("should set source to Cx AI", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/Dockerfile");
      expect(diagnostics![0].source).to.equal(constants.getCxAi());
    });

    it("should attach containers engine type to diagnostic data", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/Dockerfile");
      const data = (diagnostics![0] as any).data;
      expect(data.cxType).to.equal(constants.containersRealtimeScannerEngineName);
      expect(data.item.imageName).to.equal("nginx");
    });

    it("should handle high, medium and low severity images", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>(
        [
          makeImage({ status: "High", imageName: "a", locations: [{ line: 1, startIndex: 0, endIndex: 3 }] }),
          makeImage({ status: "Medium", imageName: "b", locations: [{ line: 2, startIndex: 0, endIndex: 3 }] }),
          makeImage({ status: "Low", imageName: "c", locations: [{ line: 3, startIndex: 0, endIndex: 3 }] }),
        ],
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/Dockerfile");
      expect(diagnostics!.length).to.equal(3);
    });

    it("should skip images with no locations array", () => {
      const uri = makeUri("/test/Dockerfile");
      expect(() =>
        service.updateProblems<any>([makeImage({ locations: undefined })], uri)
      ).to.not.throw();
    });

    it("should handle empty problems array", () => {
      const uri = makeUri("/test/Dockerfile");
      expect(() => service.updateProblems<any>([], uri)).to.not.throw();
    });
  });

  describe("clearScanData", () => {
    it("should remove diagnostics for a file", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage()], uri);
      expect(service.getDiagnosticsMap().has("/test/Dockerfile")).to.be.true;

      service.clearScanData(uri);

      expect(service.getDiagnosticsMap().has("/test/Dockerfile")).to.be.false;
    });

    it("should delete from the diagnostic collection", () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage()], uri);

      service.clearScanData(uri);

      expect(mockDiagnosticCollection.delete.called).to.be.true;
    });
  });

  describe("clearProblems", () => {
    it("should clear all diagnostics and collection", async () => {
      const uri = makeUri("/test/Dockerfile");
      service.updateProblems<any>([makeImage()], uri);

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
