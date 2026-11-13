import * as vscode from "vscode";
import { GitExtension, Repository } from "./types/git";

/**
 * Repository URL for analytics events.
 *
 * Depends only on `vscode` and the git typings, so the realtime scanners can import it
 * without import cycles.
 */

const GIT_EXTENSION_ID = "vscode.git";

/**
 * Removes credentials, query and fragment from a git remote URL, and converts SSH remotes
 * to https form. Returns "" for anything that isn't a recognisable remote.
 *
 *   https://user:token@github.com/org/repo.git -> https://github.com/org/repo
 *   git@github.com:org/repo.git                -> https://github.com/org/repo
 *   ssh://git@host:2222/org/repo.git           -> https://host/org/repo
 */
export function sanitizeRemoteUrl(remoteUrl: string | undefined): string {
  const raw = (remoteUrl ?? "").trim();
  if (!raw) {
    return "";
  }

  let host = "";
  let repoPath = "";

  // scp-like syntax: [user@]host:path (no scheme)
  const scpMatch = raw.match(/^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/);
  if (scpMatch && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    host = scpMatch[1];
    repoPath = scpMatch[2];
  } else {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return "";
    }
    if (!["http:", "https:", "ssh:", "git:"].includes(parsed.protocol)) {
      return "";
    }
    host = parsed.hostname;
    repoPath = parsed.pathname;
  }

  repoPath = repoPath.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/i, "");
  if (!host || !repoPath) {
    return "";
  }
  return `https://${host}/${repoPath}`;
}

function findRepository(repositories: Repository[], getRepository: (uri: vscode.Uri) => Repository | null, filePath?: string): Repository | undefined {
  if (filePath) {
    try {
      const repo = getRepository(vscode.Uri.file(filePath));
      if (repo) {
        return repo;
      }
    } catch {
      // fall through to the first repository
    }
  }
  return repositories[0];
}

/**
 * Sanitized remote URL of the repository that contains filePath (or the first repository).
 * Returns "" when git is unavailable, disabled, or the folder isn't a repository.
 * Never throws and never blocks: if the git extension isn't active yet, it is activated
 * in the background and "" is returned for this call.
 */
export function getRepositoryRemoteUrl(filePath?: string): string {
  try {
    const gitExtension = vscode.extensions.getExtension<GitExtension>(GIT_EXTENSION_ID);
    if (!gitExtension) {
      return "";
    }
    if (!gitExtension.isActive) {
      Promise.resolve(gitExtension.activate()).catch(() => undefined);
      return "";
    }
    const exports = gitExtension.exports;
    if (!exports?.enabled) {
      return "";
    }
    const api = exports.getAPI(1);
    const repo = findRepository(api.repositories, (uri) => api.getRepository(uri), filePath);
    if (!repo) {
      return "";
    }
    const remotes = repo.state.remotes;
    const remote = remotes.find((r) => r.name === "origin") ?? remotes[0];
    return sanitizeRemoteUrl(remote?.fetchUrl ?? remote?.pushUrl);
  } catch {
    return "";
  }
}
