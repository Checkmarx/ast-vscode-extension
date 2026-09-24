import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Cx } from '../cx/cx';
import { createCx } from './setup/BaseIntegrationTest';
import { validateRequiredEnv } from './setup/Environment';

// A file with a clearly exposed AWS key pattern — triggers Secrets scanner
const FILE_WITH_SECRET = `
// Application config — DO NOT COMMIT
const AWS_ACCESS_KEY_ID     = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const GITHUB_TOKEN          = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456";
`;

// A file with no credentials or secrets
const CLEAN_FILE = `
export function greet(name: string): string {
    return \`Hello, \${name}!\`;
}
`;

describe('Integration: Secrets Real-Time Scanner', function () {
    this.timeout(120000);

    let cx: Cx;
    let tmpDir: string;
    let fileWithSecret: string;
    let cleanFile: string;
    let nodeModulesFile: string;

    before(function () {
        validateRequiredEnv();
        cx = createCx();

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-integration-secrets-'));

        fileWithSecret  = path.join(tmpDir, 'config.ts');
        cleanFile       = path.join(tmpDir, 'greet.ts');

        // Simulate a node_modules path to verify skip behavior
        const nodeModulesDir = path.join(tmpDir, 'node_modules', 'some-lib');
        fs.mkdirSync(nodeModulesDir, { recursive: true });
        nodeModulesFile = path.join(nodeModulesDir, 'index.js');

        fs.writeFileSync(fileWithSecret, FILE_WITH_SECRET);
        fs.writeFileSync(cleanFile, CLEAN_FILE);
        fs.writeFileSync(nodeModulesFile, `const TOKEN = "AKIAIOSFODNN7EXAMPLE";\n`);
    });

    after(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should run Secrets scan on a file with exposed API key and return findings', async function () {
        const result = await cx.secretsScanResults(fileWithSecret, '');
        expect(result).to.not.be.undefined;
        const findings: any[] = (result ?? []).flat(Infinity);
        expect(findings.length).to.be.greaterThan(0, 'Expected at least one secret finding in the file');
    });

    it('should return no findings for a file with no secrets', async function () {
        const result = await cx.secretsScanResults(cleanFile, '');
        expect(result).to.not.be.undefined;
        const findings: any[] = (result ?? []).flat(Infinity);
        expect(findings.length).to.equal(0, 'Expected zero secret findings in a clean file');
    });

    it('should handle a node_modules path without crashing', async function () {
        let threw = false;
        try {
            const result = await cx.secretsScanResults(nodeModulesFile, '');
            expect(result).to.not.be.undefined;
        } catch {
            threw = true;
        }
        expect(threw).to.equal(false, 'Expected Secrets scanner to handle node_modules path gracefully');
    });

    it('should mask secrets in a file', async function () {
        let threw = false;
        try {
            const masked = await cx.mask(fileWithSecret);
            expect(masked).to.not.be.undefined;
        } catch {
            threw = true;
        }
        expect(threw).to.equal(false, 'Expected mask() to succeed with a real file and workspace folder');
    });
});
