import "./mocks/vscode-mock";
import { expect } from "chai";
import sinon from "sinon";
import * as vscode from "vscode";
import { KicsDiagnostic } from "../kics/kicsDiagnostic";
import { KicsRealtime } from "../models/kicsRealtime";
import { constants } from "../utils/common/constants";

describe("KicsDiagnostic", () => {
  let mockKicsResult: Partial<KicsRealtime>;

  beforeEach(() => {
    mockKicsResult = {
      category: "Supply-chain",
      description: "Ensure container image has a tag",
      query_id: "CKV_K8S_1",
      query_name: "Ensure container image has a tag",
      query_url: "https://example.com",
      severity: "HIGH",
      platform: "kubernetes",
      files: [
        {
          actual_value: "nginx",
          expected_value: "nginx:latest",
          file_name: [{ path: "k8s/deployment.yaml" }],
          issue_type: "MissingAttribute",
          line: 42,
          remediation: "Add image tag",
          remediation_type: "inline",
          search_key: "spec.containers[].image",
          search_line: 42,
          search_value: "nginx",
          similarity_id: "abc123"
        } as any,
      ],
    };
  });

  describe("constructor", () => {
    it("should initialize with range, message, and kicsResult", () => {
      const range = new vscode.Range(
        new vscode.Position(41, 0),
        new vscode.Position(42, 10)
      );
      const message = "Image tag missing";

      const diagnostic = new KicsDiagnostic(
        range,
        message,
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.range).to.deep.equal(range);
      expect(diagnostic.message).to.equal(message);
      expect(diagnostic.kicsResult).to.deep.equal(mockKicsResult);
    });

    it("should store kicsResult property", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Test message",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.kicsResult).to.exist;
      expect(diagnostic.kicsResult.query_id).to.equal("CKV_K8S_1");
      expect(diagnostic.kicsResult.query_name).to.equal(
        "Ensure container image has a tag"
      );
    });

    it("should accept optional severity parameter", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );
      const severity = vscode.DiagnosticSeverity.Warning;

      const diagnostic = new KicsDiagnostic(
        range,
        "Warning message",
        mockKicsResult as KicsRealtime,
        severity
      );

      expect(diagnostic.severity).to.equal(severity);
    });

    it("should set severity to default when not provided", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Message",
        mockKicsResult as KicsRealtime
      );

      // When severity is not provided, it defaults to undefined in vscode.Diagnostic
      expect(diagnostic.severity).to.be.undefined;
    });
  });

  describe("range handling", () => {
    it("should handle single-line range", () => {
      const range = new vscode.Range(
        new vscode.Position(10, 0),
        new vscode.Position(10, 50)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Single line issue",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.range.start.line).to.equal(10);
      expect(diagnostic.range.end.line).to.equal(10);
    });

    it("should handle multi-line range", () => {
      const range = new vscode.Range(
        new vscode.Position(5, 0),
        new vscode.Position(15, 30)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Multi-line issue",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.range.start.line).to.equal(5);
      expect(diagnostic.range.end.line).to.equal(15);
    });

    it("should handle range at beginning of file", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(0, 10)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "First line issue",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.range.start.line).to.equal(0);
      expect(diagnostic.range.start.character).to.equal(0);
    });

    it("should handle range with large line numbers", () => {
      const range = new vscode.Range(
        new vscode.Position(1000, 0),
        new vscode.Position(1005, 50)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Far down in file",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.range.start.line).to.equal(1000);
    });
  });

  describe("message handling", () => {
    it("should store message text", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );
      const message = "Image must have explicit tag";

      const diagnostic = new KicsDiagnostic(
        range,
        message,
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.message).to.equal(message);
    });

    it("should handle empty message", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.message).to.equal("");
    });

    it("should handle long message", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );
      const longMessage = "A".repeat(1000);

      const diagnostic = new KicsDiagnostic(
        range,
        longMessage,
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.message).to.equal(longMessage);
    });

    it("should handle message with special characters", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );
      const message = "Issue: [ERROR] $pecial <chars> & \"quotes\"";

      const diagnostic = new KicsDiagnostic(
        range,
        message,
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.message).to.equal(message);
    });
  });

  describe("severity levels", () => {
    it("should set severity to Error", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Critical issue",
        mockKicsResult as KicsRealtime,
        vscode.DiagnosticSeverity.Error
      );

      expect(diagnostic.severity).to.equal(vscode.DiagnosticSeverity.Error);
    });

    it("should set severity to Warning", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Warning issue",
        mockKicsResult as KicsRealtime,
        vscode.DiagnosticSeverity.Warning
      );

      expect(diagnostic.severity).to.equal(vscode.DiagnosticSeverity.Warning);
    });

    it("should set severity to Information", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Info issue",
        mockKicsResult as KicsRealtime,
        vscode.DiagnosticSeverity.Information
      );

      expect(diagnostic.severity).to.equal(
        vscode.DiagnosticSeverity.Information
      );
    });

    it("should set severity to Hint", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Hint issue",
        mockKicsResult as KicsRealtime,
        vscode.DiagnosticSeverity.Hint
      );

      expect(diagnostic.severity).to.equal(vscode.DiagnosticSeverity.Hint);
    });
  });

  describe("kicsResult variations", () => {
    it("should handle result with minimal data", () => {
      const minimalResult: Partial<KicsRealtime> = {
        query_id: "CKV_1",
      };

      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Issue",
        minimalResult as KicsRealtime
      );

      expect(diagnostic.kicsResult.query_id).to.equal("CKV_1");
    });

    it("should handle result with complex data", () => {
      const complexResult: Partial<KicsRealtime> = {
        query_id: "CKV_K8S_1",
        query_name: "Query Name",
        severity: "HIGH",
        files: [
          {
            file_name: [{ path: "file1.yaml" }] as any,
            line: 10,
          },
          {
            file_name: [{ path: "file2.yaml" }] as any,
            line: 20,
          },
        ] as any,
        custom_data: {
          key: "value",
        },
      } as any;

      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Issue",
        complexResult as KicsRealtime
      );

      expect(diagnostic.kicsResult.files).to.have.lengthOf(2);
    });

    it("should preserve kicsResult reference", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Issue",
        mockKicsResult as KicsRealtime
      );

      // Verify the exact reference is stored
      expect(diagnostic.kicsResult === mockKicsResult).to.be.true;
    });
  });

  describe("inheritance from vscode.Diagnostic", () => {
    it("should inherit from vscode.Diagnostic", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Issue",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic).to.be.instanceof(vscode.Diagnostic);
    });

    it("should have all vscode.Diagnostic properties", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Issue",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic).to.have.property("range");
      expect(diagnostic).to.have.property("message");
      expect(diagnostic).to.have.property("severity");
      expect(diagnostic).to.have.property("source");
      expect(diagnostic).to.have.property("code");
      expect(diagnostic).to.have.property("relatedInformation");
    });

    it("should allow setting additional vscode.Diagnostic properties", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Issue",
        mockKicsResult as KicsRealtime
      );

      diagnostic.source = "KICS";
      diagnostic.code = "CKV_K8S_1";

      expect(diagnostic.source).to.equal("KICS");
      expect(diagnostic.code).to.equal("CKV_K8S_1");
    });
  });

  describe("edge cases", () => {
    it("should handle null kicsResult gracefully if allowed", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(1, 0)
      );

      // This tests that the constructor accepts the parameter
      // Real usage should always provide a valid kicsResult
      const diagnostic = new KicsDiagnostic(range, "Issue", null as any);

      expect(diagnostic.kicsResult).to.be.null;
    });

    it("should work with Position at exact column boundaries", () => {
      const range = new vscode.Range(
        new vscode.Position(5, 0),
        new vscode.Position(5, 0)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Zero-width range",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.range.isEmpty).to.be.true;
    });

    it("should work with very large character positions", () => {
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(0, 10000)
      );

      const diagnostic = new KicsDiagnostic(
        range,
        "Very long line",
        mockKicsResult as KicsRealtime
      );

      expect(diagnostic.range.end.character).to.equal(10000);
    });
  });
});
