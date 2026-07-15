/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { mockDiagnosticCollection } from "../mocks/vscode-mock";
import { SecretsScannerService } from "../../realtimeScanners/scanners/secrets/secretsScannerService";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("SecretsScannerService", () => {
  let service: SecretsScannerService;
  let sandbox: sinon.SinonSandbox;

  const makeUri = (fsPath: string): vscode.Uri =>
    ({ fsPath, scheme: "file", toString: () => fsPath } as any);

  const makeSecret = (overrides: any = {}) => ({
    title: "AWS Key",
    description: "A hardcoded AWS key was found",
    secretValue: "AKIA1234567890",
    filepath: "/test/file.js",
    severity: "Critical",
    locations: [{ line: 3, startIndex: 0, endIndex: 20 }],
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
    service = new SecretsScannerService();
    mockDiagnosticCollection.set.reset();
    mockDiagnosticCollection.delete.reset();
    mockDiagnosticCollection.clear.reset();
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("Constructor", () => {
    it("should instantiate with secrets engine config", () => {
      expect(service).to.exist;
      expect(service.config.engineName).to.equal(constants.secretsScannerEngineName);
    });

    it("should initialize empty hover data", () => {
      expect(service.getHoverData().size).to.equal(0);
    });

    it("should initialize empty diagnostics map", () => {
      expect(service.getDiagnosticsMap().size).to.equal(0);
    });
  });

  describe("shouldScanFile", () => {
    it("should return true for a normal source file", () => {
      const doc = { uri: makeUri("/project/src/index.js") } as any;
      expect(service.shouldScanFile(doc)).to.be.true;
    });

    it("should return false for non-file scheme", () => {
      const doc = { uri: { fsPath: "/project/src/index.js", scheme: "untitled" } } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for files inside node_modules", () => {
      const doc = { uri: makeUri("/project/node_modules/pkg/index.js") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for the checkmarx ignored file", () => {
      const doc = { uri: makeUri("/project/.vscode/.checkmarxIgnored") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for the checkmarx ignored temp list file", () => {
      const doc = { uri: makeUri("/project/.vscode/.checkmarxIgnoredTempList") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for the dev assist ignored file", () => {
      const doc = { uri: makeUri("/project/.vscode/.checkmarxDevAssistIgnored") } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });
  });

  describe("updateProblems", () => {
    it("should create a diagnostic for a detected secret", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/file.js");
      expect(diagnostics).to.exist;
      expect(diagnostics!.length).to.equal(1);
      expect(diagnostics![0].message).to.include("AWS Key");
    });

    it("should store hover data keyed by filePath and line", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret()], uri);

      const hover = service.getHoverData().get("/test/file.js:3");
      expect(hover).to.exist;
      expect(hover.title).to.equal("AWS Key");
      expect(hover.severity).to.equal("Critical");
    });

    it("should set the diagnostic source to the Cx AI source", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/file.js");
      expect(diagnostics![0].source).to.equal(constants.getCxAi());
    });

    it("should attach data payload with the secrets engine type", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret()], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/file.js");
      const data = (diagnostics![0] as any).data;
      expect(data.cxType).to.equal(constants.secretsScannerEngineName);
      expect(data.item.title).to.equal("AWS Key");
    });

    it("should skip secrets with no locations", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret({ locations: [] })], uri);

      const diagnostics = service.getDiagnosticsMap().get("/test/file.js");
      expect(diagnostics!.length).to.equal(0);
    });

    it("should handle multiple secrets across lines", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>(
        [
          makeSecret({ severity: "Critical", locations: [{ line: 1, startIndex: 0, endIndex: 10 }] }),
          makeSecret({ severity: "High", title: "Token", locations: [{ line: 5, startIndex: 0, endIndex: 8 }] }),
          makeSecret({ severity: "Medium", title: "Pwd", locations: [{ line: 9, startIndex: 0, endIndex: 6 }] }),
        ],
        uri
      );

      const diagnostics = service.getDiagnosticsMap().get("/test/file.js");
      expect(diagnostics!.length).to.equal(3);
      expect(service.getHoverData().size).to.equal(3);
    });

    it("should write diagnostics into the diagnostic collection", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret()], uri);

      expect(mockDiagnosticCollection.set.called).to.be.true;
    });

    it("should handle empty problems array", () => {
      const uri = makeUri("/test/file.js");
      expect(() => service.updateProblems<any>([], uri)).to.not.throw();
      expect(service.getDiagnosticsMap().get("/test/file.js")!.length).to.equal(0);
    });
  });

  describe("clearScanData", () => {
    it("should remove diagnostics and hover data for a file", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret()], uri);
      expect(service.getDiagnosticsMap().has("/test/file.js")).to.be.true;

      service.clearScanData(uri);

      expect(service.getDiagnosticsMap().has("/test/file.js")).to.be.false;
    });

    it("should delete from diagnostic collection", () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret()], uri);

      service.clearScanData(uri);

      expect(mockDiagnosticCollection.delete.called).to.be.true;
    });
  });

  describe("clearProblems", () => {
    it("should clear all diagnostics and decoration maps", async () => {
      const uri = makeUri("/test/file.js");
      service.updateProblems<any>([makeSecret()], uri);

      await service.clearProblems();

      expect(service.getDiagnosticsMap().size).to.equal(0);
      expect(mockDiagnosticCollection.clear.called).to.be.true;
    });
  });

  describe("getHoverData / getDiagnosticsMap", () => {
    it("should return the same hover map instance", () => {
      const a = service.getHoverData();
      const b = service.getHoverData();
      expect(a).to.equal(b);
    });

    it("should return a Map for diagnostics", () => {
      expect(service.getDiagnosticsMap()).to.be.instanceOf(Map);
    });
  });

  describe("dispose", () => {
    it("should not throw when disposing", () => {
      expect(() => service.dispose()).to.not.throw();
    });

    it("should be safe to dispose twice", () => {
      service.dispose();
      expect(() => service.dispose()).to.not.throw();
    });
  });
});
