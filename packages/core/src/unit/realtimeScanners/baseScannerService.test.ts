/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { BaseScannerService } from "../../realtimeScanners/common/baseScannerService";
import { Logs } from "../../models/logs";

// Minimal concrete subclass to exercise the abstract base class
class TestScanner extends BaseScannerService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async scan(_document: vscode.TextDocument, _logs: Logs): Promise<void> {
    // no-op
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateProblems<T = unknown>(_problems: T, _uri: vscode.Uri): void {
    // no-op
  }
}

describe("BaseScannerService", () => {
  let service: TestScanner;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new TestScanner({
      engineName: "TestEngine",
      configSection: "test.section",
      activateKey: "test.activate",
      enabledMessage: "enabled",
      disabledMessage: "disabled",
      errorMessage: "error",
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("Constructor", () => {
    it("should store the provided config", () => {
      expect(service.config.engineName).to.equal("TestEngine");
    });

    it("should create a diagnostic collection", () => {
      expect(service.diagnosticCollection).to.exist;
    });
  });

  describe("shouldScanFile", () => {
    it("should return true for a regular file", () => {
      const doc = { uri: { scheme: "file", fsPath: "/p/a.txt" } } as any;
      expect(service.shouldScanFile(doc)).to.be.true;
    });

    it("should return false for non-file scheme", () => {
      const doc = { uri: { scheme: "untitled", fsPath: "/p/a.txt" } } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should return false for node_modules files", () => {
      const doc = { uri: { scheme: "file", fsPath: "/p/node_modules/x/a.txt" } } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });

    it("should normalize windows separators when checking node_modules", () => {
      const doc = { uri: { scheme: "file", fsPath: "C:\\p\\node_modules\\x\\a.txt" } } as any;
      expect(service.shouldScanFile(doc)).to.be.false;
    });
  });

  describe("getHighestSeverity()", () => {
    it("should return Critical over High/Medium/Low", () => {
      const result = (service as any).getHighestSeverity(["Low", "High", "Critical", "Medium"]);
      expect(result).to.equal("Critical");
    });

    it("should return Malicious over everything", () => {
      const result = (service as any).getHighestSeverity(["Critical", "Malicious", "High"]);
      expect(result).to.equal("Malicious");
    });

    it("should return High when no critical/malicious present", () => {
      const result = (service as any).getHighestSeverity(["Medium", "High", "Low"]);
      expect(result).to.equal("High");
    });

    it("should return Medium over Low", () => {
      const result = (service as any).getHighestSeverity(["Low", "Medium"]);
      expect(result).to.equal("Medium");
    });

    it("should fall through to OK when only OK present", () => {
      const result = (service as any).getHighestSeverity(["OK"]);
      expect(result).to.equal("OK");
    });
  });

  describe("findActiveFileEntry()", () => {
    it("should find an active entry by normalized path", () => {
      const entry = {
        files: [
          { path: "src/a.js", active: false },
          { path: "src/b.js", active: true },
        ],
      };
      const found = (service as any).findActiveFileEntry(entry, "src/b.js");
      expect(found).to.exist;
      expect(found.path).to.equal("src/b.js");
    });

    it("should not return an inactive entry", () => {
      const entry = { files: [{ path: "src/a.js", active: false }] };
      const found = (service as any).findActiveFileEntry(entry, "src/a.js");
      expect(found).to.be.undefined;
    });

    it("should return undefined when no path matches", () => {
      const entry = { files: [{ path: "src/a.js", active: true }] };
      const found = (service as any).findActiveFileEntry(entry, "src/missing.js");
      expect(found).to.be.undefined;
    });
  });

  describe("generateFileHash()", () => {
    it("should produce a 16-character hex string", () => {
      const hash = (service as any).generateFileHash("/some/path.js");
      expect(hash).to.be.a("string");
      expect(hash).to.have.lengthOf(16);
      expect(hash).to.match(/^[0-9a-f]{16}$/);
    });

    it("should produce different hashes for different inputs", () => {
      const a = (service as any).generateFileHash("/path/one.js");
      const b = (service as any).generateFileHash("/path/two.js");
      expect(a).to.not.equal(b);
    });
  });

  describe("getTempSubFolderPath()", () => {
    it("should return a path including the base temp dir", () => {
      const doc = { uri: { fsPath: "/p/a.txt" } } as any;
      const result = (service as any).getTempSubFolderPath(doc, "myTempDir");
      expect(result).to.include("myTempDir");
    });
  });

  describe("scanner registry helpers", () => {
    it("should register and retrieve its own diagnostic collection", () => {
      const collection = (service as any).getOtherScannerCollection("TestEngine");
      expect(collection).to.exist;
    });

    it("should return undefined for an unknown engine collection", () => {
      const collection = (service as any).getOtherScannerCollection("NonExistentEngine");
      expect(collection).to.be.undefined;
    });

    it("should register and retrieve a hover data map", () => {
      const map = new Map();
      (service as any).registerHoverDataMap(map);
      const retrieved = (service as any).getOtherScannerHoverData("TestEngine");
      expect(retrieved).to.equal(map);
    });

    it("should return undefined for unknown engine hover data", () => {
      const retrieved = (service as any).getOtherScannerHoverData("UnknownEngine");
      expect(retrieved).to.be.undefined;
    });
  });

  describe("createThemeChangeHandler()", () => {
    it("should return a disposable", () => {
      const handler = (BaseScannerService as any).createThemeChangeHandler(service);
      expect(handler).to.have.property("dispose");
      expect(() => handler.dispose()).to.not.throw();
    });
  });

  describe("clearProblems()", () => {
    it("should clear the diagnostic collection", async () => {
      await service.clearProblems();
      // diagnosticCollection.clear is the mock stub
      expect((service.diagnosticCollection.clear as any).called).to.be.true;
    });
  });

  describe("dispose()", () => {
    it("should not throw when no listener is registered", () => {
      expect(() => service.dispose()).to.not.throw();
    });

    it("should dispose the editor change listener after initialize", async () => {
      await service.initializeScanner();
      expect(() => service.dispose()).to.not.throw();
    });
  });

  describe("initializeScanner()", () => {
    it("should register an editor change listener", async () => {
      await service.initializeScanner();
      expect((service as any).editorChangeListener).to.exist;
    });
  });

  describe("getFullPathWithOriginalCasing()", () => {
    it("should return undefined when the directory has no matching entry", async () => {
      const uri = { fsPath: "/some/dir/File.txt" } as any;
      const result = await service.getFullPathWithOriginalCasing(uri);
      expect(result).to.be.undefined;
    });

    it("should return the matched path with original casing", async () => {
      sandbox
        .stub(vscode.workspace.fs, "readDirectory")
        .resolves([["File.TXT", 1]] as any);
      const uri = { fsPath: "/some/dir/file.txt" } as any;
      const result = await service.getFullPathWithOriginalCasing(uri);
      expect(result).to.be.a("string");
      expect(result).to.include("File.TXT");
    });
  });

  describe("onEditorChange()", () => {
    it("should not throw when editor is undefined", () => {
      expect(() => (service as any).onEditorChange(undefined)).to.not.throw();
    });

    it("should not throw for an editor on a scannable document", () => {
      const editor = { document: { uri: { scheme: "file", fsPath: "/a.txt" } } } as any;
      expect(() => (service as any).onEditorChange(editor)).to.not.throw();
    });
  });
});
