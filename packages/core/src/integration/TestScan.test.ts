import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Cx } from '../cx/cx';
import { createCx } from './setup/BaseIntegrationTest';
import {
    validateRequiredEnv,
    CX_TEST_PROJECT_ID,
    CX_TEST_BRANCH,
    CX_TEST_SCAN_ID,
} from './setup/Environment';

describe('Integration: Scan Operations', function () {
    this.timeout(120000);

    let cx: Cx;

    before(function () {
        validateRequiredEnv();
        cx = createCx();
    });

    it('should retrieve scan list filtered by project and branch', async function () {
        const scans = await cx.getScans(CX_TEST_PROJECT_ID, CX_TEST_BRANCH, 10, 'Completed');
        expect(scans).to.be.an('array');
        expect(scans!.length).to.be.greaterThan(0, 'Expected at least one completed scan');
    });

    it('should return scans with expected fields (id, status, projectID)', async function () {
        const scans = await cx.getScans(CX_TEST_PROJECT_ID, CX_TEST_BRANCH, 5, 'Completed');
        expect(scans).to.be.an('array');
        for (const scan of scans!) {
            expect(scan).to.have.property('id');
            expect(scan).to.have.property('status');
            expect(scan).to.have.property('projectID');
        }
    });

    it('should return empty scan list for a non-matching project-branch pair', async function () {
        const scans = await cx.getScans(CX_TEST_PROJECT_ID, 'nonexistent-branch-xyz-000', 10, 'Completed');
        expect(scans).to.be.an('array');
        expect(scans!.length).to.equal(0, 'Expected no scans for a non-existent branch');
    });

    it('should retrieve scan details for a known scan ID', async function () {
        const scan = await cx.getScan(CX_TEST_SCAN_ID);
        expect(scan).to.not.be.undefined;
        expect(scan!.id).to.equal(CX_TEST_SCAN_ID);
    });

    it('should throw or return error for non-existent scan ID', async function () {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        let errorThrown = false;
        try {
            const scan = await cx.getScan(fakeId);
            if (!scan) {
                errorThrown = true;
            }
        } catch {
            errorThrown = true;
        }
        expect(errorThrown).to.equal(true, 'Expected an error for a non-existent scan ID');
    });

    it('should create a scan and then cancel it', async function () {
        // Create a temp source directory with a minimal file for the scan
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-integration-scan-'));
        fs.writeFileSync(path.join(tmpDir, 'hello.js'), '// integration test placeholder\n');

        let createdScanId: string | undefined;
        try {
            const scan = await cx.scanCreate('integration-test-project', 'integration-test-branch', tmpDir);
            expect(scan).to.not.be.undefined;
            createdScanId = scan.id;
            expect(createdScanId).to.be.a('string');
        } finally {
            if (createdScanId) {
                // Cancel the scan so we don't leave it running
                try { await cx.scanCancel(createdScanId); } catch { /* ignore cancel errors */ }
            }
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
