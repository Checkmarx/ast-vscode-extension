import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { Cx } from '../cx/cx';
import { Logs } from '../models/logs';
import { createCx, createLogs } from './setup/BaseIntegrationTest';
import { validateRequiredEnv } from './setup/Environment';

describe('Integration: Tenant Settings', function () {
    this.timeout(60000);

    let cx: Cx;
    let logs: Logs;

    before(function () {
        validateRequiredEnv();
        cx = createCx();
        logs = createLogs();
    });

    it('should confirm scan is allowed for authenticated tenant', async function () {
        const enabled = await cx.isScanEnabled(logs);
        expect(enabled).to.be.a('boolean');
    });

    it('should return standalone enabled state without error', async function () {
        const enabled = await cx.isStandaloneEnabled(logs);
        expect(enabled).to.be.a('boolean');
    });

    it('should return guided remediation enabled state without error', async function () {
        const enabled = await cx.isAIGuidedRemediationEnabled(logs);
        expect(enabled).to.be.a('boolean');
    });

    it('should report SCA scan as always enabled', async function () {
        const enabled = await cx.isSCAScanEnabled();
        expect(enabled).to.equal(true);
    });

    it('should refresh and clear the standalone-enabled cache without throwing', async function () {
        cx.clearStandaloneEnabledCache();
        const enabled = await cx.refreshStandaloneEnabled(logs);
        expect(enabled).to.be.a('boolean');
    });

    it('should return CxOneAssist enabled state without throwing', async function () {
        const enabled = await cx.isCxOneAssistEnabled(logs);
        expect(enabled).to.be.a('boolean');
    });

    it('should return AI MCP server enabled state without unexpected crash', async function () {
        let threw = false;
        try {
            const enabled = await cx.isAiMcpServerEnabled();
            expect(enabled).to.be.a('boolean');
        } catch {
            threw = true;
        }
        expect(threw).to.equal(false, 'isAiMcpServerEnabled threw an unexpected error');
    });
});
