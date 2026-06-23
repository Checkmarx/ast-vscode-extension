/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import "./mocks/vscode-mock";
import { GptResult } from "../models/gptResult";
import * as vscode from "vscode";
import * as path from "path";
import { AstResult } from "../models/results";
import { mockAstResult } from "./mocks/astResult-mock";

describe("GptResult", () => {
  const mockWorkspacePath = "/mock/workspace";

  beforeEach(() => {
    (vscode.workspace.workspaceFolders as any) = [
      {
        uri: { fsPath: mockWorkspacePath },
      },
    ];
  });

  describe("initialization with secret detection", () => {
    it("should correctly join workspace path with filename for secret detection", () => {
      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      const expectedPath = path.join(
        mockWorkspacePath,
        "/.github/workflows/main.yml"
      );
      expect(gptResult.filename).to.equal(expectedPath);
    });

    it("should initialize with secret detection result properties", () => {
      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      expect(gptResult.filename).to.exist;
      expect(gptResult.severity).to.exist;
      expect(gptResult.vulnerabilityName).to.exist;
    });

    it("should handle empty workspace folders", () => {
      (vscode.workspace.workspaceFolders as any) = undefined;

      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      expect(gptResult).to.exist;
      expect(gptResult.filename).to.be.a("string");
    });
  });

  describe("property initialization", () => {
    it("should initialize all properties", () => {
      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      expect(gptResult).to.have.property("filename");
      expect(gptResult).to.have.property("line");
      expect(gptResult).to.have.property("severity");
      expect(gptResult).to.have.property("vulnerabilityName");
      expect(gptResult).to.have.property("resultID");
    });

    it("should set filename property", () => {
      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      expect(gptResult.filename).to.be.a("string");
      expect(gptResult.filename.length).to.be.greaterThan(0);
    });

    it("should set severity property", () => {
      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      expect(gptResult.severity).to.be.a("string");
    });

    it("should set vulnerabilityName property", () => {
      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      expect(gptResult.vulnerabilityName).to.be.a("string");
    });
  });

  describe("default values", () => {
    it("should have empty string as default filename", () => {
      const gptResult = new GptResult(undefined as any, undefined);

      expect(gptResult.filename).to.equal("");
    });

    it("should have 0 as default line", () => {
      const gptResult = new GptResult(undefined as any, undefined);

      expect(gptResult.line).to.equal(0);
    });

    it("should have empty string as default severity", () => {
      const gptResult = new GptResult(undefined as any, undefined);

      expect(gptResult.severity).to.equal("");
    });

    it("should have empty string as default vulnerabilityName", () => {
      const gptResult = new GptResult(undefined as any, undefined);

      expect(gptResult.vulnerabilityName).to.equal("");
    });

    it("should have empty string as default resultID", () => {
      const gptResult = new GptResult(undefined as any, undefined);

      expect(gptResult.resultID).to.equal("");
    });
  });

  describe("workspace path handling", () => {
    it("should include workspace path when available", () => {
      (vscode.workspace.workspaceFolders as any) = [
        {
          uri: { fsPath: "/home/user/project" },
        },
      ];

      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      expect(gptResult.filename).to.include("/home/user/project");
    });

    it("should handle multiple workspace folders (use first)", () => {
      (vscode.workspace.workspaceFolders as any) = [
        {
          uri: { fsPath: "/first/workspace" },
        },
        {
          uri: { fsPath: "/second/workspace" },
        },
      ];

      const gptResult = new GptResult(mockAstResult as AstResult, undefined);

      expect(gptResult.filename).to.include("/first/workspace");
    });

    it("should handle no workspace gracefully", () => {
      (vscode.workspace.workspaceFolders as any) = null;

      expect(() => new GptResult(mockAstResult as AstResult, undefined)).to
        .not.throw();
    });
  });

  describe("error handling", () => {
    it("should handle undefined astResult gracefully", () => {
      expect(() => new GptResult(undefined as any, undefined)).to.not.throw();
    });

    it("should handle undefined kicsResult gracefully", () => {
      expect(() => new GptResult(mockAstResult as AstResult, undefined)).to
        .not.throw();
    });

    it("should handle both undefined gracefully", () => {
      expect(() => new GptResult(undefined as any, undefined)).to.not.throw();
    });

    it("should handle malformed astResult", () => {
      const malformed = { type: "unknown" } as any;

      expect(() => new GptResult(malformed, undefined)).to.not.throw();
    });
  });
});
