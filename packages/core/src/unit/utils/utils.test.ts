/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  getProperty,
  getNonce,
  isKicsFile,
  isSystemFile,
  getFilePath,
  getResultsFilePath,
  getScanLabel,
  getFormattedDateTime,
  getFormattedId,
  formatLabel,
  enableButton,
  disableButton,
} from "../../utils/utils";
import { constants } from "../../utils/common/constants";

describe("Utils Tests", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("getProperty() method", () => {
    it("should get single-level property", () => {
      const obj = { name: "test", value: 42 };
      const result = getProperty(obj as any, "name");
      expect(result).to.equal("test");
    });

    it("should get nested property with dot notation", () => {
      const obj = {
        user: { profile: { name: "John" } },
      };
      const result = getProperty(obj as any, "user.profile.name");
      expect(result).to.equal("John");
    });

    it("should return undefined for missing property", () => {
      const obj = { name: "test" };
      const result = getProperty(obj as any, "missing");
      expect(result).to.be.undefined;
    });

    it("should return undefined for missing nested property", () => {
      const obj = { user: { name: "John" } };
      const result = getProperty(obj as any, "user.profile.name");
      expect(result).to.be.undefined;
    });

    it("should return undefined when intermediate property is null", () => {
      const obj = { user: null };
      const result = getProperty(obj as any, "user.profile.name");
      expect(result).to.be.undefined;
    });

    it("should handle empty nested path", () => {
      const obj = { data: { value: 123 } };
      const result = getProperty(obj as any, "data");
      expect(result).to.exist;
    });
  });

  describe("getNonce() method", () => {
    it("should generate a 32-character string", () => {
      const nonce = getNonce();
      expect(nonce).to.have.lengthOf(32);
    });

    it("should contain only alphanumeric characters", () => {
      const nonce = getNonce();
      expect(nonce).to.match(/^[a-zA-Z0-9]{32}$/);
    });

    it("should generate different values on each call", () => {
      const nonce1 = getNonce();
      const nonce2 = getNonce();
      expect(nonce1).to.not.equal(nonce2);
    });

    it("should generate multiple unique nonces", () => {
      const nonces = new Set();
      for (let i = 0; i < 10; i++) {
        nonces.add(getNonce());
      }
      expect(nonces.size).to.equal(10);
    });
  });

  describe("isKicsFile() method", () => {
    it("should return true for .tf files", () => {
      const doc = {
        fileName: "main.tf",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return true for .yml files", () => {
      const doc = {
        fileName: "config.yml",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return true for .yaml files", () => {
      const doc = {
        fileName: "config.yaml",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return true for .json files", () => {
      const doc = {
        fileName: "config.json",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return true for Dockerfile", () => {
      const doc = {
        fileName: "Dockerfile",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return true for .proto files", () => {
      const doc = {
        fileName: "service.proto",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return true for .auto.tfvars files", () => {
      const doc = {
        fileName: "terraform.auto.tfvars",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return true for .terraform.tfvars files", () => {
      const doc = {
        fileName: "terraform.terraform.tfvars",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return true for .dockerfile files", () => {
      const doc = {
        fileName: "custom.dockerfile",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.true;
    });

    it("should return false for non-KICS files", () => {
      const doc = {
        fileName: "main.py",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.false;
    });

    it("should return false for .java files", () => {
      const doc = {
        fileName: "Main.java",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.false;
    });

    it("should return false for .ts files", () => {
      const doc = {
        fileName: "index.ts",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.false;
    });
  });

  describe("isSystemFile() method", () => {
    it("should return true for regular files", () => {
      const doc = {
        uri: { scheme: "file" },
        fileName: "main.java",
      } as vscode.TextDocument;
      const result = isSystemFile(doc);
      expect(result).to.be.true;
    });

    it("should return false for git scheme files", () => {
      const doc = {
        uri: { scheme: "git" },
        fileName: "main.java",
      } as vscode.TextDocument;
      const result = isSystemFile(doc);
      expect(result).to.be.false;
    });

    it("should return false for package.json", () => {
      const doc = {
        uri: { scheme: "file" },
        fileName: "/path/to/package.json",
      } as vscode.TextDocument;
      const result = isSystemFile(doc);
      expect(result).to.be.false;
    });

    it("should return false for settings.json", () => {
      const doc = {
        uri: { scheme: "file" },
        fileName: "/path/to/settings.json",
      } as vscode.TextDocument;
      const result = isSystemFile(doc);
      expect(result).to.be.false;
    });

    it("should return true for .vscode/settings.json exclusion", () => {
      const doc = {
        uri: { scheme: "file" },
        fileName: "/path/.vscode/config.json",
      } as vscode.TextDocument;
      const result = isSystemFile(doc);
      expect(result).to.be.true;
    });
  });

  describe("getFilePath() method", () => {
    it("should return a directory path", () => {
      const filePath = getFilePath();
      expect(filePath).to.be.a("string");
      expect(filePath.length).to.be.greaterThan(0);
    });
  });

  describe("getResultsFilePath() method", () => {
    it("should return results file path with correct extension", () => {
      const filePath = getResultsFilePath();
      expect(filePath).to.include(constants.resultsFileName);
      expect(filePath).to.include(constants.resultsFileExtension);
    });

    it("should end with correct file extension", () => {
      const filePath = getResultsFilePath();
      expect(filePath).to.match(new RegExp(`\\.${constants.resultsFileExtension}$`));
    });
  });

  describe("getFormattedDateTime() method", () => {
    it("should format date correctly", () => {
      const dateString = "2026-01-15T14:30:45Z";
      const result = getFormattedDateTime(dateString);
      expect(result).to.match(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it("should pad month with zero", () => {
      const dateString = "2026-01-15T14:30:45Z";
      const result = getFormattedDateTime(dateString);
      expect(result).to.include("01/15");
    });

    it("should pad day with zero", () => {
      const dateString = "2026-06-05T14:30:45Z";
      const result = getFormattedDateTime(dateString);
      expect(result).to.include("06/05");
    });

    it("should pad hours with zero for single digit hours", () => {
      const dateString = "2026-01-15T08:30:45Z";
      const result = getFormattedDateTime(dateString);
      expect(result).to.match(/\s\d{2}:\d{2}:\d{2}$/);
    });

    it("should pad minutes with zero for single digit minutes", () => {
      const dateString = "2026-01-15T14:05:45Z";
      const result = getFormattedDateTime(dateString);
      expect(result).to.match(/:\d{2}:\d{2}$/);
    });

    it("should pad seconds with zero", () => {
      const dateString = "2026-01-15T14:30:09Z";
      const result = getFormattedDateTime(dateString);
      expect(result).to.include(":09");
    });

    it("should format year correctly", () => {
      const dateString = "2026-06-15T12:30:45Z";
      const result = getFormattedDateTime(dateString);
      expect(result).to.match(/^2026\//);
    });

    it("should always return correct format with forward slashes and colons", () => {
      const dateString = "2026-03-10T09:15:30Z";
      const result = getFormattedDateTime(dateString);
      expect(result).to.match(/\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe("getScanLabel() method", () => {
    it("should combine formatted date and id", () => {
      const createdAt = "2026-01-15T14:30:45Z";
      const id = "scan-123";
      const result = getScanLabel(createdAt, id);
      expect(result).to.include("2026/01/15");
      expect(result).to.include("scan-123");
    });

    it("should include time in label in correct format", () => {
      const createdAt = "2026-01-15T14:30:45Z";
      const id = "scan-456";
      const result = getScanLabel(createdAt, id);
      expect(result).to.match(/\d{2}:\d{2}:\d{2} scan-456/);
    });

    it("should have space between date/time and id", () => {
      const createdAt = "2026-01-15T14:30:45Z";
      const id = "test-id";
      const result = getScanLabel(createdAt, id);
      expect(result).to.match(/\d{2}:\d{2}:\d{2} test-id/);
    });
  });

  describe("getFormattedId() method", () => {
    it("should append (latest) for first scan in list", () => {
      const scan1 = { id: "scan-1", createdAt: "2026-01-15T14:30:45Z" } as any;
      const scan2 = { id: "scan-2", createdAt: "2026-01-14T14:30:45Z" } as any;
      const result = getFormattedId(scan1, [scan1, scan2]);
      expect(result).to.include("scan-1");
      expect(result).to.include("(latest)");
    });

    it("should not append (latest) for non-first scan", () => {
      const scan1 = { id: "scan-1", createdAt: "2026-01-15T14:30:45Z" } as any;
      const scan2 = { id: "scan-2", createdAt: "2026-01-14T14:30:45Z" } as any;
      const result = getFormattedId(scan2, [scan1, scan2]);
      expect(result).to.equal("scan-2");
      expect(result).to.not.include("(latest)");
    });

    it("should return empty string for null scanList", () => {
      const scan = { id: "scan-1", createdAt: "2026-01-15T14:30:45Z" } as any;
      const result = getFormattedId(scan, null);
      expect(result).to.equal("");
    });

    it("should return empty string for undefined scanList", () => {
      const scan = { id: "scan-1", createdAt: "2026-01-15T14:30:45Z" } as any;
      const result = getFormattedId(scan, undefined);
      expect(result).to.equal("");
    });

    it("should return empty string for empty scanList", () => {
      const scan = { id: "scan-1", createdAt: "2026-01-15T14:30:45Z" } as any;
      const result = getFormattedId(scan, []);
      expect(result).to.equal("");
    });
  });

  describe("formatLabel() method", () => {
    it("should include formatted date and time for first scan", () => {
      const scan1 = { id: "scan-1", createdAt: "2026-01-15T14:30:45Z" } as any;
      const scan2 = { id: "scan-2", createdAt: "2026-01-14T14:30:45Z" } as any;
      const result = formatLabel(scan1, [scan1, scan2]);
      expect(result).to.match(/2026\/01\/15\s\d{2}:\d{2}:\d{2}/);
      expect(result).to.include("(latest)");
    });

    it("should not include (latest) for non-first scan", () => {
      const scan1 = { id: "scan-1", createdAt: "2026-01-15T14:30:45Z" } as any;
      const scan2 = { id: "scan-2", createdAt: "2026-01-14T14:30:45Z" } as any;
      const result = formatLabel(scan2, [scan1, scan2]);
      expect(result).to.include("2026/01/14");
      expect(result).to.not.include("(latest)");
    });

    it("should include scan id in label", () => {
      const scan1 = { id: "my-scan-123", createdAt: "2026-01-15T14:30:45Z" } as any;
      const result = formatLabel(scan1, [scan1]);
      expect(result).to.contain("my-scan-123");
    });
  });

  describe("enableButton() method", () => {
    it("should execute setContext command with true value", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      const buttonName = "test.button";

      await enableButton(buttonName);

      expect(executeCommandStub.calledWith("setContext", buttonName, true)).to.be.true;
    });

    it("should be async", () => {
      const result = enableButton("test");
      expect(result).to.have.property("then");
    });
  });

  describe("disableButton() method", () => {
    it("should execute setContext command with false value", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      const buttonName = "test.button";

      await disableButton(buttonName);

      expect(executeCommandStub.calledWith("setContext", buttonName, false)).to.be.true;
    });

    it("should be async", () => {
      const result = disableButton("test");
      expect(result).to.have.property("then");
    });
  });

  describe("Edge cases and special values", () => {
    it("getProperty should handle numeric zero value", () => {
      const obj = { count: 0, name: "test" };
      const result = getProperty(obj as any, "count");
      expect(result).to.equal(0);
    });

    it("getProperty should handle empty string value", () => {
      const obj = { name: "", id: "123" };
      const result = getProperty(obj as any, "name");
      expect(result).to.equal("");
    });

    it("isKicsFile should handle path with extension in directory name", () => {
      const doc = {
        fileName: "/path/with.tf/in/name/file.java",
      } as vscode.TextDocument;
      const result = isKicsFile(doc);
      expect(result).to.be.false;
    });

    it("formatLabel should handle multiple scans with same date", () => {
      const scan1 = { id: "scan-1", createdAt: "2026-01-15T14:30:45Z" } as any;
      const scan2 = { id: "scan-2", createdAt: "2026-01-15T14:30:45Z" } as any;
      const label1 = formatLabel(scan1, [scan1, scan2]);
      const label2 = formatLabel(scan2, [scan1, scan2]);
      expect(label1).to.include("(latest)");
      expect(label2).to.not.include("(latest)");
    });
  });
});
