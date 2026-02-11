/**
 * Generate changelog for a specific package using git log filtered by path.
 *
 * Usage:
 *   node generateChangelog.js --package checkmarx --version 2.48.0 --repo Checkmarx/ast-vscode-extension
 *   node generateChangelog.js --package project-ignite --version 1.2.0 --repo Checkmarx/ast-vscode-extension
 *
 * Outputs:
 *   - packages/<name>/CHANGELOG.md  (prepends new entry to existing file)
 *   - release_body_<name>.md        (used for GitHub release window)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Parse arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

const packageName = get("--package");
const version = get("--version");
const repo = get("--repo");
const isDev = get("--dev") === "true";

if (!packageName || !version || !repo) {
  console.error(
    "Usage: node generateChangelog.js --package <checkmarx|project-ignite> --version <x.x.x> --repo <owner/repo> [--dev true|false]"
  );
  process.exit(1);
}

if (!["checkmarx", "project-ignite"].includes(packageName)) {
  console.error('--package must be "checkmarx" or "project-ignite"');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A stable tag has NO hyphen after the version digits.
 * Valid:   v2.48.0  |  Checkmarx-v2.47.0  |  DevAssist-v1.1.0
 * Invalid: v2.48.0-nightly.1  |  Checkmarx-v2.47.0-nightly.1  |  DevAssist-v1.1.0-final-test.0
 *
 * The regex captures an optional prefix (Checkmarx- | DevAssist-) followed by
 * vMAJOR.MINOR.PATCH with nothing after — no hyphen, no dot extension.
 */
function isStableTag(tag) {
  return /^(Checkmarx-|DevAssist-)?v\d+\.\d+\.\d+$/.test(tag.trim());
}

/**
 * Returns all git tags sorted by commit date descending.
 */
function getAllTagsSorted() {
  try {
    const out = execSync(
      'git tag --sort=-creatordate',
      { encoding: "utf8" }
    );
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Find the last stable tag for a given package.
 *
 * Priority:
 *  1. Latest stable tag with the package-specific prefix
 *     (Checkmarx-v* for checkmarx, DevAssist-v* for project-ignite)
 *  2. Latest stable tag with no prefix (v*) — pre-split era
 */
function findLastStableTag(pkg) {
  const prefix = pkg === "checkmarx" ? "Checkmarx-" : "DevAssist-";
  const allTags = getAllTagsSorted();

  // 1. Try prefixed stable tags first
  const prefixedStable = allTags.find(
    (t) => t.startsWith(prefix) && isStableTag(t)
  );
  if (prefixedStable) {
    console.log(`Found last stable prefixed tag for ${pkg}: ${prefixedStable}`);
    return prefixedStable;
  }

  // 2. Fall back to plain v* stable tags (pre-split era)
  const plainStable = allTags.find(
    (t) => t.startsWith("v") && !t.startsWith("Checkmarx-") && !t.startsWith("DevAssist-") && isStableTag(t)
  );
  if (plainStable) {
    console.log(`Found last stable plain tag for ${pkg}: ${plainStable}`);
    return plainStable;
  }

  console.log(`No stable tag found for ${pkg}, will use full history`);
  return null;
}

/**
 * Commits to always exclude — version bump / release automation commits.
 */
const EXCLUDE_PATTERNS = [
  /update.*extension version.*automated/i,
  /update.*checkmarx.*version.*automated/i,
  /update.*ignite.*version.*automated/i,
  /docs\(changelog\)/i,
  /bump version/i,
];

function shouldExclude(message) {
  return EXCLUDE_PATTERNS.some((re) => re.test(message));
}

/**
 * Run git log from lastTag..HEAD filtered to the package path.
 * Returns array of { hash, message, author, date }
 */
function getCommits(pkg, lastTag) {
  const pkgPath = `packages/${pkg}/`;
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";

  let raw;
  try {
    raw = execSync(
      `git log ${range} --pretty=format:"%H|||%s|||%an|||%ad" --date=short -- ${pkgPath}`,
      { encoding: "utf8" }
    );
  } catch (e) {
    console.error("git log failed:", e.message);
    return [];
  }

  if (!raw.trim()) return [];

  return raw
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, message, author, date] = line.split("|||");
      return { hash: hash?.trim(), message: message?.trim(), author: author?.trim(), date: date?.trim() };
    })
    .filter((c) => c.message && !shouldExclude(c.message));
}

/**
 * Format commits into markdown grouped by conventional commit type.
 */
function formatCommits(commits, repoUrl) {
  if (!commits.length) return "_No changes_\n";

  const groups = {
    "🚀 New Features": [],
    "🐛 Bug Fixes": [],
    "📝 Documentation": [],
    "♻️ Refactor": [],
    "⚡ Performance": [],
    "🔧 Other Changes": [],
  };

  for (const c of commits) {
    const line = `* ${c.message} by @${c.author} ([${c.hash.slice(0, 7)}](${repoUrl}/commit/${c.hash}))`;
    if (/^feat(\(.+\))?[:\!]/.test(c.message)) groups["🚀 New Features"].push(line);
    else if (/^fix(\(.+\))?[:\!]/.test(c.message)) groups["🐛 Bug Fixes"].push(line);
    else if (/^docs(\(.+\))?[:\!]/.test(c.message)) groups["📝 Documentation"].push(line);
    else if (/^refactor(\(.+\))?[:\!]/.test(c.message)) groups["♻️ Refactor"].push(line);
    else if (/^perf(\(.+\))?[:\!]/.test(c.message)) groups["⚡ Performance"].push(line);
    else groups["🔧 Other Changes"].push(line);
  }

  let md = "";
  for (const [title, items] of Object.entries(groups)) {
    if (items.length) {
      md += `### ${title}\n${items.join("\n")}\n\n`;
    }
  }
  return md;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const repoUrl = `https://github.com/${repo}`;
const displayName = packageName === "checkmarx" ? "Checkmarx" : "DevAssist";
const tagPrefix = packageName === "checkmarx" ? "Checkmarx-" : "DevAssist-";

// New tag for this release — used in CHANGELOG.md heading and full changelog link
const newTag = `v${version}`;
const releaseUrl = `${repoUrl}/releases/tag/${newTag}`;
const today = new Date().toISOString().slice(0, 10);

// Find last stable tag
const lastStableTag = findLastStableTag(packageName);

// Get filtered commits
const commits = getCommits(packageName, lastStableTag);
console.log(`Found ${commits.length} commits for ${packageName} since ${lastStableTag || "beginning"}`);

// Format changelog body
const changelogBody = formatCommits(commits, repoUrl);

// Full changelog comparison link
const compareLink = lastStableTag
  ? `**Full Changelog**: ${repoUrl}/compare/${lastStableTag}...${newTag}`
  : `**Full Changelog**: ${repoUrl}/commits/${newTag}`;

// ---------------------------------------------------------------------------
// 1. Write release body file (for GitHub release window)
//    Caller is responsible for assembling multi-package release body.
//    This file contains only THIS package's section.
// ---------------------------------------------------------------------------
const releaseBodySection =
  `## ${displayName} v${version}\n\n` +
  changelogBody +
  `\n${compareLink}\n`;

const releaseBodyPath = path.join(__dirname, `release_body_${packageName}.md`);
fs.writeFileSync(releaseBodyPath, releaseBodySection);
console.log(`Release body section written to ${releaseBodyPath}`);

// ---------------------------------------------------------------------------
// 2. Prepend to CHANGELOG.md (stable releases only, skipped for dev builds)
// ---------------------------------------------------------------------------
if (isDev) {
  console.log("Dev build detected — skipping CHANGELOG.md update.");
} else {
  const changelogPath = path.join(__dirname, "..", "..", "packages", packageName, "CHANGELOG.md");

  let existingChangelog = "";
  if (fs.existsSync(changelogPath)) {
    existingChangelog = fs.readFileSync(changelogPath, "utf8");
    // Remove the top-level "# CHANGELOG" header if present so we can re-add it cleanly
    existingChangelog = existingChangelog.replace(/^# CHANGELOG\s*\n+/, "");
  }

  const newEntry =
    `## [${displayName} v${version}](${releaseUrl}) - ${today}\n\n` +
    changelogBody +
    `\n${compareLink}\n\n`;

  const updatedChangelog = `# CHANGELOG\n\n${newEntry}${existingChangelog}`;
  fs.writeFileSync(changelogPath, updatedChangelog);
  console.log(`CHANGELOG.md updated at ${changelogPath}`);
}
