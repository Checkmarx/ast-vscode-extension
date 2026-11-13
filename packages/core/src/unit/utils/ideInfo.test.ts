/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { mock } from "../mocks/vscode-mock";
import { getIdeInfo, getIdeKind, getIdeVersion, OWN_VERSION_FIELD, resetIdeInfoCache } from "../../utils/ideInfo";

describe("ideInfo", () => {
  const originalAppName = (mock as any).env.appName;
  const originalAppRoot = (mock as any).env.appRoot;
  const originalVersion = (mock as any).version;
  let tempDir: string | undefined;

  function setApp(appName: string, appRoot?: string, version = "1.128.0") {
    (mock as any).env.appName = appName;
    (mock as any).env.appRoot = appRoot;
    (mock as any).version = version;
    resetIdeInfoCache();
  }

  function writeProductJson(product: Record<string, unknown>): string {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cx-ideinfo-"));
    fs.writeFileSync(path.join(tempDir, "product.json"), JSON.stringify(product));
    return tempDir;
  }

  afterEach(() => {
    (mock as any).env.appName = originalAppName;
    (mock as any).env.appRoot = originalAppRoot;
    (mock as any).version = originalVersion;
    resetIdeInfoCache();
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  describe("getIdeKind / getIdeInfo", () => {
    const cases: Array<[string, string, string, string, string | undefined]> = [
      // appName, kind, agent, installPrefix, nativeAiProvider
      ["Visual Studio Code", "vscode", "VS Code", "vscode", undefined],
      ["Visual Studio Code - Insiders", "vscode", "VS Code", "vscode", undefined],
      ["Cursor", "cursor", "Cursor", "cursor", "Cursor"],
      ["Windsurf", "windsurf", "Windsurf", "windsurf", "Cascade"],
      ["Windsurf - Next", "windsurf", "Windsurf", "windsurf", "Cascade"],
      ["Devin", "devin", "Devin", "devin", "Cascade"],
      ["Devin - Next", "devin", "Devin", "devin", "Cascade"],
      ["Kiro", "kiro", "Kiro", "kiro", "Kiro"],
      ["Some Unknown Fork", "vscode", "VS Code", "vscode", undefined],
    ];

    for (const [appName, kind, agent, prefix, provider] of cases) {
      it(`maps "${appName}" to ${agent}`, () => {
        setApp(appName);
        expect(getIdeKind()).to.equal(kind);
        const info = getIdeInfo();
        expect(info.agent).to.equal(agent);
        expect(info.installPrefix).to.equal(prefix);
        expect(info.nativeAiProvider).to.equal(provider);
      });
    }
  });

  describe("getIdeVersion", () => {
    it("returns vscode.version in VS Code", () => {
      setApp("Visual Studio Code", writeProductJson({ version: "1.146.0" }), "1.146.0");
      expect(getIdeVersion()).to.equal("1.146.0");
    });

    it("returns Cursor's own version from product.json", () => {
      setApp("Cursor", writeProductJson({ version: "3.27.22", vscodeVersion: "1.128.0" }), "1.128.0");
      expect(getIdeVersion()).to.equal("3.27.22");
    });

    it("returns Kiro's own version from product.json", () => {
      setApp("Kiro", writeProductJson({ version: "1.4.86", vsCodeVersion: "1.131.0" }), "1.131.0");
      expect(getIdeVersion()).to.equal("1.4.86");
    });

    it("returns Devin's own version from windsurfVersion", () => {
      setApp("Devin", writeProductJson({ version: "1.126.0", windsurfVersion: "3.11.238" }), "1.126.0");
      expect(getIdeVersion()).to.equal("3.11.238");
    });

    it("falls back to vscode.version when the field is missing", () => {
      setApp("Devin", writeProductJson({ version: "1.126.0" }), "1.126.0");
      expect(getIdeVersion()).to.equal("1.126.0");
    });

    it("falls back to vscode.version when the value isn't a version", () => {
      setApp("Cursor", writeProductJson({ version: "not-a-version" }), "1.128.0");
      expect(getIdeVersion()).to.equal("1.128.0");
    });

    it("falls back to vscode.version when product.json can't be read", () => {
      setApp("Cursor", path.join(os.tmpdir(), "does-not-exist-cx"), "1.128.0");
      expect(getIdeVersion()).to.equal("1.128.0");
    });

    it("falls back to vscode.version when appRoot is not set", () => {
      setApp("Cursor", undefined, "1.128.0");
      expect(getIdeVersion()).to.equal("1.128.0");
    });

    it("caches the value", () => {
      setApp("Cursor", writeProductJson({ version: "3.27.22" }), "1.128.0");
      expect(getIdeVersion()).to.equal("3.27.22");
      fs.writeFileSync(path.join(tempDir!, "product.json"), JSON.stringify({ version: "9.9.9" }));
      expect(getIdeVersion()).to.equal("3.27.22");
    });

    it("pins the product.json field for each IDE", () => {
      expect(OWN_VERSION_FIELD).to.deep.equal({
        vscode: "version",
        cursor: "version",
        kiro: "version",
        devin: "windsurfVersion",
        windsurf: "windsurfVersion",
      });
    });
  });
});
