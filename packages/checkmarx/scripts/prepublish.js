const { execSync } = require('child_process');

// Check if we're in test mode
const isTestMode = process.env.TEST === 'true' || process.env.TEST === 'uiEndToEnd';

if (isTestMode) {
  console.log('Running test build (with devDependencies)...');
  execSync('npm run compile:tests', { stdio: 'inherit' });
  // Strip devDependencies after test compilation to avoid npm list errors
  console.log('Stripping devDependencies from package.json...');
  execSync('node scripts/copy-core-package.js', { stdio: 'inherit' });
} else {
  console.log('Running production build (without devDependencies)...');
  execSync('npm run compile', { stdio: 'inherit' });
}

