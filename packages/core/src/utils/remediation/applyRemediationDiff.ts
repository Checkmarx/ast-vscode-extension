import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { RemediationFileChange } from "../../models/aiTriage";

interface DiffHunk {
  oldStart: number;
  lines: string[];
}

const HUNK_HEADER = /^@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@/;

/** Parse a git-style unified diff for a single file into its hunks. */
function parseHunks(diffText: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | undefined;
  for (const raw of diffText.split(/\r?\n/)) {
    const match = HUNK_HEADER.exec(raw);
    if (match) {
      current = { oldStart: parseInt(match[1], 10), lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) {
      continue; // preamble (diff --git / index / --- / +++)
    }
    if (raw.startsWith(" ") || raw.startsWith("+") || raw.startsWith("-")) {
      current.lines.push(raw);
    }
    // lines like "\ No newline at end of file" are ignored
  }
  return hunks;
}

/** Find where a hunk's context/removed lines actually occur in the source, tolerating drift. */
function findAnchor(sourceLines: string[], pattern: string[], expectedIndex: number, minIndex: number): number {
  if (pattern.length === 0) {
    return Math.max(expectedIndex, minIndex);
  }
  const matchesAt = (start: number): boolean => {
    if (start < minIndex || start + pattern.length > sourceLines.length) {
      return false;
    }
    for (let i = 0; i < pattern.length; i++) {
      if (sourceLines[start + i] !== pattern[i]) {
        return false;
      }
    }
    return true;
  };
  for (let offset = 0; offset <= sourceLines.length; offset++) {
    const forward = expectedIndex + offset;
    if (matchesAt(forward)) {
      return forward;
    }
    const backward = expectedIndex - offset;
    if (offset !== 0 && matchesAt(backward)) {
      return backward;
    }
  }
  return -1;
}

/**
 * Apply a git-style unified diff (as returned by the remediation-details API) to
 * the given file content and return the patched content. Throws when a hunk's
 * context can't be located, rather than silently producing a corrupted file.
 */
export function applyUnifiedDiff(original: string, diffText: string): string {
  const hunks = parseHunks(diffText);
  if (hunks.length === 0) {
    throw new Error("Diff contains no applicable hunks.");
  }

  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const endsWithNewline = /\r?\n$/.test(original);
  const sourceLines = original.split(/\r\n|\n/);
  if (endsWithNewline) {
    sourceLines.pop();
  }

  const resultLines: string[] = [];
  let cursor = 0;

  for (const hunk of hunks) {
    const pattern = hunk.lines
      .filter((l) => l.startsWith(" ") || l.startsWith("-"))
      .map((l) => l.slice(1));
    const anchor = findAnchor(sourceLines, pattern, hunk.oldStart - 1, cursor);
    if (anchor === -1) {
      throw new Error(`Could not locate a matching location for a diff hunk near line ${hunk.oldStart}.`);
    }
    resultLines.push(...sourceLines.slice(cursor, anchor));
    let srcIdx = anchor;
    for (const line of hunk.lines) {
      const marker = line[0];
      const text = line.slice(1);
      if (marker === " ") {
        resultLines.push(sourceLines[srcIdx]);
        srcIdx++;
      } else if (marker === "-") {
        srcIdx++;
      } else {
        resultLines.push(text);
      }
    }
    cursor = srcIdx;
  }
  resultLines.push(...sourceLines.slice(cursor));

  return resultLines.join(eol) + (endsWithNewline ? eol : "");
}

export interface ApplyRemediationResult {
  applied: string[];
  failed: Array<{ filePath: string; error: string }>;
}

/**
 * Apply each remediation file change to the corresponding file in the first
 * workspace folder, then open it in an editor tab. Best-effort per file: a
 * failure on one file does not prevent the others from being applied.
 */
export async function applyRemediationFileChanges(
  fileChanges: RemediationFileChange[],
  logs?: Logs
): Promise<ApplyRemediationResult> {
  const result: ApplyRemediationResult = { applied: [], failed: [] };
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    for (const change of fileChanges) {
      result.failed.push({ filePath: change.file_path, error: "No workspace folder is open." });
    }
    return result;
  }

  for (const change of fileChanges) {
    const uri = vscode.Uri.joinPath(workspaceFolder.uri, change.file_path);
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const original = Buffer.from(bytes).toString("utf8");
      const patched = applyUnifiedDiff(original, change.diff);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(patched, "utf8"));
      await vscode.window.showTextDocument(uri, { preview: false });
      result.applied.push(change.file_path);
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      logs?.error(`[AI Remediation] failed to apply diff to ${change.file_path}: ${message}`);
      result.failed.push({ filePath: change.file_path, error: message });
    }
  }
  return result;
}
