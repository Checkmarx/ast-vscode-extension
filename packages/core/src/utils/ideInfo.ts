import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Detects which VS Code-based IDE the extension runs in.
 *
 * This module deliberately depends only on `vscode`, `fs` and `path`, so it can be
 * imported from anywhere (including the realtime scanners) without import cycles.
 */

export type IdeKind = "vscode" | "cursor" | "windsurf" | "devin" | "kiro";

export interface IdeInfo {
  kind: IdeKind;
  /** IDE name sent as `agent` in analytics events. */
  agent: string;
  /** Prefix of the installation id, e.g. vscode-<uuid>. */
  installPrefix: string;
  /** The IDE's own AI assistant, sent as `aiProvider`. Undefined for VS Code. */
  nativeAiProvider?: string;
}

const IDE_INFO: Record<IdeKind, IdeInfo> = {
  vscode: { kind: "vscode", agent: "VS Code", installPrefix: "vscode" },
  cursor: { kind: "cursor", agent: "Cursor", installPrefix: "cursor", nativeAiProvider: "Cursor" },
  windsurf: { kind: "windsurf", agent: "Windsurf", installPrefix: "windsurf", nativeAiProvider: "Cascade" },
  devin: { kind: "devin", agent: "Devin", installPrefix: "devin", nativeAiProvider: "Cascade" },
  kiro: { kind: "kiro", agent: "Kiro", installPrefix: "kiro", nativeAiProvider: "Kiro" },
};

/**
 * Field in the IDE's product.json that holds its own version (the one shown in Help -> About).
 * Each fork uses a different field; checked against installed builds on 2026-11-12.
 */
export const OWN_VERSION_FIELD: Record<IdeKind, string> = {
  vscode: "version",
  cursor: "version",
  kiro: "version",
  devin: "windsurfVersion",
  windsurf: "windsurfVersion", // to be confirmed on a Windsurf install
};

function appNameLower(): string {
  const appName = vscode?.env?.appName;
  return typeof appName === "string" ? appName.toLowerCase() : "";
}

/**
 * The order matters: it matches getBaseAstConfiguration, so "Windsurf - Next" and
 * "Devin - Next" resolve correctly. Unknown forks are reported as VS Code.
 */
export function getIdeKind(): IdeKind {
  const appName = appNameLower();
  if (appName.includes("kiro")) {
    return "kiro";
  }
  if (appName.includes("cursor")) {
    return "cursor";
  }
  if (appName.includes("devin")) {
    return "devin";
  }
  if (appName.includes("windsurf")) {
    return "windsurf";
  }
  return "vscode";
}

export function getIdeInfo(): IdeInfo {
  return IDE_INFO[getIdeKind()];
}

let cachedIdeVersion: string | undefined;

/**
 * The IDE's own version. In forks, vscode.version is the VS Code engine the fork is built on,
 * so the fork's version is read from product.json. Falls back to vscode.version.
 */
export function getIdeVersion(): string {
  if (cachedIdeVersion !== undefined) {
    return cachedIdeVersion;
  }
  const engineVersion = typeof vscode?.version === "string" ? vscode.version : "";
  let version = engineVersion;
  try {
    const appRoot = vscode?.env?.appRoot;
    if (appRoot) {
      const product = JSON.parse(fs.readFileSync(path.join(appRoot, "product.json"), "utf8"));
      const value = product?.[OWN_VERSION_FIELD[getIdeKind()]];
      if (typeof value === "string" && /^\d+\.\d+/.test(value)) {
        version = value;
      }
    }
  } catch {
    // product.json missing or unreadable: keep vscode.version
  }
  cachedIdeVersion = version;
  return version;
}

/** For unit tests only. */
export function resetIdeInfoCache(): void {
  cachedIdeVersion = undefined;
}
