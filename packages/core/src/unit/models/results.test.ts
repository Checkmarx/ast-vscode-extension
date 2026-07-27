/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { AstResult } from "../../models/results";
import { constants } from "../../utils/common/constants";
import { MediaPathResolver } from "../../utils/mediaPathResolver";

describe("AstResult Model Tests", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    const stub = sandbox.stub(MediaPathResolver, "getMediaFilePath");
    stub.withArgs("icons", "critical_untoggle.svg").returns("/mock/path/critical_untoggle.svg");
    stub.withArgs("icons", "high_untoggle.svg").returns("/mock/path/high_untoggle.svg");
    stub.withArgs("icons", "medium_untoggle.svg").returns("/mock/path/medium_untoggle.svg");
    stub.withArgs("icons", "info_untoggle.svg").returns("/mock/path/info_untoggle.svg");
    stub.withArgs("icons", "low_untoggle.svg").returns("/mock/path/low_untoggle.svg");
    stub.withArgs("icons", "gpt.png").returns("/mock/path/gpt.png");
    stub.withArgs("icon.png").returns("/mock/path/icon.png");
    stub.returns("/mock/path/icon.svg");
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("Constructor - SAST Results", () => {
    it("should initialize SAST result with query name", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-1",
        status: "OPEN",
        alternateId: "alt-1",
        similarityId: "sim-1",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "SQL Injection",
        descriptionHTML: "<p>SQL Injection</p>",
        riskScore: 8.5,
        traits: { trait1: "value1" },
        data: {
          queryName: "SQL_Injection",
          languageName: "Java",
          queryId: "query-1",
          packageIdentifier: undefined,
          nodes: [
            {
              fileName: "/src/main/MyClass.java",
              line: 42,
              column: 10,
              name: "executeQuery",
              fullName: "MyClass.executeQuery",
              length: 5,
            },
          ],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      expect(result.type).to.equal(constants.sast);
      expect(result.id).to.equal("sast-1");
      expect(result.severity).to.equal("HIGH");
      expect(result.state).to.equal("CONFIRMED");
      expect(result.queryName).to.equal("SQL_Injection");
      expect(result.language).to.equal("Java");
      expect(result.label).to.include("SQL_Injection");
    });

    it("should fallback to packageIdentifier when queryName is missing", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-2",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "TO_VERIFY",
        severity: "MEDIUM",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 5.0,
        traits: {},
        data: {
          queryName: undefined,
          languageName: "Python",
          queryId: "query-2",
          packageIdentifier: "pkg-1",
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      expect(result.queryName).to.equal("pkg-1");
    });

    it("should set fileName and format label from SAST nodes", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-3",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "NOT_EXPLOITABLE",
        severity: "LOW",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 2.0,
        traits: {},
        data: {
          queryName: "Test_Issue",
          languageName: "C#",
          queryId: "query-3",
          packageIdentifier: undefined,
          nodes: [
            {
              fileName: "/path/to/file/Program.cs",
              line: 100,
              column: 5,
              name: "Main",
              fullName: "Program.Main",
              length: 10,
            },
          ],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      expect(result.fileName).to.equal("/path/to/file/Program.cs");
      expect(result.label).to.include("Test_Issue");
      expect(result.label).to.include("Program.cs");
      expect(result.label).to.include("100");
    });

    it("should assign unique IDs to SAST nodes", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-4",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "CRITICAL",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 9.8,
        traits: {},
        data: {
          queryName: "Critical_Vuln",
          languageName: "Go",
          queryId: "query-4",
          packageIdentifier: undefined,
          nodes: [
            {
              fileName: "main.go",
              line: 50,
              column: 1,
              name: "func",
              fullName: "main.func",
              length: 5,
            },
            {
              fileName: "main.go",
              line: 51,
              column: 2,
              name: "func2",
              fullName: "main.func2",
              length: 5,
            },
          ],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      expect(result.sastNodes).to.have.lengthOf(2);
      expect(result.sastNodes[0].uniqueId).to.include("Critical_Vuln");
      expect(result.sastNodes[0].uniqueId).to.include("main.go");
      expect(result.sastNodes[1].uniqueId).to.not.equal(result.sastNodes[0].uniqueId);
    });
  });

  describe("Constructor - SCA Results", () => {
    it("should initialize SCA result with scaType", () => {
      const result = new AstResult({
        type: "Dependency",
        scaType: constants.sca,
        id: "sca-1",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Vulnerable Package",
        descriptionHTML: "<p>Vulnerable Package</p>",
        riskScore: 7.5,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: "lodash@4.17.0",
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      expect(result.type).to.equal(constants.sca);
      expect(result.scaType).to.equal(constants.sca);
      expect(result.scaNode).to.exist;
    });
  });

  describe("Constructor - KICS Results", () => {
    it("should initialize KICS result", () => {
      const result = new AstResult({
        type: constants.kics,
        scaType: undefined,
        id: "kics-1",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "MEDIUM",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Security Config Issue",
        descriptionHTML: "",
        riskScore: 5.0,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: undefined,
          filename: "Dockerfile",
          line: 10,
          ruleName: "Docker Rule",
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      expect(result.type).to.equal(constants.kics);
      expect(result.kicsNode).to.exist;
    });
  });

  describe("Constructor - SCS Secret Detection Results", () => {
    it("should initialize SCS Secret Detection result", () => {
      const result = new AstResult({
        type: constants.scsSecretDetection,
        scaType: undefined,
        id: "scs-1",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "CRITICAL",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "API Key Detected",
        descriptionHTML: "",
        riskScore: 9.5,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: undefined,
          fileName: "/config/secrets.env",
          line: 5,
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      expect(result.type).to.equal(constants.scsSecretDetection);
      expect(result.secretDetectionNode).to.exist;
      expect(result.typeLabel).to.equal(constants.secretDetection);
    });
  });

  describe("setSeverity() method", () => {
    it("should update severity and kicsNode severity", () => {
      const result = new AstResult({
        type: constants.kics,
        scaType: undefined,
        id: "kics-2",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "LOW",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 0.0,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: undefined,
          filename: "test.yaml",
          line: 1,
          ruleName: "Rule",
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      result.setSeverity("CRITICAL");

      expect(result.severity).to.equal("CRITICAL");
      expect(result.kicsNode?.severity).to.equal("CRITICAL");
    });

    it("should not fail if kicsNode is undefined", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-5",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "MEDIUM",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 5.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      expect(() => result.setSeverity("HIGH")).to.not.throw();
      expect(result.severity).to.equal("HIGH");
    });
  });

  describe("setState() method", () => {
    it("should update state", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-6",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "TO_VERIFY",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      result.setState("CONFIRMED");

      expect(result.state).to.equal("CONFIRMED");
    });
  });

  describe("getIcon() method", () => {
    it("should return critical icon for CRITICAL severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-7",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.criticalSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 9.8,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getIcon();
      expect(icon).to.include("critical");
    });

    it("should return high icon for HIGH severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-8",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.highSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 8.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getIcon();
      expect(icon).to.include("high");
    });

    it("should return medium icon for MEDIUM severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-9",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.mediumSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 5.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getIcon();
      expect(icon).to.include("medium");
    });

    it("should return info icon for INFO severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-10",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.infoSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 3.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getIcon();
      expect(icon).to.include("info");
    });

    it("should return low icon for LOW severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-11",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.lowSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 1.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getIcon();
      expect(icon).to.include("low");
    });

    it("should return empty string for unknown severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-12",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "UNKNOWN",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 0.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getIcon();
      expect(icon).to.equal("");
    });
  });

  describe("getSeverityCode() method", () => {
    it("should return Error for CRITICAL severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-13",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.criticalSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 9.8,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const code = result.getSeverityCode();
      expect(code).to.equal(vscode.DiagnosticSeverity.Error);
    });

    it("should return Error for HIGH severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-14",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.highSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 8.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const code = result.getSeverityCode();
      expect(code).to.equal(vscode.DiagnosticSeverity.Error);
    });

    it("should return Warning for MEDIUM severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-15",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.mediumSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 5.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const code = result.getSeverityCode();
      expect(code).to.equal(vscode.DiagnosticSeverity.Warning);
    });

    it("should return Information for INFO severity", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-16",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.infoSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 3.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const code = result.getSeverityCode();
      expect(code).to.equal(vscode.DiagnosticSeverity.Information);
    });
  });

  describe("getSeverity() method", () => {
    it("should map CRITICAL to SeverityLevel.critical", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-17",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.criticalSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 9.8,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const severity = result.getSeverity();
      expect(severity).to.exist;
    });
  });

  describe("getState() method", () => {
    it("should map NOT_EXPLOITABLE state", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-18",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "NOT_EXPLOITABLE",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const state = result.getState();
      expect(state).to.exist;
    });

    it("should map CONFIRMED state", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-19",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const state = result.getState();
      expect(state).to.exist;
    });

    it("should return customStates for unknown state", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-20",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "UNKNOWN_STATE",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const state = result.getState();
      expect(state).to.exist;
    });
  });

  describe("getResultHash() method", () => {
    it("should return resultHash for SAST nodes", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-21",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          resultHash: "hash-sast-123",
          nodes: [
            {
              fileName: "Test.java",
              line: 10,
              column: 5,
              name: "method",
              fullName: "Test.method",
              length: 5,
            },
          ],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const hash = result.getResultHash();
      expect(hash).to.equal("hash-sast-123");
    });

    it("should return id for SCA node", () => {
      const result = new AstResult({
        type: "Dependency",
        scaType: constants.sca,
        id: "sca-hash-456",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: "pkg@1.0.0",
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const hash = result.getResultHash();
      expect(hash).to.equal("sca-hash-456");
    });

    it("should return KICS node id", () => {
      const result = new AstResult({
        type: constants.kics,
        scaType: undefined,
        id: "kics-22",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "MEDIUM",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 5.0,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: undefined,
          filename: "config.yaml",
          line: 10,
          ruleName: "Rule",
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const hash = result.getResultHash();
      expect(hash).to.equal("kics-22");
    });

    it("should return empty string if no nodes exist", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-23",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const hash = result.getResultHash();
      expect(hash).to.equal("");
    });
  });

  describe("getHtmlDetails() method", () => {
    it("should return SAST details HTML with nodes", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-24",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [
            {
              fileName: "Test.java",
              line: 10,
              column: 5,
              name: "method",
              fullName: "Test.method",
              length: 5,
            },
          ],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const html = result.getHtmlDetails(vscode.Uri.parse("file:///icon.png"));
      expect(html).to.be.a("string");
      expect(html.length).to.be.greaterThan(0);
      expect(html).to.include("Test.java");
    });
  });

  describe("formatFilenameLine() method", () => {
    it("should format filename and line when all data present", () => {
      const result = new AstResult({
        type: constants.kics,
        scaType: undefined,
        id: "kics-25",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "MEDIUM",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 5.0,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: undefined,
          filename: "docker/Dockerfile",
          line: 42,
          ruleName: "No Root User",
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const formatted = result.formatFilenameLine(result);
      expect(formatted).to.include("No Root User");
      expect(formatted).to.include("Dockerfile");
      expect(formatted).to.include("42");
    });
  });

  describe("getTreeIcon() method", () => {
    it("should return icon with light and dark paths", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-26",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: constants.highSeverity,
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 8.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getTreeIcon();
      expect(icon).to.have.property("light");
      expect(icon).to.have.property("dark");
    });
  });

  describe("getShortFilename() method", () => {
    it("should return full filename if less than 50 chars", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-27",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const short = result.getShortFilename("short.java");
      expect(short).to.equal("short.java");
    });

    it("should truncate filename if more than 50 chars", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-28",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const longPath = "a".repeat(60) + ".java";
      const short = result.getShortFilename(longPath);
      expect(short).to.include("...");
      expect(short).to.have.length.lessThan(longPath.length);
    });
  });

  describe("getTitle() method", () => {
    it("should return Attack Vector title for SAST", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-29",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [
            {
              fileName: "Test.java",
              line: 10,
              column: 5,
              name: "method",
              fullName: "Test.method",
              length: 5,
            },
          ],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const title = result.getTitle();
      expect(title).to.include("Attack Vector");
    });

    it("should return Package Data title for SCA", () => {
      const result = new AstResult({
        type: "Dependency",
        scaType: constants.sca,
        id: "sca-30",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: "pkg@1.0.0",
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const title = result.getTitle();
      expect(title).to.include("Package Data");
    });

    it("should return Location title for KICS", () => {
      const result = new AstResult({
        type: constants.kics,
        scaType: undefined,
        id: "kics-31",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "MEDIUM",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 5.0,
        traits: {},
        data: {
          queryName: undefined,
          languageName: undefined,
          queryId: undefined,
          packageIdentifier: undefined,
          filename: "config.yaml",
          line: 10,
          ruleName: "Rule",
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const title = result.getTitle();
      expect(title).to.include("Location");
    });
  });

  describe("Helper methods", () => {
    it("should provide GPT icon path", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-32",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getGptIcon();
      expect(icon).to.include("gpt");
    });

    it("should provide CX icon path", () => {
      const result = new AstResult({
        type: constants.sast,
        scaType: undefined,
        id: "sast-33",
        status: "OPEN",
        alternateId: "",
        similarityId: "",
        state: "CONFIRMED",
        severity: "HIGH",
        created: "2026-01-01",
        firstFoundAt: "2026-01-01",
        foundAt: "2026-01-02",
        firstScanId: "scan-1",
        description: "Test",
        descriptionHTML: "",
        riskScore: 7.0,
        traits: {},
        data: {
          queryName: "Test",
          languageName: "Java",
          queryId: "q1",
          packageIdentifier: undefined,
          nodes: [],
        },
        comments: [],
        vulnerabilityDetails: {},
      });

      const icon = result.getCxIcon();
      expect(icon).to.be.a("string");
    });
  });
});
