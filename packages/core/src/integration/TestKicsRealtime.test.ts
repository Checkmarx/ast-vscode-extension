import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Cx } from '../cx/cx';
import { createCx } from './setup/BaseIntegrationTest';
import { validateRequiredEnv } from './setup/Environment';

// A Terraform file with a known misconfiguration — same fixture pattern already
// proven to work against the local KICS/Docker engine in TestIacScanner.test.ts.
const VULNERABLE_TERRAFORM = `
resource "aws_s3_bucket" "example" {
  bucket = "my-tf-test-bucket"
  acl    = "public-read"
}
`;

describe('Integration: KICS Realtime Scan and Remediation (requires Docker)', function () {
    this.timeout(120000);

    let cx: Cx;
    let tmpDir: string;
    let vulnerableTf: string;

    before(function () {
        validateRequiredEnv();
        cx = createCx();

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-integration-kics-'));
        vulnerableTf = path.join(tmpDir, 'main.tf');
        fs.writeFileSync(vulnerableTf, VULNERABLE_TERRAFORM);
    });

    after(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should run a realtime KICS scan via Docker and return findings', async function () {
        const [kicsResultPromise] = await cx.getResultsRealtime(vulnerableTf, '');
        const kicsOutput = await kicsResultPromise;
        expect(kicsOutput).to.not.be.undefined;
        expect(kicsOutput.exitCode).to.equal(0, `KICS realtime scan failed: ${kicsOutput.status}`);

        const kicsResults = kicsOutput.payload?.[0];
        expect(kicsResults).to.not.be.undefined;
        expect(kicsResults).to.have.property('results');
    });

    it('should throw for missing fileSources', async function () {
        let threw = false;
        try {
            await cx.getResultsRealtime('', '');
        } catch {
            threw = true;
        }
        expect(threw).to.equal(true, 'Expected getResultsRealtime to throw when fileSources is missing');
    });

    it('should attempt KICS remediation after a realtime scan and handle gracefully', async function () {
        const [kicsResultPromise] = await cx.getResultsRealtime(vulnerableTf, '');
        const kicsOutput = await kicsResultPromise;
        expect(kicsOutput.exitCode).to.equal(0, `KICS realtime scan failed: ${kicsOutput.status}`);
        const kicsResults = kicsOutput.payload?.[0];
        expect(kicsResults).to.not.be.undefined;

        // Build the results file exactly as production code does in
        // kicsRealtimeProvider.createKicsResultsFile() — the CLI's remediation
        // command expects "queries"/"total_counter" field names, not "results"/"count".
        const resultsFileContent: Record<string, unknown> = { ...kicsResults };
        resultsFileContent.queries = kicsResults.results;
        resultsFileContent.total_counter = kicsResults.count;
        delete resultsFileContent.results;
        delete resultsFileContent.count;

        const resultsFile = path.join(tmpDir, 'kics-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(resultsFileContent));

        let threw = false;
        try {
            const [remediationResultPromise] = await cx.kicsRemediation(resultsFile, tmpDir, '');
            const remediationOutput = await remediationResultPromise;
            expect(remediationOutput).to.not.be.undefined;
        } catch {
            threw = true;
        }
        expect(threw).to.equal(false, 'Expected kicsRemediation to complete without an unhandled error');
    });

    it('should throw for missing resultsFile in kicsRemediation', async function () {
        let threw = false;
        try {
            await cx.kicsRemediation('', tmpDir, '');
        } catch {
            threw = true;
        }
        expect(threw).to.equal(true, 'Expected kicsRemediation to throw when resultsFile is missing');
    });

    it('should throw for missing kicsFile in kicsRemediation', async function () {
        let threw = false;
        try {
            await cx.kicsRemediation(path.join(tmpDir, 'kics-results.json'), '', '');
        } catch {
            threw = true;
        }
        expect(threw).to.equal(true, 'Expected kicsRemediation to throw when kicsFile is missing');
    });
});
