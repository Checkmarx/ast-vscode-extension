/**
 * Update dev version for extensions in monorepo structure
 *
 * Currently edge releases have the following format: `3.0.0-nightly.1` which
 * is valid semver but invalid as version to be published on the marketplace
 * (see also https://github.com/microsoft/vscode-vsce/issues/148 for context).
 * This means that edge releases are currently not possible with the workflow
 * we have.
 *
 * This script updates the version in the specified package's package.json.
 *
 * Usage:
 *   node updateDevVersion.js --package checkmarx
 *   node updateDevVersion.js --package project-ignite
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

const newVersion = pkg.version.split(".").slice(0, 2);

/**
 * VSCode Marketplace version requirements:
 * It must be one to four numbers in the range 0 to 2147483647,
 * with each number separated by a period. It must contain at least one non-zero number.
 */
const prereleaseDate = Math.floor(Date.now() / 1000);
newVersion.push(prereleaseDate);
pkg.version = `${newVersion.join(".")}`;

console.log(
  `Update ${packageName} package.json with dev version:\n\n${JSON.stringify(pkg, null, 2)}`,
);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
