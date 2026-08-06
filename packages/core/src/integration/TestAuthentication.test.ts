import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { Cx } from '../cx/cx';
import { Logs } from '../models/logs';
import { createCx, createInvalidCx, createEmptyCx, createLogs } from './setup/BaseIntegrationTest';
import { validateRequiredEnv } from './setup/Environment';

describe('Integration: Authentication', function () {
    this.timeout(60000);

    let cx: Cx;
    let invalidCx: Cx;
    let emptyCx: Cx;
    let logs: Logs;

    before(function () {
        validateRequiredEnv();
        cx        = createCx();
        invalidCx = createInvalidCx();
        emptyCx   = createEmptyCx();
        logs      = createLogs();
    });

    it('should validate connection successfully with valid API key', async function () {
        const valid = await cx.authValidate(logs);
        expect(valid).to.equal(true, 'Expected authValidate to succeed with a valid API key');
    });

    it('should reject connection with invalid API key', async function () {
        const valid = await invalidCx.authValidate(logs);
        expect(valid).to.equal(false, 'Expected authValidate to fail with an invalid API key');
    });

    it('should handle authValidate gracefully when API key is empty', async function () {
        // Cx.authValidate() constructs CxWrapper(config) before its try/catch guard;
        // with no credentials, getAstConfiguration() resolves to undefined and the
        // wrapper constructor throws synchronously — so this rejects rather than
        // resolving to false.
        let threw = false;
        try {
            await emptyCx.authValidate(logs);
        } catch {
            threw = true;
        }
        expect(threw).to.equal(true, 'Expected authValidate to throw when no API key is configured');
    });

    it('should return result for ideScansEnabled with valid credentials', async function () {
        const enabled = await cx.isScanEnabled(logs);
        expect(enabled).to.be.a('boolean');
    });

    it('should return result for standaloneEnabled with valid credentials', async function () {
        const enabled = await cx.isStandaloneEnabled(logs);
        expect(enabled).to.be.a('boolean');
    });

    it('should return result for aiMcpServerEnabled with valid credentials', async function () {
        const enabled = await cx.isAiMcpServerEnabled();
        expect(enabled).to.be.a('boolean');
    });

    it('should validate configuration with real credentials', async function () {
        const valid = await cx.isValidConfiguration();
        expect(valid).to.equal(true, 'Expected isValidConfiguration to succeed with a valid API key');
    });
});
