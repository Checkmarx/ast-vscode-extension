// Runs one CI batch of UI test files and re-runs only the test files that
// failed, so a single flaky test doesn't fail the whole batch.
//
// usage: node run-ui-batch.js <resultsFile> <testFile...>
// env:   UI_TEST_MAX_RERUNS (default 1) - extra attempts for failing files
//
// Each attempt is a full `run-ui-tests.js` run (fresh VS Code session). The
// final JSON written to <resultsFile> keeps first-attempt results for files
// that passed, uses the last attempt for re-run files, and lists tests that
// failed first but passed on a re-run under "recovered" (shown in the report).
// Exit code is non-zero only if something still fails after the last attempt.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , resultsFile, ...batchFiles] = process.argv;
if (!resultsFile || batchFiles.length === 0) {
  console.error('usage: node run-ui-batch.js <resultsFile> <testFile...>');
  process.exit(2);
}
const maxReruns = parseInt(process.env.UI_TEST_MAX_RERUNS || '1', 10);

const sourceName = (f) => path.basename(f).replace(/\.js$/, '.ts');

function runAttempt(files, outFile) {
  fs.rmSync(outFile, { force: true });
  const res = spawnSync('node', [path.join(__dirname, 'run-ui-tests.js'), 'true', ...files], {
    stdio: 'inherit',
    env: { ...process.env, UI_TEST_RESULTS_FILE: outFile },
  });
  let results = null;
  try {
    results = JSON.parse(fs.readFileSync(outFile, 'utf8')).results;
  } catch (e) {
    // no results file: the run crashed before mocha finished
  }
  return { exitCode: res.status === null ? 1 : res.status, results };
}

// files with a failed test, or that reported nothing (e.g. VS Code died mid-batch)
function failingFiles(files, results) {
  if (!results) {
    return files;
  }
  const failed = new Set(results.filter((r) => r.status === 'failed').map((r) => r.file));
  const reported = new Set(results.map((r) => r.file));
  return files.filter((f) => failed.has(sourceName(f)) || !reported.has(sourceName(f)));
}

const base = resultsFile.replace(/\.json$/, '');
const first = runAttempt(batchFiles, `${base}.attempt1.json`);
let finalResults = first.results || [];
let exitCode = first.exitCode;
let pending = failingFiles(batchFiles, first.results);
const recovered = [];

for (let n = 2; n <= maxReruns + 1 && exitCode !== 0 && pending.length > 0; n++) {
  console.log(`=== Re-running ${pending.length} failed file(s), attempt ${n}: ${pending.map(sourceName).join(', ')} ===`);
  const rerun = runAttempt(pending, `${base}.attempt${n}.json`);

  if (rerun.results) {
    const earlier = finalResults;
    for (const r of rerun.results) {
      const failedBefore = earlier.some(
        (p) => p.status === 'failed' && p.file === r.file && p.title === r.title && p.suite === r.suite
      );
      if (r.status === 'passed' && failedBefore) {
        recovered.push({ file: r.file, title: r.title });
      }
    }
    const rerunSources = new Set(pending.map(sourceName));
    finalResults = earlier.filter((r) => !rerunSources.has(r.file)).concat(rerun.results);
    pending = failingFiles(pending, rerun.results);
  }
  exitCode = pending.length === 0 && rerun.exitCode === 0 ? 0 : rerun.exitCode || 1;
}

fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
fs.writeFileSync(resultsFile, JSON.stringify({ results: finalResults, recovered }, null, 2));
process.exit(exitCode);
