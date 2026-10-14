// Merges the per-batch JSON files written by ui-test-reporter.js and prints a
// markdown report (pass/fail/skip %, coverage, per-batch and per-file tables).
//
// usage: node ui-test-summary.js <resultsDir> [testSourceDir]
// The markdown goes to $GITHUB_STEP_SUMMARY when set, otherwise to stdout.
// Exit code is 1 if any test failed or a batch produced no results.
const fs = require('fs');
const path = require('path');

const resultsDir = process.argv[2] || 'ui-test-results';
const testSourceDir = process.argv[3] || path.join(__dirname, '../src/test');

const pct = (n, total) => (total ? ((n / total) * 100).toFixed(1) : '0.0') + '%';
const secs = (ms) => (ms / 1000).toFixed(0) + 's';
const escapeCell = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function count(list) {
  const c = { total: list.length, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
  for (const r of list) {
    c[r.status] += 1;
    c.durationMs += r.durationMs;
  }
  return c;
}

const jsonFiles = fs.existsSync(resultsDir)
  ? fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'))
  : [];

const batches = jsonFiles.map((f) => {
  let results = [];
  try {
    results = JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8')).results || [];
  } catch (e) {
    // unreadable file is reported below as a batch with no results
  }
  return { name: f.replace(/\.json$/, ''), results };
});

const all = batches.flatMap((b) => b.results.map((r) => ({ ...r, batch: b.name })));
const totals = count(all);
const executed = totals.passed + totals.failed;

// test files that exist in the repo vs files that actually reported results
const sourceFiles = fs.existsSync(testSourceDir)
  ? fs.readdirSync(testSourceDir).filter((f) => /^\d+\..*\.test\.ts$/.test(f))
  : [];
const reportedFiles = new Set(all.map((r) => r.file));
const missingFiles = sourceFiles.filter((f) => !reportedFiles.has(f));

const out = [];
out.push('# UI Test Report');
out.push('');
out.push(`**Result: ${totals.failed === 0 && totals.total > 0 ? '✅ PASSED' : '❌ FAILED'}**`);
out.push('');
out.push('| Total | Passed | Failed | Skipped | Duration |');
out.push('|---:|---:|---:|---:|---:|');
out.push(`| ${totals.total} | ${totals.passed} | ${totals.failed} | ${totals.skipped} | ${secs(totals.durationMs)} |`);
out.push('');
out.push('| Metric | Value |');
out.push('|---|---:|');
out.push(`| Pass % (of all tests) | ${pct(totals.passed, totals.total)} |`);
out.push(`| Fail % (of all tests) | ${pct(totals.failed, totals.total)} |`);
out.push(`| Skipped % (of all tests) | ${pct(totals.skipped, totals.total)} |`);
out.push(`| Pass rate of executed tests | ${pct(totals.passed, executed)} |`);
out.push(`| Test coverage (executed / defined) | ${pct(executed, totals.total)} (${executed}/${totals.total}) |`);
out.push(`| Test file coverage | ${pct(reportedFiles.size, sourceFiles.length)} (${reportedFiles.size}/${sourceFiles.length} files) |`);
out.push('');
out.push('> Coverage here is functional: how many of the defined UI test cases actually ran (skipped ones and tests never reached because a hook failed are not counted), not code-line coverage.');
out.push('');

out.push('## Results by batch');
out.push('');
out.push('| Batch | Total | Passed | Failed | Skipped | Pass % | Fail % | Duration |');
out.push('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const b of batches) {
  const c = count(b.results);
  const flag = c.total === 0 ? ' ⚠️ no results' : c.failed ? ' ❌' : ' ✅';
  out.push(`| ${b.name}${flag} | ${c.total} | ${c.passed} | ${c.failed} | ${c.skipped} | ${pct(c.passed, c.total)} | ${pct(c.failed, c.total)} | ${secs(c.durationMs)} |`);
}
out.push('');

out.push('## Results by test file');
out.push('');
out.push('| File | Batch | Total | Passed | Failed | Skipped | Pass % |');
out.push('|---|---|---:|---:|---:|---:|---:|');
const byFile = new Map();
for (const r of all) {
  const key = `${r.file}|${r.batch}`;
  if (!byFile.has(key)) {
    byFile.set(key, []);
  }
  byFile.get(key).push(r);
}
const fileNum = (k) => parseInt(k, 10);
[...byFile.keys()]
  .sort((a, b) => fileNum(a) - fileNum(b))
  .forEach((key) => {
    const [file, batch] = key.split('|');
    const c = count(byFile.get(key));
    out.push(`| ${file} ${c.failed ? '❌' : ''} | ${batch} | ${c.total} | ${c.passed} | ${c.failed} | ${c.skipped} | ${pct(c.passed, c.total)} |`);
  });
out.push('');

const failed = all.filter((r) => r.status === 'failed');
if (failed.length) {
  out.push('## Failed tests');
  out.push('');
  out.push('| File | Test | Error |');
  out.push('|---|---|---|');
  for (const r of failed) {
    const title = r.isHook ? `${r.suite} - ${r.title}` : r.title;
    out.push(`| ${r.file} | ${escapeCell(title)} | ${escapeCell((r.error || '').slice(0, 200))} |`);
  }
  out.push('');
}

const skipped = all.filter((r) => r.status === 'skipped');
if (skipped.length) {
  out.push(`<details><summary>Skipped tests (${skipped.length})</summary>`);
  out.push('');
  skipped.forEach((r) => out.push(`- ${r.file}: ${escapeCell(r.title)}`));
  out.push('');
  out.push('</details>');
  out.push('');
}

if (missingFiles.length) {
  out.push('## ⚠️ Test files with no results');
  out.push('');
  out.push('These files exist in `src/test` but reported nothing (not in any batch, or the batch crashed before reaching them):');
  out.push('');
  missingFiles.forEach((f) => out.push(`- ${f}`));
  out.push('');
}

const emptyBatches = batches.filter((b) => b.results.length === 0);
const markdown = out.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}
// always echo to the log too, and keep a copy as a file the workflow uploads
console.log(markdown);
if (process.env.UI_TEST_REPORT_FILE) {
  fs.writeFileSync(process.env.UI_TEST_REPORT_FILE, markdown + '\n');
}

process.exit(totals.failed > 0 || emptyBatches.length > 0 || totals.total === 0 ? 1 : 0);
