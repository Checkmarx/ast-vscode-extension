const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , testEnvValue, ...testPatterns] = process.argv;

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
// If inherited from the parent shell, this forces every spawned Electron
// process (including the test VS Code instance extest launches) to run as
// plain Node with no window, so ChromeDriver can never find a browser to
// attach to and reports it as "crashed".
delete env.ELECTRON_RUN_AS_NODE;

// Double quotes suppress glob expansion in both POSIX shells (bash/sh, used
// on the Linux CI runner) and cmd.exe (used on Windows), so each pattern
// reaches `extest` unexpanded on either platform. Multiple patterns/file
// paths can be passed (e.g. to run one batch of test files in CI); extest's
// `<testFiles...>` argument accepts any number of them.
const testSettingsPath = path.join(__dirname, 'test-vscode-settings.json');
const quotedPatterns = testPatterns.map((p) => `"${p}"`).join(' ');
const extestCommand = `npx extest setup-and-run ${quotedPatterns} -c 1.88.1 -i -r . -o "${testSettingsPath}"`;

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
