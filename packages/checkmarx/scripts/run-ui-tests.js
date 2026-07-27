const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , testEnvValue, testPattern] = process.argv;

const corePackagePath = path.join(__dirname, '../../core/package.json');
const originalCorePackageJson = fs.readFileSync(corePackagePath, 'utf8');

// `vsce` (invoked internally by `extest setup-and-run` when it packages the
// extension for the test VS Code instance) runs
// `npm list --production --parseable --depth=99999 --loglevel=error` against
// this package. Because "@checkmarx/vscode-core" is a `file:../core`
// dependency, npm follows that link and also walks core's *real*
// devDependencies (mocha, nyc, ...). Some of their transitive packages are
// pinned by core's `overrides` to versions that no longer satisfy those
// devDependencies' own semver ranges, so `npm list` reports them "invalid"
// and exits non-zero, which aborts the whole extest run. Core's
// devDependencies are not needed to build or run the extension under test,
// so they are dropped from core's package.json for the duration of this run
// and restored afterwards regardless of outcome.
function stripCoreDevDependencies() {
  const corePackage = JSON.parse(originalCorePackageJson);
  delete corePackage.devDependencies;
  fs.writeFileSync(corePackagePath, JSON.stringify(corePackage, null, 2) + '\n');
}

function restoreCorePackageJson() {
  fs.writeFileSync(corePackagePath, originalCorePackageJson);
}

const env = { ...process.env, TEST: testEnvValue };

// Double quotes suppress glob expansion in both POSIX shells (bash/sh, used
// on the Linux CI runner) and cmd.exe (used on Windows), so the pattern
// reaches `extest` unexpanded on either platform.
const extestCommand = `npx extest setup-and-run "${testPattern}" -c 1.88.1 -i -r .`;

let exitCode = 0;
try {
  stripCoreDevDependencies();
  execSync('npm run compile:tests', { stdio: 'inherit', env });
  execSync(extestCommand, { stdio: 'inherit', env });
} catch (err) {
  exitCode = typeof err.status === 'number' && err.status !== null ? err.status : 1;
} finally {
  restoreCorePackageJson();
}

process.exit(exitCode);
