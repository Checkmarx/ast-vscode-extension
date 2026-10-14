// Mocha config handed to `extest -m`; only swaps in the results-collecting reporter.
const path = require('path');

module.exports = {
  reporter: path.join(__dirname, 'ui-test-reporter.js'),
};
