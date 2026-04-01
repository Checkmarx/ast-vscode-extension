const fs = require('fs');
const path = require('path');

// Read the core package.json
const corePackagePath = path.join(__dirname, '../../core/package.json');
const corePackage = JSON.parse(fs.readFileSync(corePackagePath, 'utf8'));

// Remove devDependencies to avoid npm list errors during packaging
delete corePackage.devDependencies;

// Write to the output directory
const outputPath = path.join(__dirname, '../out/node_modules/@checkmarx/vscode-core/package.json');
const outputDir = path.dirname(outputPath);

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(corePackage, null, 2));
console.log('Core package.json copied without devDependencies');

