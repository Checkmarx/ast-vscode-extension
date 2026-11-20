import { expect } from 'chai';
import * as sinon from 'sinon';
import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import './mocks/vscode-mock';
import './mocks/cxWrapper-mock';
import { Cx, cxLoginMessages, setExecFileForTests } from '../cx/cx';
import { setExtensionConfig, resetExtensionConfig } from '../config/extensionConfig';

type ExecCallback = (e: Error | null) => void;

describe('Cx login share', () => {
    const token = 'secret-token-value';
    let sandbox: sinon.SinonSandbox;
    let cx: Cx;
    let execFile: sinon.SinonStub;
    let warning: sinon.SinonStub;
    let logs: { error: sinon.SinonStub };
    let savedTestEnv: string | undefined;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        execFile = sandbox.stub();
        setExecFileForTests(execFile as unknown as typeof childProcess.execFile);
        warning = sandbox.stub(vscode.window, 'showWarningMessage');
        logs = { error: sandbox.stub() };
        savedTestEnv = process.env.TEST;
        delete process.env.TEST;
        cx = new Cx({} as vscode.ExtensionContext);
        setExtensionConfig({
            extensionId: 'ast-results',
            commandPrefix: 'ast-results',
            viewContainerPrefix: 'ast',
            displayName: 'Checkmarx',
            extensionType: 'checkmarx',
        });
    });

    afterEach(() => {
        setExecFileForTests();
        sandbox.restore();
        resetExtensionConfig();
        if (savedTestEnv === undefined) {
            delete process.env.TEST;
        } else {
            process.env.TEST = savedTestEnv;
        }
    });

    /** Makes every stubbed cx call finish with the given error (or none). */
    function finishWith(error: Error | null): void {
        execFile.callsFake((_file: string, _args: string[], _opts: object, cb: ExecCallback) => {
            cb(error);
            return undefined as never;
        });
    }

    /** `cx auth validate` answers `signedIn`; every other cx call succeeds. */
    function cxSignedIn(signedIn: boolean): void {
        execFile.callsFake((_file: string, args: string[], _opts: object, cb: ExecCallback) => {
            const isValidate = args[0] === 'auth' && args[1] === 'validate';
            cb(isValidate && !signedIn ? new Error('not signed in') : null);
            return undefined as never;
        });
    }

    function contextWithToken(value: string | undefined, state: Record<string, string> = {}): vscode.ExtensionContext {
        return {
            secrets: { get: async () => value },
            globalState: { get: (key: string) => state[key] },
        } as unknown as vscode.ExtensionContext;
    }

    function cxArgs(): string[][] {
        return execFile.getCalls().map((call) => call.args[1] as string[]);
    }

    describe('cx.shareLogin', () => {
        it('passes the token as an argument, with no shell', async () => {
            finishWith(null);

            const ok = await cx.shareLogin(token, logs as never);

            expect(ok).to.equal(true);
            const [, args, opts] = execFile.firstCall.args;
            expect(args).to.deep.equal(['configure', 'set', '--prop-name', 'cx_apikey', '--prop-value', token]);
            expect(opts).to.not.have.property('shell');
            expect(warning.called).to.equal(false);
        });

        it('warns and logs without the token when cx fails', async () => {
            finishWith(Object.assign(new Error('boom'), { code: 2 }));

            const ok = await cx.shareLogin(token, logs as never);

            expect(ok).to.equal(false);
            expect(logs.error.calledOnce).to.equal(true);
            expect(logs.error.firstCall.args[0]).to.not.include(token);
            expect(warning.calledOnceWith(cxLoginMessages.shareFailed)).to.equal(true);
        });

        it('does nothing during a test run, so a fake token never reaches the real cx', async () => {
            process.env.TEST = 'true';

            const ok = await cx.shareLogin(token, logs as never);

            expect(ok).to.equal(false);
            expect(execFile.called).to.equal(false);
        });

        it('stores the browser sign-in base URL and tenant before the refresh token', async () => {
            finishWith(null);

            const ok = await cx.shareLogin(token, logs as never, {
                baseUri: ' https://ast.checkmarx.net/ ',
                tenant: ' org ',
            });

            expect(ok).to.equal(true);
            expect(cxArgs()).to.deep.equal([
                ['configure', 'set', '--prop-name', 'cx_base_uri', '--prop-value', 'https://ast.checkmarx.net/'],
                ['configure', 'set', '--prop-name', 'cx_base_auth_uri', '--prop-value', 'https://ast.checkmarx.net/'],
                ['configure', 'set', '--prop-name', 'cx_tenant', '--prop-value', 'org'],
                ['configure', 'set', '--prop-name', 'cx_apikey', '--prop-value', token],
            ]);
            expect(logs.error.called).to.equal(false);
        });

        it('does not store the token when the account could not be saved', async () => {
            execFile.callsFake((_file: string, args: string[], _opts: object, cb: ExecCallback) => {
                cb(args[3] === 'cx_tenant' ? new Error('boom') : null);
                return undefined as never;
            });

            const ok = await cx.shareLogin(token, logs as never, {
                baseUri: 'https://ast.checkmarx.net',
                tenant: 'org',
            });

            expect(ok).to.equal(false);
            expect(cxArgs().some((args) => args.includes('cx_apikey'))).to.equal(false);
            expect(logs.error.firstCall.args[0]).to.not.include(token);
            expect(warning.calledOnceWith(cxLoginMessages.shareFailed)).to.equal(true);
        });
    });

    describe('cx.removeLogin', () => {
        it('clears the stored login with cx auth logout', async () => {
            finishWith(null);

            const ok = await cx.removeLogin(logs as never);

            expect(ok).to.equal(true);
            expect(cxArgs()).to.deep.equal([['auth', 'logout']]);
        });

        it('warns when cx fails', async () => {
            finishWith(new Error('boom'));

            await cx.removeLogin(logs as never);

            expect(warning.calledOnceWith(cxLoginMessages.removeFailed)).to.equal(true);
        });

        it('does nothing during a test run', async () => {
            process.env.TEST = 'true';

            await cx.removeLogin(logs as never);

            expect(execFile.called).to.equal(false);
        });
    });

    describe('syncLogin', () => {
        it('shares the token when cx has no working login', async () => {
            cxSignedIn(false);

            await new Cx(contextWithToken(token)).syncLogin(logs as never);

            expect(cxArgs()).to.deep.equal([
                ['auth', 'validate'],
                ['configure', 'set', '--prop-name', 'cx_apikey', '--prop-value', token],
            ]);
        });

        it('shares a stored browser sign-in with its base URL and tenant', async () => {
            cxSignedIn(false);

            await new Cx(contextWithToken(token, {
                lastAuthMethod: 'oauth',
                lastOAuthBaseUri: 'https://eu.ast.checkmarx.net',
                lastOAuthTenant: 'eu-org',
            })).syncLogin(logs as never);

            expect(cxArgs()).to.deep.equal([
                ['auth', 'validate'],
                ['configure', 'set', '--prop-name', 'cx_base_uri', '--prop-value', 'https://eu.ast.checkmarx.net'],
                ['configure', 'set', '--prop-name', 'cx_base_auth_uri', '--prop-value', 'https://eu.ast.checkmarx.net'],
                ['configure', 'set', '--prop-name', 'cx_tenant', '--prop-value', 'eu-org'],
                ['configure', 'set', '--prop-name', 'cx_apikey', '--prop-value', token],
            ]);
        });

        it('leaves an existing cx login alone', async () => {
            cxSignedIn(true);

            await new Cx(contextWithToken(token)).syncLogin(logs as never);

            expect(cxArgs()).to.deep.equal([['auth', 'validate']]);
        });

        it('runs no cx command when the extension has no token', async () => {
            cxSignedIn(false);

            await new Cx(contextWithToken(undefined)).syncLogin(logs as never);

            expect(execFile.called).to.equal(false);
        });

        it('does nothing during a test run', async () => {
            process.env.TEST = 'true';

            await new Cx(contextWithToken(token)).syncLogin(logs as never);

            expect(execFile.called).to.equal(false);
        });
    });
});
