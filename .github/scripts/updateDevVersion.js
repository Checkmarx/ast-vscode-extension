/**
 * Generate timestamp-based version for dev builds
 *
 * Reads the version from package.json and converts it to marketplace-compatible
 * timestamp format for dev releases.
 *
 * VSCode Marketplace version requirements:
 * It must be one to four numbers in the range 0 to 2147483647,
 * with each number separated by a period. It must contain at least one non-zero number.
 *
 * This script DOES NOT modify package.json - it only outputs the timestamp version
 * to stdout so it can be captured by the workflow.
 *
 * Usage:
 *   TIMESTAMP_VERSION=$(node updateDevVersion.js --package checkmarx)
 *   TIMESTAMP_VERSION=$(node updateDevVersion.js --package project-ignite)
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const pkgArgIndex = args.indexOf("--package");

if (pkgArgIndex === -1 || !args[pkgArgIndex + 1]) {
  console.error(
    "Error: --package argument is required (checkmarx | project-ignite)",
  );
  process.exit(1);
}

const packageName = args[pkgArgIndex + 1];

if (!["checkmarx", "project-ignite"].includes(packageName)) {
  console.error(
    `Error: Invalid package name "${packageName}". Must be "checkmarx" or "project-ignite".`,
  );
  process.exit(1);
}

const pkgPath = path.join(
  __dirname,
  "..",
  "..",
  "packages",
  packageName,
  "package.json",
);

const pkg = JSON.parse(fs.readFileSync(pkgPath).toString());

// Take only major.minor from current version
const versionParts = pkg.version.split(".").slice(0, 2);

// Generate timestamp for patch version
const prereleaseDate = Math.floor(Date.now() / 1000);
versionParts.push(prereleaseDate);

const timestampVersion = versionParts.join(".");

// Output ONLY the timestamp version to stdout (so it can be captured)
console.log(timestampVersion);
