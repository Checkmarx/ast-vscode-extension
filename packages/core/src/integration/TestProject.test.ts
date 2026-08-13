import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { Cx } from '../cx/cx';
import { createCx } from './setup/BaseIntegrationTest';
import { validateRequiredEnv, CX_TEST_PROJECT_ID, CX_TEST_BRANCH } from './setup/Environment';

describe('Integration: Project Operations', function () {
    this.timeout(60000);

    let cx: Cx;

    before(function () {
        validateRequiredEnv();
        cx = createCx();
    });

    it('should retrieve project list from real backend', async function () {
        const projects = await cx.getProjectListWithParams('');
        expect(projects).to.be.an('array');
        expect(projects!.length).to.be.greaterThan(0, 'Expected at least one project in the tenant');
    });

    it('should retrieve paginated project list with correct shape', async function () {
        const projects = await cx.getProjectListWithParams('limit=5');
        expect(projects).to.be.an('array');
        for (const project of projects!) {
            expect(project).to.have.property('id');
            expect(project).to.have.property('name');
        }
    });

    it('should return project object for a known project ID', async function () {
        const project = await cx.getProject(CX_TEST_PROJECT_ID);
        expect(project).to.not.be.undefined;
        expect(project!.id).to.equal(CX_TEST_PROJECT_ID);
    });

    it('should throw or return error for a non-existent project ID', async function () {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        let errorThrown = false;
        try {
            const project = await cx.getProject(fakeId);
            if (!project) {
                errorThrown = true;
            }
        } catch {
            errorThrown = true;
        }
        expect(errorThrown).to.equal(true, 'Expected an error for a non-existent project ID');
    });

    it('should retrieve branches for a valid project', async function () {
        const branches = await cx.getBranchesWithParams(CX_TEST_PROJECT_ID);
        expect(branches).to.be.an('array');
        expect(branches).to.include(
            CX_TEST_BRANCH,
            `Expected branch "${CX_TEST_BRANCH}" to be present in branches list`
        );
    });

    it('should throw or return empty for branches of a non-existent project', async function () {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        let result: string[] = [];
        let errorThrown = false;
        try {
            result = (await cx.getBranchesWithParams(fakeId)) ?? [];
        } catch {
            errorThrown = true;
        }
        const noResults = errorThrown || result.length === 0;
        expect(noResults).to.equal(
            true,
            'Expected an error or empty branches list for a non-existent project'
        );
    });
});
