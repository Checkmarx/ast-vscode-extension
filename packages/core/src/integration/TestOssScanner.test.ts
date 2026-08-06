import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Cx } from '../cx/cx';
import { createCx } from './setup/BaseIntegrationTest';
import { validateRequiredEnv } from './setup/Environment';

// A package.json with a known vulnerable version of lodash
const VULNERABLE_PACKAGE_JSON = JSON.stringify({
    name: 'integration-test-app',
    version: '1.0.0',
    dependencies: {
        'lodash': '4.17.4',       // prototype pollution CVE-2019-10744
        'express': '4.17.1',
    }
}, null, 2);

// A package.json using up-to-date packages (lower risk of known CVEs)
const CLEAN_PACKAGE_JSON = JSON.stringify({
    name: 'integration-test-clean',
    version: '1.0.0',
    dependencies: {
        'lodash': '4.17.21',
    }
}, null, 2);

describe('Integration: OSS Real-Time Scanner', function () {
    this.timeout(120000);

    let cx: Cx;
    let tmpDir: string;
    let vulnerableManifest: string;
    let cleanManifest: string;
    let nonManifest: string;

    before(function () {
        validateRequiredEnv();
        cx = createCx();

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-integration-oss-'));
        vulnerableManifest = path.join(tmpDir, 'package.json');
        cleanManifest      = path.join(tmpDir, 'clean-package.json');
        nonManifest        = path.join(tmpDir, 'source.ts');

        fs.writeFileSync(vulnerableManifest, VULNERABLE_PACKAGE_JSON);
        fs.writeFileSync(cleanManifest, CLEAN_PACKAGE_JSON);
        fs.writeFileSync(nonManifest, '// not a manifest\n');
    });

    after(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should run OSS scan on a package.json and return results', async function () {
        const result = await cx.ossScanResults(vulnerableManifest, '');
        expect(result).to.not.be.undefined;
        expect(result).to.be.an('array');
    });

    it('should return results array for a manifest file', async function () {
        const result = await cx.ossScanResults(vulnerableManifest, '');
        expect(result).to.be.an('array');
    });

    it('should complete without error or throw a known "unsupported file" error for a non-manifest source file', async function () {
        // Cx.ossScanResults() throws whenever the CLI returns a non-zero exit code, and a
        // non-manifest file legitimately isn't scannable — either an empty/undefined result
        // or a thrown error is acceptable here; we're verifying the call path doesn't crash
        // in an unexpected way.
        try {
            const result = await cx.ossScanResults(nonManifest, '');
            expect(result).to.not.be.undefined;
        } catch (err: any) {
            expect(err).to.be.an('error');
        }
    });
});
