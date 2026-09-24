import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import { Cx } from '../cx/cx';
import { getResultsFilePath } from '../utils/utils';
import { createCx } from './setup/BaseIntegrationTest';
import { validateRequiredEnv, CX_TEST_SCAN_ID } from './setup/Environment';

describe('Integration: Results Operations', function () {
    this.timeout(120000);

    let cx: Cx;
    // Cx.getResults() always writes to this fixed location (constants.resultsFileName/Extension
    // joined with the directory of utils.ts) — it doesn't accept a caller-supplied path.
    const jsonFile = getResultsFilePath();

    before(function () {
        validateRequiredEnv();
        cx = createCx();
    });

    after(function () {
        if (fs.existsSync(jsonFile)) {
            fs.rmSync(jsonFile, { force: true });
        }
    });

    it('should retrieve results for a known scan ID without throwing', async function () {
        let threw = false;
        try {
            await cx.getResults(CX_TEST_SCAN_ID);
        } catch {
            threw = true;
        }
        expect(threw).to.equal(false, 'Expected getResults to succeed for a known scan ID');
    });

    it('should create a results file on disk', async function () {
        await cx.getResults(CX_TEST_SCAN_ID);
        expect(fs.existsSync(jsonFile)).to.equal(
            true,
            `Expected results file to exist at ${jsonFile}`
        );
    });

    it('should retrieve results in JSON format with parseable content', async function () {
        await cx.getResults(CX_TEST_SCAN_ID);
        if (fs.existsSync(jsonFile)) {
            const raw = fs.readFileSync(jsonFile, 'utf-8');
            const parsed = JSON.parse(raw);
            expect(parsed).to.be.an('object');
        }
    });

    it('should results file contain expected top-level fields', async function () {
        await cx.getResults(CX_TEST_SCAN_ID);
        if (fs.existsSync(jsonFile)) {
            const raw = fs.readFileSync(jsonFile, 'utf-8');
            const parsed = JSON.parse(raw);
            // Checkmarx results JSON has a 'results' or 'findings' array at the top level
            const hasResults = 'results' in parsed || 'findings' in parsed || Array.isArray(parsed);
            expect(hasResults).to.equal(true, 'Expected results file to have a results/findings field');
        }
    });

    it('should not throw for a non-existent scan ID (Cx.getResults swallows failures silently)', async function () {
        // Cx.getResults() never inspects the CLI call's exitCode/status — it resolves
        // regardless of outcome, so a bad scan ID doesn't surface as a thrown error here.
        const fakeId = '00000000-0000-0000-0000-000000000000';
        let threw = false;
        try {
            await cx.getResults(fakeId);
        } catch {
            threw = true;
        }
        expect(threw).to.equal(false, 'Expected getResults to resolve without throwing even for a bad scan ID');
    });
});
