const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , testEnvValue, ...testPatterns] = process.argv;

const corePackagePath = path.join(__dirname, '../../core/package.json');
// Backup written before core's package.json is stripped below. If a previous run was killed
// mid-way (so the restore never ran), put the real file back before reading it.
const corePackageBackupPath = `${corePackagePath}.orig`;
if (fs.existsSync(corePackageBackupPath)) {
  fs.copyFileSync(corePackageBackupPath, corePackagePath);
  fs.rmSync(corePackageBackupPath, { force: true });
}
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
  fs.writeFileSync(corePackageBackupPath, originalCorePackageJson);
  const corePackage = JSON.parse(originalCorePackageJson);
  delete corePackage.devDependencies;
  fs.writeFileSync(corePackagePath, JSON.stringify(corePackage, null, 2) + '\n');
}

function restoreCorePackageJson() {
  fs.writeFileSync(corePackagePath, originalCorePackageJson);
  fs.rmSync(corePackageBackupPath, { force: true });
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
// Swaps in a reporter that also dumps results to JSON when UI_TEST_RESULTS_FILE is set (used by the CI report).
const mochaConfigPath = path.join(__dirname, 'mocharc.ui.js');
const quotedPatterns = testPatterns.map((p) => `"${p}"`).join(' ');
// Optional: run the test VS Code against an isolated extensions folder (instead of the shared ~/.vscode/extensions).
const extensionsFolderFlag = process.env.EXTENSIONS_FOLDER ? ` -e "${process.env.EXTENSIONS_FOLDER}"` : '';
const extestCommand = `npx extest setup-and-run ${quotedPatterns} -c 1.88.1 -i -r . -o "${testSettingsPath}" -m "${mochaConfigPath}"${extensionsFolderFlag}`;

let exitCode = 0;
try {
  stripCoreDevDependencies();
  execSync('npm run compile:tests', { stdio: 'inherit', env });
  // extest packages the extension via `vsce.createVSIX()` without exposing
  // `--allow-star-activation`, so it falls back to an interactive "Do you
  // want to continue? [y/N]" prompt for the '*' activation event both
  // extensions intentionally use. Feed it a "y" so the run doesn't abort
  // when stdin isn't an attached TTY (e.g. launched via a debugger).
  execSync(extestCommand, { stdio: ['pipe', 'inherit', 'inherit'], input: 'y\n', env });
} catch (err) {
  exitCode = typeof err.status === 'number' && err.status !== null ? err.status : 1;
} finally {
  restoreCorePackageJson();
}

process.exit(exitCode);
