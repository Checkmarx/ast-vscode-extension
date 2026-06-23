import { expect } from "chai";
import { AstResult } from "../models/results";
import * as vscode from "vscode";
import { constants } from "../utils/common/constants";

describe("AstResult", () => {
  // Mock result data builders
  const createMockSastResult = (overrides?: any) => ({
    id: "sast-123",
    type: constants.sast,
    scaType: undefined,
    status: "CONFIRMED",
    alternateId: "alt-123",
    similarityId: "sim-123",
    state: "UNCONFIRMED",
    severity: constants.highSeverity,
    created: "2024-01-01T00:00:00Z",
    firstFoundAt: "2024-01-01T00:00:00Z",
    foundAt: "2024-01-02T00:00:00Z",
    firstScanId: "scan-1",
    description: "Test vulnerability",
    descriptionHTML: "<p>Test vulnerability</p>",
    cweId: "CWE-123",
    riskScore: 7.5,
    traits: {},
    data: {
      queryName: "SQL Injection",
      languageName: "JavaScript",
      queryId: "query-123",
      packageIdentifier: undefined,
      nodes: [
        {
          fileName: "src/app.ts",
          line: 42,
          column: 10,
          controlFlowDepth: 2,
          name: "user_input",
        },
      ],
    },
    vulnerabilityDetails: {
      cveName: "CVE-2024-0001",
      cweId: "CWE-123",
    },
    comments: [],
    ...overrides,
  });

  const createMockScaResult = (overrides?: any) => ({
    id: "sca-456",
    type: "sca",
    scaType: "PACKAGE",
    status: "CONFIRMED",
    alternateId: "alt-456",
    similarityId: "sim-456",
    state: "UNCONFIRMED",
    severity: constants.criticalSeverity,
    created: "2024-01-01T00:00:00Z",
    firstFoundAt: "2024-01-01T00:00:00Z",
    foundAt: "2024-01-02T00:00:00Z",
    firstScanId: "scan-1",
    description: "Vulnerable package",
    descriptionHTML: "<p>Vulnerable package</p>",
    riskScore: 9.0,
    traits: {},
    data: {
      packageIdentifier: "lodash@4.17.20",
      languageName: "JavaScript",
      queryId: "package-query",
      vulnerableRanges: ["< 4.17.21"],
    },
    vulnerabilityDetails: {
      cveName: "CVE-2024-0002",
      cweId: "CWE-456",
    },
    comments: [],
    ...overrides,
  });

  const createMockKicsResult = (overrides?: any) => ({
    id: "kics-789",
    type: constants.kics,
    scaType: undefined,
    label: "KICS-001",
    status: "CONFIRMED",
    alternateId: "alt-789",
    similarityId: "sim-789",
    state: "UNCONFIRMED",
    severity: constants.mediumSeverity,
    created: "2024-01-01T00:00:00Z",
    firstFoundAt: "2024-01-01T00:00:00Z",
    foundAt: "2024-01-02T00:00:00Z",
    firstScanId: "scan-1",
    description: "IaC vulnerability",
    descriptionHTML: "<p>IaC vulnerability</p>",
    riskScore: 5.0,
    traits: {},
    data: {
      ruleName: "Insecure Port",
      filename: "terraform/main.tf",
      languageName: "Terraform",
      queryId: "kics-query",
      line: 10,
    },
    vulnerabilityDetails: {
      cveName: "KICS-001",
      cweId: "CWE-789",
    },
    comments: [],
    ...overrides,
  });

  describe("constructor - SAST results", () => {
    it("should initialize SAST result with all properties", () => {
      const mockData = createMockSastResult();
      const result = new AstResult(mockData);

      expect(result.id).to.equal("sast-123");
      expect(result.type).to.equal(constants.sast);
      expect(result.severity).to.equal(constants.highSeverity);
      expect(result.status).to.equal("CONFIRMED");
      expect(result.state).to.equal("UNCONFIRMED");
      expect(result.queryName).to.equal("SQL Injection");
      expect(result.language).to.equal("JavaScript");
      expect(result.description).to.equal("Test vulnerability");
    });

    it("should set label from queryName when available", () => {
      const mockData = createMockSastResult();
      const result = new AstResult(mockData);

      expect(result.label).to.include("SQL Injection");
    });

    it("should set SAST nodes from result data", () => {
      const mockData = createMockSastResult();
      const result = new AstResult(mockData);

      expect(result.sastNodes).to.have.lengthOf(1);
      expect(result.sastNodes[0].fileName).to.equal("src/app.ts");
      expect(result.sastNodes[0].line).to.equal(42);
    });

    it("should set fileName from first SAST node", () => {
      const mockData = createMockSastResult();
      const result = new AstResult(mockData);

      expect(result.fileName).to.equal("src/app.ts");
    });

    it("should assign unique IDs to SAST nodes", () => {
      const mockData = createMockSastResult({
        data: {
          ...createMockSastResult().data,
          nodes: [
            {
              fileName: "file1.ts",
              line: 10,
              column: 5,
              controlFlowDepth: 1,
              name: "var1",
            },
            {
              fileName: "file2.ts",
              line: 20,
              column: 15,
              controlFlowDepth: 2,
              name: "var2",
            },
          ],
        },
      });
      const result = new AstResult(mockData);

      expect(result.sastNodes[0].uniqueId).to.exist;
      expect(result.sastNodes[1].uniqueId).to.exist;
      expect(result.sastNodes[0].uniqueId).to.not.equal(
        result.sastNodes[1].uniqueId
      );
    });
  });

  describe("constructor - SCA results", () => {
    it("should initialize SCA result with correct type", () => {
      const mockData = createMockScaResult();
      const result = new AstResult(mockData);

      expect(result.type).to.equal(constants.sca);
      expect(result.scaType).to.equal("PACKAGE");
    });

    it("should set scaNode from result data", () => {
      const mockData = createMockScaResult();
      const result = new AstResult(mockData);

      expect(result.scaNode).to.exist;
      expect(result.scaNode?.packageIdentifier).to.equal("lodash@4.17.20");
    });

    it("should use packageIdentifier as label when queryName not available", () => {
      const mockData = createMockScaResult({
        data: {
          ...createMockScaResult().data,
          queryName: undefined,
        },
      });
      const result = new AstResult(mockData);

      expect(result.label).to.include("lodash@4.17.20");
    });
  });

  describe("constructor - KICS results", () => {
    it("should initialize KICS result", () => {
      const mockData = createMockKicsResult();
      const result = new AstResult(mockData);

      expect(result.type).to.equal(constants.kics);
      expect(result.kicsNode).to.exist;
    });

    it("should set fileName from KICS data", () => {
      const mockData = createMockKicsResult();
      const result = new AstResult(mockData);

      expect(result.fileName).to.include("terraform");
    });
  });

  describe("setSeverity", () => {
    it("should update severity", () => {
      const result = new AstResult(createMockSastResult());
      expect(result.severity).to.equal(constants.highSeverity);

      result.setSeverity(constants.criticalSeverity);
      expect(result.severity).to.equal(constants.criticalSeverity);
    });

    it("should update KICS node severity when present", () => {
      const result = new AstResult(createMockKicsResult());
      const originalSeverity = result.severity;

      result.setSeverity(constants.lowSeverity);

      expect(result.severity).to.equal(constants.lowSeverity);
      expect(result.kicsNode?.severity).to.equal(constants.lowSeverity);
    });

    it("should not affect SAST results without KICS node", () => {
      const result = new AstResult(createMockSastResult());
      expect(result.kicsNode).to.be.undefined;

      result.setSeverity(constants.lowSeverity);
      expect(result.severity).to.equal(constants.lowSeverity);
    });
  });

  describe("setState", () => {
    it("should update state", () => {
      const result = new AstResult(createMockSastResult());
      result.setState("CONFIRMED");

      expect(result.state).to.equal("CONFIRMED");
    });

    it("should accept various state values", () => {
      const result = new AstResult(createMockSastResult());

      result.setState("UNCONFIRMED");
      expect(result.state).to.equal("UNCONFIRMED");

      result.setState("IGNORED");
      expect(result.state).to.equal("IGNORED");

      result.setState("NOT_EXPLOITABLE");
      expect(result.state).to.equal("NOT_EXPLOITABLE");
    });
  });

  describe("formatFilenameLine", () => {
    it("should format filename with line and rule name", () => {
      const result = new AstResult(createMockKicsResult());
      const formatted = result.formatFilenameLine({
        data: {
          filename: "path/to/file.tf",
          line: 42,
          ruleName: "InsecurePort",
        },
      });

      expect(formatted).to.include("InsecurePort");
      expect(formatted).to.include("file.tf");
      expect(formatted).to.include("42");
    });

    it("should return undefined when missing required fields", () => {
      const result = new AstResult(createMockSastResult());

      expect(
        result.formatFilenameLine({
          data: {
            ruleName: "Rule",
            // missing filename and line
          },
        })
      ).to.be.undefined;

      expect(
        result.formatFilenameLine({
          data: {
            filename: "file.js",
            ruleName: "Rule",
            // missing line
          },
        })
      ).to.be.undefined;
    });

    it("should return undefined when data is missing", () => {
      const result = new AstResult(createMockSastResult());
      expect(result.formatFilenameLine({})).to.be.undefined;
    });

    it("should extract filename from path", () => {
      const result = new AstResult(createMockKicsResult());
      const formatted = result.formatFilenameLine({
        data: {
          filename: "deep/nested/path/to/config.yaml",
          line: 10,
          ruleName: "ConfigVulnerability",
        },
      });

      expect(formatted).to.include("config.yaml");
      expect(formatted).to.not.include("deep/nested");
    });
  });

  describe("determineTypeLabel", () => {
    it("should return label from result when provided", () => {
      const result = new AstResult(
        createMockSastResult({
          label: "Custom Label",
        })
      );
      const label = result.determineTypeLabel({
        label: "Custom Label",
      });

      expect(label).to.equal("Custom Label");
    });

    it("should return secretDetection label for SCS type", () => {
      const result = new AstResult(createMockSastResult());
      const label = result.determineTypeLabel({
        type: constants.scsSecretDetection,
      });

      expect(label).to.equal(constants.secretDetection);
    });

    it("should return undefined for other types without label", () => {
      const result = new AstResult(createMockSastResult());
      const label = result.determineTypeLabel({
        type: constants.sast,
      });

      expect(label).to.be.undefined;
    });
  });

  describe("getIcon", () => {
    it("should return critical icon for critical severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.criticalSeverity);
      const icon = result.getIcon();

      expect(icon).to.include("critical");
    });

    it("should return high icon for high severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.highSeverity);
      const icon = result.getIcon();

      expect(icon).to.include("high");
    });

    it("should return medium icon for medium severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.mediumSeverity);
      const icon = result.getIcon();

      expect(icon).to.include("medium");
    });

    it("should return low icon for low severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.lowSeverity);
      const icon = result.getIcon();

      expect(icon).to.include("low");
    });

    it("should return info icon for info severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.infoSeverity);
      const icon = result.getIcon();

      expect(icon).to.include("info");
    });

    it("should return empty string for unknown severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity("UNKNOWN");
      const icon = result.getIcon();

      expect(icon).to.equal("");
    });
  });

  describe("getSeverityCode", () => {
    it("should return Error for critical severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.criticalSeverity);
      const code = result.getSeverityCode();

      expect(code).to.equal(vscode.DiagnosticSeverity.Error);
    });

    it("should return Error for high severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.highSeverity);
      const code = result.getSeverityCode();

      expect(code).to.equal(vscode.DiagnosticSeverity.Error);
    });

    it("should return Warning for medium severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.mediumSeverity);
      const code = result.getSeverityCode();

      expect(code).to.equal(vscode.DiagnosticSeverity.Warning);
    });

    it("should return Information for low severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.lowSeverity);
      const code = result.getSeverityCode();

      expect(code).to.equal(vscode.DiagnosticSeverity.Information);
    });

    it("should return Information for info severity", () => {
      const result = new AstResult(createMockSastResult());
      result.setSeverity(constants.infoSeverity);
      const code = result.getSeverityCode();

      expect(code).to.equal(vscode.DiagnosticSeverity.Information);
    });
  });

  describe("icon getters", () => {
    it("should return GPT icon path", () => {
      const result = new AstResult(createMockSastResult());
      const icon = result.getGptIcon();

      expect(icon).to.exist;
      expect(icon).to.include("gpt.png");
    });

    it("should return CX icon path", () => {
      const result = new AstResult(createMockSastResult());
      const icon = result.getCxIcon();

      expect(icon).to.exist;
      expect(icon).to.include("icon.png");
    });

    it("should return tree icon object with light and dark variants", () => {
      const result = new AstResult(createMockSastResult());
      const treeIcon = result.getTreeIcon();

      expect(treeIcon).to.have.property("light");
      expect(treeIcon).to.have.property("dark");
      expect(treeIcon.light).to.be.instanceof(vscode.Uri);
      expect(treeIcon.dark).to.be.instanceof(vscode.Uri);
    });

    it("should return SCA-related icon paths", () => {
      const result = new AstResult(createMockSastResult());

      expect(result.getCxScaAtackVector()).to.include("attackVector.png");
      expect(result.getCxScaComplexity()).to.include("complexity.png");
      expect(result.getCxAuthentication()).to.include("authentication.png");
      expect(result.getCxConfidentiality()).to.include("confidentiality.png");
      expect(result.getCxIntegrity()).to.include("integrity.png");
      expect(result.getCxAvailability()).to.include("availability.png");
      expect(result.getCxUpgrade()).to.include("upgrade.png");
      expect(result.getCxUrl()).to.include("url.png");
    });
  });

  describe("edge cases", () => {
    it("should handle result with missing description", () => {
      const mockData = createMockSastResult({
        description: undefined,
        descriptionHTML: undefined,
      });
      const result = new AstResult(mockData);

      expect(result.description).to.be.undefined;
      expect(result.descriptionHTML).to.be.undefined;
    });

    it("should handle result with empty CWE ID", () => {
      const mockData = createMockSastResult({
        cweId: undefined,
        vulnerabilityDetails: { cveName: "CVE-123" },
      });
      const result = new AstResult(mockData);

      expect(result.cweId).to.be.undefined;
    });

    it("should handle result with missing nodes", () => {
      const mockData = createMockSastResult({
        data: {
          ...createMockSastResult().data,
          nodes: [],
        },
      });
      const result = new AstResult(mockData);

      expect(result.sastNodes).to.be.empty;
      expect(result.fileName).to.equal("");
    });

    it("should use fallback label when queryName not available", () => {
      const mockData = createMockSastResult({
        id: "fallback-id",
        data: {
          ...createMockSastResult().data,
          queryName: undefined,
        },
      });
      const result = new AstResult(mockData);

      expect(result.label).to.include("fallback-id");
    });
  });
});
