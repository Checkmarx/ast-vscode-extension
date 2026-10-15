// Mocha reporter used by the UI test run. Behaves like the default "spec"
// reporter (so CI logs look the same) and additionally writes every test
// outcome to a JSON file, which ui-test-summary.js merges across batches.
// Output path comes from UI_TEST_RESULTS_FILE; nothing is written if unset.
const fs = require('fs');
const path = require('path');
const { Spec } = require('mocha').reporters;

class UiTestReporter extends Spec {
  constructor(runner, options) {
    super(runner, options);

    const results = [];
    const record = (test, status, err) => {
      results.push({
        file: test.file ? path.basename(test.file).replace(/\.js$/, '.ts') : 'unknown',
        suite: test.parent ? test.parent.fullTitle() : '',
        title: test.title,
        status,
        durationMs: test.duration || 0,
        error: err ? String(err.message || err).split('\n')[0] : undefined,
        isHook: test.type === 'hook',
      });
    };

    runner.on('pass', (test) => record(test, 'passed'));
    runner.on('pending', (test) => record(test, 'skipped'));
    // a failing before/after hook arrives here as a "test" of type hook
    runner.on('fail', (test, err) => record(test, 'failed', err));

    runner.once('end', () => {
      const outFile = process.env.UI_TEST_RESULTS_FILE;
      if (!outFile) {
        return;
      }
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, JSON.stringify({ results }, null, 2));
    });
  }
}

module.exports = UiTestReporter;
