/* eslint-disable @typescript-eslint/no-explicit-any */
import "../../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { IgnoreFileManager } from "../../../realtimeScanners/common/ignoreFileManager";
import { constants } from "../../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../../config/extensionConfig";

// Use the CommonJS `fs` object (same instance the product's `require("fs")`
// resolves to). Its properties are writable/configurable, unlike the frozen
// ts-node ESM star-namespace produced by `import * as fs from "fs"`. We replace
// individual methods directly and restore them in afterEach.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs: any = require("fs");

describe("IgnoreFileManager", () => {
  let sandbox: sinon.SinonSandbox;
  let manager: IgnoreFileManager;

  // In-memory store that fs reads/writes are wired to.
  let ignoreFileContent: string;
  let lastWrites: Record<string, string>;

  const WORKSPACE = "/workspace";
  let fsOriginals: Record<string, any>;

  // Helpers to read back what was written to a given file path (by basename match).
  const readWrittenByName = (substr: string): any => {
    const key = Object.keys(lastWrites).find((k) => k.includes(substr));
    return key ? JSON.parse(lastWrites[key]) : undefined;
  };

  const setIgnoreData = (data: any) => {
    ignoreFileContent = JSON.stringify(data);
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });

    ignoreFileContent = JSON.stringify({});
    lastWrites = {};

    // Reset singleton instance between tests so state does not leak.
    (IgnoreFileManager as any).instance = undefined;

    // Save & replace fs methods directly (frozen-namespace-safe).
    fsOriginals = {
      existsSync: fs.existsSync,
      mkdirSync: fs.mkdirSync,
      watch: fs.watch,
      readFileSync: fs.readFileSync,
      writeFileSync: fs.writeFileSync,
    };

    fs.existsSync = sandbox.stub().returns(true);
    fs.mkdirSync = sandbox.stub().returns(undefined);
    fs.watch = sandbox.stub().returns({ close() {} });
    fs.readFileSync = sandbox.stub().callsFake((p: any) => {
      const ps = String(p);
      if (ps.includes("TempList")) {
        return lastWrites[ps] ?? "[]";
      }
      // ignore file
      return ignoreFileContent;
    });
    fs.writeFileSync = sandbox.stub().callsFake((p: any, content: any) => {
      const ps = String(p);
      lastWrites[ps] = String(content);
      // Keep the ignore file content in sync so subsequent loadIgnoreData reads it.
      if (!ps.includes("TempList")) {
        ignoreFileContent = String(content);
      }
    });

    (vscode.workspace as any).textDocuments = [];

    manager = IgnoreFileManager.getInstance();
    manager.initialize({ uri: { fsPath: WORKSPACE } } as any);
  });

  afterEach(() => {
    // Restore original fs methods so other test files are unaffected.
    if (fsOriginals) {
      Object.assign(fs, fsOriginals);
    }
    resetExtensionConfig();
    sandbox.restore();
  });

  describe("getInstance", () => {
    it("returns a singleton", () => {
      expect(IgnoreFileManager.getInstance()).to.equal(manager);
    });
  });

  describe("hasIgnoreFile / getIgnoredPackagesCount", () => {
    it("hasIgnoreFile returns true when file exists", () => {
      expect(manager.hasIgnoreFile()).to.be.true;
    });

    it("getIgnoredPackagesCount returns 0 for empty data", () => {
      expect(manager.getIgnoredPackagesCount()).to.equal(0);
    });

    it("getIgnoredPackagesData returns the in-memory object", () => {
      expect(manager.getIgnoredPackagesData()).to.deep.equal({});
    });
  });

  describe("addIgnoredEntry (OSS)", () => {
    it("creates a new oss entry and writes both files", () => {
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
        line: 5,
        severity: "Critical",
        description: "desc",
        dateAdded: "2026-01-01",
      });

      const data = readWrittenByName(".checkmarxIgnored");
      const key = "npm:lodash:4.17.0";
      expect(data[key]).to.exist;
      expect(data[key].type).to.equal(constants.ossRealtimeScannerEngineName);
      expect(data[key].files[0].path).to.equal("package.json");
      expect(data[key].files[0].active).to.be.true;
      expect(data[key].files[0].line).to.equal(5);

      const temp = readWrittenByName("TempList");
      expect(temp.some((t: any) => t.PackageName === "lodash")).to.be.true;
    });

    it("updates severity/description on an existing entry and toggles existing file active", () => {
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
        line: 5,
      });
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
        line: 5,
        severity: "High",
        description: "updated",
      });

      const data = readWrittenByName(".checkmarxIgnored");
      const key = "npm:lodash:4.17.0";
      expect(data[key].severity).to.equal("High");
      expect(data[key].description).to.equal("updated");
      // same path+line -> existing branch, no duplicate
      expect(data[key].files.length).to.equal(1);
    });

    it("adds a second file entry with a different line", () => {
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
        line: 5,
      });
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
        line: 9,
      });
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["npm:lodash:4.17.0"].files.length).to.equal(2);
    });
  });

  describe("addIgnoredEntrySecrets", () => {
    it("creates a new secret entry with line+1", () => {
      manager.addIgnoredEntrySecrets({
        title: "AWS Key",
        description: "d",
        severity: "High",
        dateAdded: "2026-01-01",
        line: 10,
        secretValue: "abc123",
        filePath: `${WORKSPACE}/config.yml`,
      });

      const data = readWrittenByName(".checkmarxIgnored");
      const key = "AWS Key:abc123:config.yml";
      expect(data[key]).to.exist;
      expect(data[key].type).to.equal(constants.secretsScannerEngineName);
      expect(data[key].files[0].line).to.equal(11);
      expect(data[key].secretValue).to.equal("abc123");
    });

    it("reactivates existing file entry on second call", () => {
      const entry = {
        title: "AWS Key",
        description: "d",
        severity: "High",
        dateAdded: "2026-01-01",
        line: 10,
        secretValue: "abc123",
        filePath: `${WORKSPACE}/config.yml`,
      };
      manager.addIgnoredEntrySecrets(entry);
      manager.addIgnoredEntrySecrets({ ...entry, severity: "Low" });
      const data = readWrittenByName(".checkmarxIgnored");
      const key = "AWS Key:abc123:config.yml";
      expect(data[key].files.length).to.equal(1);
      expect(data[key].severity).to.equal("Low");
    });
  });

  describe("addIgnoredEntryIac", () => {
    it("creates a new iac entry", () => {
      manager.addIgnoredEntryIac({
        title: "Open Port",
        similarityId: "sim1",
        filePath: `${WORKSPACE}/main.tf`,
        line: 3,
        severity: "Medium",
        description: "d",
      });
      const data = readWrittenByName(".checkmarxIgnored");
      const key = "Open Port:sim1:main.tf";
      expect(data[key].type).to.equal(constants.iacRealtimeScannerEngineName);
      expect(data[key].similarityId).to.equal("sim1");
      expect(data[key].files[0].line).to.equal(4);
    });

    it("reactivates and updates an existing iac entry", () => {
      const e = {
        title: "Open Port",
        similarityId: "sim1",
        filePath: `${WORKSPACE}/main.tf`,
        line: 3,
      };
      manager.addIgnoredEntryIac(e);
      manager.addIgnoredEntryIac({ ...e, severity: "High", description: "x" });
      const data = readWrittenByName(".checkmarxIgnored");
      const key = "Open Port:sim1:main.tf";
      expect(data[key].severity).to.equal("High");
      expect(data[key].files.length).to.equal(1);
    });
  });

  describe("addIgnoredEntryAsca", () => {
    it("creates a new asca entry", () => {
      manager.addIgnoredEntryAsca({
        ruleName: "RuleX",
        ruleId: 42,
        filePath: `${WORKSPACE}/app.py`,
        line: 7,
        severity: "Low",
      });
      const data = readWrittenByName(".checkmarxIgnored");
      const key = "RuleX:42:app.py";
      expect(data[key].type).to.equal(constants.ascaRealtimeScannerEngineName);
      expect(data[key].ruleId).to.equal(42);
      expect(data[key].files[0].line).to.equal(8);
    });

    it("reactivates an existing asca entry", () => {
      const e = { ruleName: "RuleX", ruleId: 42, filePath: `${WORKSPACE}/app.py`, line: 7 };
      manager.addIgnoredEntryAsca(e);
      manager.addIgnoredEntryAsca({ ...e, severity: "Critical", description: "d" });
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["RuleX:42:app.py"].severity).to.equal("Critical");
    });
  });

  describe("addIgnoredEntryContainers", () => {
    it("creates a new container entry", () => {
      manager.addIgnoredEntryContainers({
        imageName: "nginx",
        imageTag: "1.0",
        filePath: `${WORKSPACE}/Dockerfile`,
        line: 1,
        severity: "High",
      });
      const data = readWrittenByName(".checkmarxIgnored");
      const key = "nginx:1.0";
      expect(data[key].type).to.equal(constants.containersRealtimeScannerEngineName);
      expect(data[key].imageName).to.equal("nginx");
      expect(data[key].files[0].line).to.equal(1);

      const temp = readWrittenByName("TempList");
      expect(temp.some((t: any) => t.ImageName === "nginx" && t.ImageTag === "1.0")).to.be.true;
    });

    it("reactivates an existing container entry", () => {
      const e = { imageName: "nginx", imageTag: "1.0", filePath: `${WORKSPACE}/Dockerfile`, line: 1 };
      manager.addIgnoredEntryContainers(e);
      manager.addIgnoredEntryContainers({ ...e, severity: "Low", description: "d" });
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["nginx:1.0"].severity).to.equal("Low");
      expect(data["nginx:1.0"].files.length).to.equal(1);
    });
  });

  describe("isPackageIgnored", () => {
    it("returns false when no entry exists", () => {
      expect(manager.isPackageIgnored("lodash", "4.17.0", `${WORKSPACE}/package.json`, "npm")).to.be.false;
    });

    it("returns truthy when an active oss entry exists (with manager)", () => {
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
      });
      expect(manager.isPackageIgnored("lodash", "4.17.0", `${WORKSPACE}/package.json`, "npm")).to.be.ok;
    });

    it("uses the no-manager key form", () => {
      setIgnoreData({
        "lodash:4.17.0": {
          files: [{ path: "package.json", active: true }],
          type: constants.ossRealtimeScannerEngineName,
          PackageName: "lodash",
        },
      });
      (manager as any).loadIgnoreData();
      expect(manager.isPackageIgnored("lodash", "4.17.0", `${WORKSPACE}/package.json`)).to.be.ok;
    });
  });

  describe("isSecretIgnored", () => {
    it("returns false when no entry exists", () => {
      expect(manager.isSecretIgnored("AWS Key", "abc", `${WORKSPACE}/config.yml`)).to.be.false;
    });

    it("returns truthy when active secret entry exists", () => {
      manager.addIgnoredEntrySecrets({
        title: "AWS Key",
        description: "d",
        severity: "High",
        dateAdded: "2026-01-01",
        line: 0,
        secretValue: "abc",
        filePath: `${WORKSPACE}/config.yml`,
      });
      expect(manager.isSecretIgnored("AWS Key", "abc", `${WORKSPACE}/config.yml`)).to.be.ok;
    });
  });

  describe("revivePackage", () => {
    it("returns false when package missing", () => {
      expect(manager.revivePackage("missing:key")).to.be.false;
    });

    it("deactivates all files and returns true", () => {
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
      });
      expect(manager.revivePackage("npm:lodash:4.17.0")).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["npm:lodash:4.17.0"].files.every((f: any) => f.active === false)).to.be.true;
    });
  });

  describe("updatePackageLineNumber", () => {
    it("returns false when package missing", () => {
      expect(manager.updatePackageLineNumber("missing", `${WORKSPACE}/package.json`, 9)).to.be.false;
    });

    it("updates the line of an active file and returns true", () => {
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
        line: 1,
      });
      expect(manager.updatePackageLineNumber("npm:lodash:4.17.0", `${WORKSPACE}/package.json`, 22)).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["npm:lodash:4.17.0"].files[0].line).to.equal(22);
    });

    it("returns false when no matching active file", () => {
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
      });
      manager.revivePackage("npm:lodash:4.17.0"); // sets inactive
      expect(manager.updatePackageLineNumber("npm:lodash:4.17.0", `${WORKSPACE}/package.json`, 5)).to.be.false;
    });
  });

  describe("updateSecretLineNumber", () => {
    it("returns false when key missing", () => {
      expect(manager.updateSecretLineNumber("missing", `${WORKSPACE}/config.yml`, 4)).to.be.false;
    });

    it("updates an active secret line and returns true", () => {
      manager.addIgnoredEntrySecrets({
        title: "AWS Key",
        description: "d",
        severity: "High",
        dateAdded: "2026-01-01",
        line: 0,
        secretValue: "abc",
        filePath: `${WORKSPACE}/config.yml`,
      });
      const key = "AWS Key:abc:config.yml";
      expect(manager.updateSecretLineNumber(key, `${WORKSPACE}/config.yml`, 33)).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data[key].files[0].line).to.equal(33);
    });
  });

  describe("removePackageEntry", () => {
    it("removes the file entry and deletes empty package", () => {
      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
      });
      expect(manager.removePackageEntry("npm:lodash:4.17.0", "package.json")).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["npm:lodash:4.17.0"]).to.be.undefined;
    });

    it("returns true even when package does not exist (early return path)", () => {
      expect(manager.removePackageEntry("missing", "package.json")).to.be.true;
    });
  });

  describe("cleanupObsoletePackagesForFile", () => {
    it("deactivates packages no longer in scan results", () => {
      setIgnoreData({
        "lodash:4.17.0": {
          files: [{ path: "package.json", active: true }],
          type: constants.ossRealtimeScannerEngineName,
          PackageName: "lodash",
        },
      });
      (manager as any).loadIgnoreData();

      const changed = manager.cleanupObsoletePackagesForFile(`${WORKSPACE}/package.json`, [
        { packageName: "other", version: "1.0.0" },
      ]);
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["lodash:4.17.0"].files[0].active).to.be.false;
    });

    it("returns false when nothing to deactivate", () => {
      setIgnoreData({
        "lodash:4.17.0": {
          files: [{ path: "package.json", active: true }],
          type: constants.ossRealtimeScannerEngineName,
          PackageName: "lodash",
        },
      });
      (manager as any).loadIgnoreData();
      const changed = manager.cleanupObsoletePackagesForFile(`${WORKSPACE}/package.json`, [
        { packageName: "lodash", version: "4.17.0" },
      ]);
      expect(changed).to.be.false;
    });
  });

  describe("updateTempList", () => {
    it("skips entries with no active files and dedupes by type", () => {
      setIgnoreData({
        "npm:a:1": {
          files: [{ path: "package.json", active: false }],
          type: constants.ossRealtimeScannerEngineName,
          PackageManager: "npm",
          PackageName: "a",
          PackageVersion: "1",
        },
        "npm:b:2": {
          files: [{ path: "package.json", active: true }],
          type: constants.ossRealtimeScannerEngineName,
          PackageManager: "npm",
          PackageName: "b",
          PackageVersion: "2",
        },
        "Title:sim:main.tf": {
          files: [{ path: "main.tf", active: true, line: 4 }],
          type: constants.iacRealtimeScannerEngineName,
          PackageName: "Title",
          similarityId: "sim",
        },
        "RuleX:9:app.py": {
          files: [{ path: "app.py", active: true, line: 3 }],
          type: constants.ascaRealtimeScannerEngineName,
          PackageName: "RuleX",
          ruleId: 9,
        },
      });
      (manager as any).loadIgnoreData();
      manager.updateTempList();
      const temp = readWrittenByName("TempList");
      const names = temp.map((t: any) => t.PackageName || t.Title || t.RuleID);
      expect(names).to.include("b");
      expect(names).to.not.include("a");
      expect(temp.some((t: any) => t.Title === "Title" && t.SimilarityID === "sim")).to.be.true;
      expect(temp.some((t: any) => t.RuleID === 9 && t.FileName === "app.py")).to.be.true;
    });

    it("uses scannedFileMap for asca FileName when set", () => {
      manager.setScannedFilePath(`${WORKSPACE}/app.py`, "/tmp/scanned-app.py");
      setIgnoreData({
        "RuleX:9:app.py": {
          files: [{ path: "app.py", active: true, line: 3 }],
          type: constants.ascaRealtimeScannerEngineName,
          PackageName: "RuleX",
          ruleId: 9,
        },
      });
      (manager as any).loadIgnoreData();
      manager.updateTempList();
      const temp = readWrittenByName("TempList");
      expect(temp[0].FileName).to.equal("scanned-app.py");
    });
  });

  describe("removeMissingSecrets", () => {
    it("deactivates a secret no longer present and updates line when present", () => {
      setIgnoreData({
        "AWS Key:abc:config.yml": {
          files: [{ path: "config.yml", active: true, line: 5 }],
          type: constants.secretsScannerEngineName,
          PackageName: "AWS Key",
          secretValue: "abc",
        },
      });
      (manager as any).loadIgnoreData();
      // Empty results -> secret missing -> single file -> deleted
      const changed = manager.removeMissingSecrets([] as any, `${WORKSPACE}/config.yml`);
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["AWS Key:abc:config.yml"]).to.be.undefined;
    });

    it("updates line when secret still present", () => {
      setIgnoreData({
        "AWS Key:abc:config.yml": {
          files: [{ path: "config.yml", active: true, line: 5 }],
          type: constants.secretsScannerEngineName,
          PackageName: "AWS Key",
          secretValue: "abc",
        },
      });
      (manager as any).loadIgnoreData();
      const results = [
        { title: "AWS Key", secretValue: "abc", locations: [{ line: 9 }] },
      ];
      const changed = manager.removeMissingSecrets(results as any, `${WORKSPACE}/config.yml`);
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["AWS Key:abc:config.yml"].files[0].line).to.equal(10);
    });
  });

  describe("removeMissingIac", () => {
    it("deletes an iac entry that is no longer present", () => {
      setIgnoreData({
        "Open Port:sim1:main.tf": {
          files: [{ path: "main.tf", active: true, line: 2 }],
          type: constants.iacRealtimeScannerEngineName,
          PackageName: "Open Port",
          similarityId: "sim1",
        },
      });
      (manager as any).loadIgnoreData();
      const changed = manager.removeMissingIac([] as any, `${WORKSPACE}/main.tf`);
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["Open Port:sim1:main.tf"]).to.be.undefined;
    });

    it("updates line when iac still present", () => {
      setIgnoreData({
        "Open Port:sim1:main.tf": {
          files: [{ path: "main.tf", active: true, line: 2 }],
          type: constants.iacRealtimeScannerEngineName,
          PackageName: "Open Port",
          similarityId: "sim1",
        },
      });
      (manager as any).loadIgnoreData();
      const results = [
        { title: "Open Port", similarityID: "sim1", locations: [{ line: 7 }] },
      ];
      const changed = manager.removeMissingIac(results as any, `${WORKSPACE}/main.tf`);
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["Open Port:sim1:main.tf"].files[0].line).to.equal(8);
    });
  });

  describe("removeMissingAsca", () => {
    it("deletes asca entry when rule no longer present", () => {
      setIgnoreData({
        "RuleX:9:app.py": {
          files: [{ path: "app.py", active: true, line: 3 }],
          type: constants.ascaRealtimeScannerEngineName,
          PackageName: "RuleX",
          ruleId: 9,
        },
      });
      (manager as any).loadIgnoreData();
      const changed = manager.removeMissingAsca([] as any, `${WORKSPACE}/app.py`);
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["RuleX:9:app.py"]).to.be.undefined;
    });

    it("updates line when rule present at a different line", () => {
      setIgnoreData({
        "RuleX:9:app.py": {
          files: [{ path: "app.py", active: true, line: 3 }],
          type: constants.ascaRealtimeScannerEngineName,
          PackageName: "RuleX",
          ruleId: 9,
        },
      });
      (manager as any).loadIgnoreData();
      const changed = manager.removeMissingAsca(
        [{ ruleName: "RuleX", ruleId: 9, line: 12 }] as any,
        `${WORKSPACE}/app.py`
      );
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["RuleX:9:app.py"].files[0].line).to.equal(12);
    });

    it("returns false when line still exists", () => {
      setIgnoreData({
        "RuleX:9:app.py": {
          files: [{ path: "app.py", active: true, line: 3 }],
          type: constants.ascaRealtimeScannerEngineName,
          PackageName: "RuleX",
          ruleId: 9,
        },
      });
      (manager as any).loadIgnoreData();
      const changed = manager.removeMissingAsca(
        [{ ruleName: "RuleX", ruleId: 9, line: 3 }] as any,
        `${WORKSPACE}/app.py`
      );
      expect(changed).to.be.false;
    });
  });

  describe("removeMissingContainers", () => {
    it("deletes container entry when image no longer present", () => {
      setIgnoreData({
        "nginx:1.0": {
          files: [{ path: "Dockerfile", active: true, line: 1 }],
          type: constants.containersRealtimeScannerEngineName,
          PackageName: "nginx:1.0",
          imageName: "nginx",
          imageTag: "1.0",
        },
      });
      (manager as any).loadIgnoreData();
      const changed = manager.removeMissingContainers([] as any, `${WORKSPACE}/Dockerfile`);
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["nginx:1.0"]).to.be.undefined;
    });

    it("updates line when image still present", () => {
      setIgnoreData({
        "nginx:1.0": {
          files: [{ path: "Dockerfile", active: true, line: 1 }],
          type: constants.containersRealtimeScannerEngineName,
          PackageName: "nginx:1.0",
          imageName: "nginx",
          imageTag: "1.0",
        },
      });
      (manager as any).loadIgnoreData();
      const changed = manager.removeMissingContainers(
        [{ imageName: "nginx", imageTag: "1.0", locations: [{ line: 4 }] }] as any,
        `${WORKSPACE}/Dockerfile`
      );
      expect(changed).to.be.true;
      const data = readWrittenByName(".checkmarxIgnored");
      expect(data["nginx:1.0"].files[0].line).to.equal(5);
    });
  });

  describe("getIgnoredPackagesTempFile", () => {
    it("returns the temp list path when it exists", () => {
      const p = manager.getIgnoredPackagesTempFile();
      expect(p).to.be.a("string");
      expect(p).to.include("TempList");
    });

    it("returns undefined when temp list does not exist", () => {
      (fs.existsSync as sinon.SinonStub).callsFake((p: any) =>
        !String(p).includes("TempList")
      );
      expect(manager.getIgnoredPackagesTempFile()).to.be.undefined;
    });
  });

  describe("callbacks", () => {
    it("fires statusBar callback via saveIgnoreFile and uiRefresh callback via addIgnoredEntry", () => {
      const statusBar = sinon.stub();
      const uiRefresh = sinon.stub();
      manager.setStatusBarUpdateCallback(statusBar);
      manager.setUiRefreshCallback(uiRefresh);

      manager.addIgnoredEntry({
        packageManager: "npm",
        packageName: "lodash",
        packageVersion: "4.17.0",
        filePath: `${WORKSPACE}/package.json`,
      });

      expect(statusBar.called).to.be.true;
      expect(uiRefresh.called).to.be.true;
    });

    it("updateStatusBar reloads data and fires callback", () => {
      const statusBar = sinon.stub();
      manager.setStatusBarUpdateCallback(statusBar);
      manager.updateStatusBar();
      expect(statusBar.called).to.be.true;
    });
  });

  describe("scanner service setters + triggerActiveChangesDetection", () => {
    it("detects deactivated files and rescans them", async () => {
      // previousIgnoreData has an active file; current ignoreData deactivates it.
      const ossScanner = {
        shouldScanFile: sinon.stub().returns(true),
        scan: sinon.stub().resolves(),
      };
      manager.setOssScannerService(ossScanner as any);
      manager.setSecretsScannerService({ shouldScanFile: () => false, scan: sinon.stub() } as any);
      manager.setIacScannerService({ shouldScanFile: () => false, scan: sinon.stub() } as any);
      manager.setAscaScannerService({ shouldScanFile: () => false, scan: sinon.stub() } as any);
      manager.setContainersScannerService({ shouldScanFile: () => false, scan: sinon.stub() } as any);

      // Seed previous (active)
      (manager as any).previousIgnoreData = {
        "npm:lodash:4.17.0": {
          files: [{ path: "package.json", active: true }],
          type: constants.ossRealtimeScannerEngineName,
          PackageName: "lodash",
        },
      };
      // Current (inactive)
      (manager as any).ignoreData = {
        "npm:lodash:4.17.0": {
          files: [{ path: "package.json", active: false }],
          type: constants.ossRealtimeScannerEngineName,
          PackageName: "lodash",
        },
      };

      (vscode.workspace as any).openTextDocument = sinon
        .stub()
        .resolves({ uri: { fsPath: `${WORKSPACE}/package.json` } });

      await manager.triggerActiveChangesDetection();

      expect(ossScanner.scan.called).to.be.true;
    });

    it("no-op when no scanner services registered", async () => {
      // Fresh instance with no services
      await manager.triggerActiveChangesDetection();
      // should not throw and complete
      expect(true).to.be.true;
    });
  });

  describe("setScannedFilePath / dispose", () => {
    it("setScannedFilePath stores a mapping without throwing", () => {
      expect(() =>
        manager.setScannedFilePath(`${WORKSPACE}/x.py`, "/tmp/x.py")
      ).to.not.throw();
    });

    it("dispose closes the watcher without throwing", () => {
      expect(() => manager.dispose()).to.not.throw();
    });
  });

  describe("loadIgnoreData error handling", () => {
    it("falls back to empty object when read fails", () => {
      (fs.readFileSync as sinon.SinonStub).callsFake(() => {
        throw new Error("boom");
      });
      (manager as any).loadIgnoreData();
      expect(manager.getIgnoredPackagesData()).to.deep.equal({});
    });
  });
});
