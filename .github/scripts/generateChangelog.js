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
    "Usage: node generateChangelog.js --package <checkmarx|project-ignite> --version <x.x.x> --repo <owner/repo> [--dev true|false]",
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
 * Valid:   v2.48.0
 * Invalid: v2.48.0-nightly.1 | Checkmarx-v2.47.0 | DevAssist-v1.1.0
 *
 * For stable releases, we only look for plain v* tags (no Checkmarx- or DevAssist- prefix).
 * The regex captures vMAJOR.MINOR.PATCH with nothing after — no hyphen, no dot extension.
 */
function isStableTag(tag) {
  return /^v\d+\.\d+\.\d+$/.test(tag.trim());
}

/**
 * Returns all git tags sorted by commit date descending.
 */
function getAllTagsSorted() {
  try {
    const out = execSync("git tag --sort=-creatordate", { encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Find the last stable tag (v* only, no prefix).
 *
 * For stable releases, we only use plain v* tags (e.g., v2.46.0).
 * Package-specific prefixed tags (Checkmarx-v*, DevAssist-v*) are only for dev builds.
 */
function findLastStableTag(pkg) {
  const allTags = getAllTagsSorted();

  // Look for plain v* stable tags only
  const stableTag = allTags.find(
    (t) =>
      t.startsWith("v") &&
      !t.startsWith("Checkmarx-") &&
      !t.startsWith("DevAssist-") &&
      isStableTag(t),
  );

  if (stableTag) {
    console.log(`Found last stable tag: ${stableTag}`);
    return stableTag;
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
  /\[create-pull-request\] automated change/i,
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
      `git log ${range} --pretty=format:"%H|||%s|||%an" -- ${pkgPath}`,
      { encoding: "utf8" },
    );
  } catch (e) {
    console.error("git log failed:", e.message);
    return [];
  }

  if (!raw.trim()) return [];

  const lines = raw.trim().split("\n");
  const commits = [];

  for (const line of lines) {
    const [hash, message, authorName] = line.split("|||");
    if (!message || shouldExclude(message)) continue;

    let githubUsername = authorName;

    // Use GH CLI to get the real GitHub handle
    try {
      const login = execSync(
        `gh api repos/${repo}/commits/${hash} --template "{{.author.login}}"`,
        { encoding: "utf8" },
      ).trim();

      if (login && login !== "<no value>") {
        githubUsername = login;
      }
    } catch (e) {
      // Fallback: If GH CLI fails, strip spaces from name to avoid broken @mentions
      githubUsername = authorName.replace(/\s+/g, "");
    }

    commits.push({
      hash,
      message,
      author: githubUsername,
    });
  }

  return commits;
}

/**
 * Format commits into markdown grouped by conventional commit type.
 * @param {Array} commits - Array of commit objects
 * @param {string} repoUrl - Repository URL
 * @param {boolean} includeContributors - Whether to include author names (for GitHub release body)
 */
function formatCommits(commits, repoUrl, includeContributors = false) {
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
    // Map author name to GitHub username if mapping exists
    const githubUsername = c.author;

    // Format without SHA hash - only message and contributor
    const line = includeContributors
      ? `* ${c.message} by @${githubUsername}`
      : `* ${c.message}`;

    const msg = c.message.toLowerCase();

    // Conventional commit format OR natural language detection
    if (
      /^feat(\(.+\))?[:\!]/.test(c.message) ||
      /\b(add|added|adding|new feature|feature|implement|implemented)\b/i.test(
        msg,
      )
    ) {
      groups["🚀 New Features"].push(line);
    } else if (
      /^fix(\(.+\))?[:\!]/.test(c.message) ||
      /\b(fix|fixed|fixing|fixes|resolve|resolved|resolving|resolves|bug)\b/i.test(
        msg,
      )
    ) {
      groups["🐛 Bug Fixes"].push(line);
    } else if (
      /^docs(\(.+\))?[:\!]/.test(c.message) ||
      /\b(doc|docs|documentation|readme)\b/i.test(msg)
    ) {
      groups["📝 Documentation"].push(line);
    } else if (
      /^refactor(\(.+\))?[:\!]/.test(c.message) ||
      /\b(refactor|refactoring|restructure|reorganize)\b/i.test(msg)
    ) {
      groups["♻️ Refactor"].push(line);
    } else if (
      /^perf(\(.+\))?[:\!]/.test(c.message) ||
      /\b(perf|performance|optimize|optimized|optimization)\b/i.test(msg)
    ) {
      groups["⚡ Performance"].push(line);
    } else {
      groups["🔧 Other Changes"].push(line);
    }
  }

  let md = "";
  for (const [title, items] of Object.entries(groups)) {
    if (items.length) {
      md += `#### ${title}\n${items.join("\n")}\n\n`;
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
console.log(
  `Found ${commits.length} commits for ${packageName} since ${lastStableTag || "beginning"}`,
);

// Format changelog body WITH contributors for GitHub release
const changelogBodyWithContributors = formatCommits(commits, repoUrl, true);

// Format changelog body WITHOUT contributors for CHANGELOG.md file
const changelogBodyClean = formatCommits(commits, repoUrl, false);

// Full changelog comparison link
const compareLink = lastStableTag
  ? `**Full Changelog**: ${repoUrl}/compare/${lastStableTag}...${newTag}`
  : `**Full Changelog**: ${repoUrl}/commits/${newTag}`;

// ---------------------------------------------------------------------------
// 1. Write release body file (for GitHub release window)
//    Format:
//    ## Checkmarx (AST): v2.48.0
//    ## What's Changed
//    <grouped commits with contributors>
//    Full Changelog: link
// ---------------------------------------------------------------------------
const releaseBodySection =
  `## ${displayName}${packageName === "checkmarx" ? " (AST)" : ""}: v${version}\n` +
  `### What's Changed\n` +
  changelogBodyWithContributors +
  `${compareLink}\n`;

const releaseBodyPath = path.join(__dirname, `release_body_${packageName}.md`);
fs.writeFileSync(releaseBodyPath, releaseBodySection);
console.log(`Release body section written to ${releaseBodyPath}`);

// ---------------------------------------------------------------------------
// 2. Prepend to CHANGELOG.md (now includes dev builds for testing)
//    TODO: After testing, change this back to skip dev builds by uncommenting:
//    if (isDev) {
//      console.log("Dev build detected — skipping CHANGELOG.md update.");
//    } else {
// ---------------------------------------------------------------------------
const changelogPath = path.join(
  __dirname,
  "..",
  "..",
  "packages",
  packageName,
  "CHANGELOG.md",
);

let existingChangelog = "";
if (fs.existsSync(changelogPath)) {
  existingChangelog = fs.readFileSync(changelogPath, "utf8");
  // Remove the top-level "# CHANGELOG" header if present so we can re-add it cleanly
  existingChangelog = existingChangelog.replace(/^# CHANGELOG\s*\n+/, "");
}

// Format: DevAssist-v1.1.1-mcp_fallnack_changes.0 - 2026-02-09 16:06:36
// Use full tag name (with prefix) for the changelog entry
const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
const fullTagName = `${tagPrefix}${newTag}`;

const newEntry =
  `${fullTagName} - ${timestamp}\n` +
  `Full Changelog: ${repoUrl}/compare/${lastStableTag || "initial"}...${fullTagName}\n\n`;

const updatedChangelog = `# CHANGELOG\n\n${newEntry}${existingChangelog}`;
fs.writeFileSync(changelogPath, updatedChangelog);
console.log(`CHANGELOG.md updated at ${changelogPath}`);
