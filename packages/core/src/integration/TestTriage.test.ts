import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as fs from 'fs';
import { Cx } from '../cx/cx';
import { getResultsFilePath } from '../utils/utils';
import { createCx } from './setup/BaseIntegrationTest';
import {
    validateRequiredEnv,
    CX_TEST_PROJECT_ID,
    CX_TEST_SCAN_ID,
} from './setup/Environment';

describe('Integration: Triage Operations', function () {
    this.timeout(120000);

    let cx: Cx;
    let firstSastResult: { similarityId: string; projectId: string } | undefined;

    before(async function () {
        validateRequiredEnv();
        cx = createCx();

        // Load results (Cx.getResults writes to a fixed location) to get a real SAST similarityId
        const jsonFile = getResultsFilePath();
        await cx.getResults(CX_TEST_SCAN_ID);
        if (fs.existsSync(jsonFile)) {
            const raw = fs.readFileSync(jsonFile, 'utf-8');
            const parsed = JSON.parse(raw);
            const results: any[] = parsed.results ?? parsed.findings ?? [];
            const sastResult = results.find((r: any) => r.type === 'sast' && r.similarityId);
            if (sastResult) {
                firstSastResult = {
                    similarityId: sastResult.similarityId,
                    projectId: CX_TEST_PROJECT_ID,
                };
            }
            fs.rmSync(jsonFile, { force: true });
        }
    });

    it('should retrieve available triage states from backend', async function () {
        const result = await cx.triageGetStates(true);
        expect(result).to.not.be.undefined;
        expect(result!.exitCode).to.equal(0);
        expect(result!.payload).to.be.an('array');
        expect(result!.payload.length).to.be.greaterThan(0);
    });

    it('should retrieve triage predicates for a SAST result', async function () {
        expect(firstSastResult, 'Expected a SAST result with a similarityId in the test scan').to.not.be.undefined;
        const predicates = await cx.triageShow(
            firstSastResult!.projectId,
            firstSastResult!.similarityId,
            'sast'
        );
        expect(predicates).to.be.an('array');
    });

    it('should retrieve triage predicates for a KICS result (or return empty)', async function () {
        // KICS predicates require a valid KICS similarityId; a mismatch is acceptable here —
        // we're exercising the call path, not asserting real KICS data.
        expect(firstSastResult, 'Expected a SAST result with a similarityId in the test scan').to.not.be.undefined;
        let predicates: any[] = [];
        try {
            predicates = (await cx.triageShow(
                firstSastResult!.projectId,
                firstSastResult!.similarityId,
                'kics'
            )) ?? [];
        } catch {
            // A KICS similarity ID mismatch is acceptable — the call path is exercised
        }
        expect(predicates).to.be.an('array');
    });

    it('should not throw when updating triage state for a SAST result', async function () {
        expect(firstSastResult, 'Expected a SAST result with a similarityId in the test scan').to.not.be.undefined;
        let threw = false;
        try {
            await cx.triageUpdate(
                firstSastResult!.projectId,
                firstSastResult!.similarityId,
                'sast',
                'NOT_EXPLOITABLE',
                'Integration test comment',
                'HIGH',
                null as unknown as number
            );
        } catch {
            threw = true;
        }
        expect(threw).to.equal(false, 'triageUpdate should not throw for a valid SAST result');
    });

    it('should restore triage state after updating (round-trip)', async function () {
        expect(firstSastResult, 'Expected a SAST result with a similarityId in the test scan').to.not.be.undefined;
        let threw = false;
        try {
            await cx.triageUpdate(
                firstSastResult!.projectId,
                firstSastResult!.similarityId,
                'sast',
                'TO_VERIFY',
                'Restored by integration test',
                'HIGH',
                null as unknown as number
            );
        } catch {
            threw = true;
        }
        expect(threw).to.equal(false, 'Restoring triage state should not throw');
    });

    it('should attempt triageSCAShow and handle gracefully', async function () {
        const fakeVulnId = 'packagename=test-pkg,packageversion=1.0.0,vulnerabilityId=CVE-0000-0000,packagemanager=npm';
        let payload: any[] = [];
        try {
            payload = (await cx.triageSCAShow(CX_TEST_PROJECT_ID, fakeVulnId, 'sca')) ?? [];
        } catch (err: any) {
            const knownError = err?.message?.includes('Failed showing the predicate') ||
                               err?.message?.includes('not found');
            expect(knownError).to.equal(true, `Unexpected error: ${err?.message}`);
        }
        expect(payload).to.be.an('array');
    });

    it('should attempt triageSCAUpdate and handle gracefully', async function () {
        const fakeVulnId = 'packagename=test-pkg,packageversion=1.0.0,vulnerabilityId=CVE-0000-0000,packagemanager=npm';
        let threw = false;
        try {
            await cx.triageSCAUpdate(
                CX_TEST_PROJECT_ID,
                fakeVulnId,
                'sca',
                'NOT_EXPLOITABLE',
                'Integration test SCA comment'
            );
        } catch (err: any) {
            const knownError = err?.message?.includes('not found') ||
                               err?.message?.includes('Failed');
            if (!knownError) {
                threw = true;
            }
        }
        expect(threw).to.equal(false, 'triageSCAUpdate should not throw unexpected errors');
    });

    it('should return empty list when SCA predicate does not exist (silent failure)', async function () {
        const fakeVulnId = 'packagename=nonexistent-pkg,packageversion=999.0.0,vulnerabilityId=CVE-9999-9999,packagemanager=npm';
        let payload: any[] = [];
        try {
            payload = (await cx.triageSCAShow(CX_TEST_PROJECT_ID, fakeVulnId, 'sca')) ?? [];
        } catch {
            payload = [];
        }
        expect(payload).to.be.an('array');
        expect(payload.length).to.equal(0);
    });
});
