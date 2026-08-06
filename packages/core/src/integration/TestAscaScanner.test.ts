import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Cx } from '../cx/cx';
import { createCx } from './setup/BaseIntegrationTest';
import { validateRequiredEnv } from './setup/Environment';

// A JavaScript snippet with a known hardcoded secret — triggers ASCA findings.
// ASCA only supports .java/.cs/.go/.py/.js/.jsx (constants.ascaSupportedExtensions) — no .ts.
const VULNERABLE_JS_CONTENT = `
const password = "Super$ecretP@ssw0rd123!";
const apiKey = "AKIAIOSFODNN7EXAMPLE";

function login(user) {
    const creds = { username: user, password: password };
    return creds;
}
`;

const CLEAN_JS_CONTENT = `
function add(a, b) {
    return a + b;
}
module.exports = { add };
`;

describe('Integration: ASCA Real-Time Scanner', function () {
    this.timeout(180000); // ASCA install + scan can be slow

    let cx: Cx;
    let tmpDir: string;
    let vulnerableFile: string;
    let cleanFile: string;
    let binaryFile: string;

    before(async function () {
        validateRequiredEnv();
        cx = createCx();

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-integration-asca-'));
        vulnerableFile = path.join(tmpDir, 'vulnerable.js');
        cleanFile      = path.join(tmpDir, 'clean.js');
        binaryFile     = path.join(tmpDir, 'data.bin');

        fs.writeFileSync(vulnerableFile, VULNERABLE_JS_CONTENT);
        fs.writeFileSync(cleanFile, CLEAN_JS_CONTENT);
        fs.writeFileSync(binaryFile, Buffer.from([0x00, 0x01, 0x02, 0xFF]));
    });

    after(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should install ASCA engine successfully', async function () {
        const result = await cx.installAsca();
        expect(result).to.not.be.undefined;
        expect(result.error, `ASCA install failed: ${result.error}`).to.be.undefined;
    });

    it('should run ASCA scan on a JavaScript file with known vulnerabilities', async function () {
        const result = await cx.scanAsca(vulnerableFile, '');
        expect(result).to.not.be.undefined;
        expect(result.error, `scanAsca failed: ${result.error}`).to.be.undefined;
    });

    it('should run ASCA scan on a clean file and return no critical findings', async function () {
        const result = await cx.scanAsca(cleanFile, '');
        expect(result.error, `scanAsca on clean file failed: ${result.error}`).to.be.undefined;
        const violations = result.scanDetails ?? [];
        const hasCritical = violations.some(
            (v) => (v.severity ?? '').toLowerCase() === 'critical'
        );
        expect(hasCritical).to.equal(false, 'Expected no critical violations in clean file');
    });

    it('should skip ASCA scan on a file with unsupported extension', async function () {
        // Binary files are not ASCA-scannable; the call should return quickly without a crash,
        // either succeeding with no findings or surfacing a known error on the CxAsca result.
        const result = await cx.scanAsca(binaryFile, '');
        expect(result).to.not.be.undefined;
    });
});
