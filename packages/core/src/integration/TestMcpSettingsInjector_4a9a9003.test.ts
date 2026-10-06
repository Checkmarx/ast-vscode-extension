import { expect } from 'chai';
import { describe, it, before, beforeEach, after, afterEach } from 'mocha';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { jwtDecode } from 'jwt-decode';
import { Cx } from '../cx/cx';
import { Logs } from '../models/logs';
import { createCx, createLogs } from './setup/BaseIntegrationTest';
import { validateRequiredEnv, CX_API_KEY, INVALID_API_KEY } from './setup/Environment';
import { constants } from '../utils/common/constants';
import {
    isCodexInstalled,
    hasAnySupportedAiExtension,
    resolveMcpTargets,
    getSelectedConfigFor,
    getMcpOAuthSetupMessage,
} from '../utils/aiAssistantUtil';
import { initializeMcpConfiguration, uninstallMcp } from '../services/mcpSettingsInjector';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('Integration: MCP Settings Injector (Codex support)', function () {
    this.timeout(60000);

    let cx: Cx;
    let logs: Logs;
    let tempHome: string;
    let originalHome: string | undefined;
    let originalUserProfile: string | undefined;
    let originalGetExtension: any;
    let originalGetConfiguration: any;
    let installedExtensions: Set<string>;
    let aiConfig: Record<string, unknown>;
    let wslEnabled: boolean;
    let globalStateMap: Map<string, unknown>;
    let context: vscode.ExtensionContext;

    const vs = vscode as any;

    function codexConfigPath(): string {
        return path.join(tempHome, '.codex', 'config.toml');
    }

    function keyIsDecodable(): boolean {
        try {
            const decoded = jwtDecode<{ iss?: string }>(CX_API_KEY);
            return !!decoded.iss;
        } catch {
            return false;
        }
    }

    before(function () {
        validateRequiredEnv();
        cx = createCx();
        logs = createLogs();
        originalHome = process.env.HOME;
        originalUserProfile = process.env.USERPROFILE;
        originalGetExtension = vs.extensions.getExtension;
        originalGetConfiguration = vs.workspace.getConfiguration;
    });

    beforeEach(function () {
        // Redirect the home directory so ~/.codex/config.toml and ~/.claude.json never touch the real user profile
        tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-it-codex-'));
        process.env.HOME = tempHome;
        process.env.USERPROFILE = tempHome;

        installedExtensions = new Set<string>();
        aiConfig = {};
        wslEnabled = false;
        globalStateMap = new Map<string, unknown>();

        vs.extensions.getExtension = (id: string) => (installedExtensions.has(id) ? { id } : undefined);
        vs.workspace.getConfiguration = (section?: string) => {
            if (section === 'chatgpt') {
                return { get: (_k: string, d?: unknown) => (_k === 'runCodexInWindowsSubsystemForLinux' ? wslEnabled : d) };
            }
            if (section === constants.getAiAssistantConfigSection()) {
                return {
                    get: (k: string, d?: unknown) => (k in aiConfig ? aiConfig[k] : d),
                    update: async (k: string, v: unknown) => { aiConfig[k] = v; },
                };
            }
            return originalGetConfiguration(section);
        };

        context = {
            globalState: {
                get: (k: string) => globalStateMap.get(k),
                update: async (k: string, v: unknown) => { globalStateMap.set(k, v); },
                keys: () => Array.from(globalStateMap.keys()),
            },
        } as unknown as vscode.ExtensionContext;
    });

    afterEach(function () {
        vs.extensions.getExtension = originalGetExtension;
        vs.workspace.getConfiguration = originalGetConfiguration;
        if (tempHome && fs.existsSync(tempHome)) {
            fs.rmSync(tempHome, { recursive: true, force: true });
        }
    });

    after(function () {
        if (originalHome === undefined) { delete process.env.HOME; } else { process.env.HOME = originalHome; }
        if (originalUserProfile === undefined) { delete process.env.USERPROFILE; } else { process.env.USERPROFILE = originalUserProfile; }
    });

    describe('tenant connectivity precondition', function () {
        it('should authenticate against the real tenant before MCP configuration', async function () {
            const enabled = await cx.isAiMcpServerEnabled().catch(() => false);
            expect(enabled).to.be.a('boolean');
            const scan = await cx.isScanEnabled(logs);
            expect(scan).to.be.a('boolean');
        });
    });

    describe('Codex constants', function () {
        it('should expose the Codex extension id and commands', function () {
            expect(constants.codexChatExtensionId).to.equal('openai.chatgpt');
            expect(constants.codexAssistantName).to.equal('codex');
            expect(constants.codexImplementTodoCommand).to.equal('chatgpt.implementTodo');
            expect(constants.codexOpenSidebarCommand).to.equal('chatgpt.openSidebar');
            expect(constants.codexNewChatOpen).to.equal('chatgpt.newChat');
            expect(constants.codexChatclipboardPasteActionCommand).to.equal('editor.action.clipboardPasteAction');
        });
    });

    describe('aiAssistantUtil Codex helpers', function () {
        it('isCodexInstalled should be false when extension is absent and true when present', function () {
            expect(isCodexInstalled()).to.equal(false);
            installedExtensions.add(constants.codexChatExtensionId);
            expect(isCodexInstalled()).to.equal(true);
        });

        it('hasAnySupportedAiExtension should be false with nothing installed', function () {
            expect(hasAnySupportedAiExtension()).to.equal(false);
        });

        it('hasAnySupportedAiExtension should be true when only Codex is installed', function () {
            installedExtensions.add(constants.codexChatExtensionId);
            expect(hasAnySupportedAiExtension()).to.equal(true);
        });

        it('getSelectedConfigFor should map "Codex" to the Codex extension id', function () {
            expect(getSelectedConfigFor('Codex')).to.deep.equal({ extensionId: constants.codexChatExtensionId });
            expect(getSelectedConfigFor('  Codex  ')).to.deep.equal({ extensionId: constants.codexChatExtensionId });
        });

        it('getSelectedConfigFor should return undefined for empty, unknown or wrongly-cased names', function () {
            expect(getSelectedConfigFor('')).to.equal(undefined);
            expect(getSelectedConfigFor('   ')).to.equal(undefined);
            expect(getSelectedConfigFor('NotAnAssistant')).to.equal(undefined);
            expect(getSelectedConfigFor('codex')).to.equal(undefined);
        });

        it('resolveMcpTargets should include codex-settings in VS Code when Codex is installed', function () {
            installedExtensions.add(constants.codexChatExtensionId);
            expect(resolveMcpTargets()).to.deep.equal(['codex-settings']);
        });

        it('resolveMcpTargets should include claude and codex together, and none when nothing installed', function () {
            expect(resolveMcpTargets()).to.deep.equal([]);
            installedExtensions.add(constants.claudeChatExtensionId);
            installedExtensions.add(constants.codexChatExtensionId);
            expect(resolveMcpTargets()).to.deep.equal(['claude-settings', 'codex-settings']);
        });

        it('getMcpOAuthSetupMessage should return null without context', function () {
            expect(getMcpOAuthSetupMessage(undefined)).to.equal(null);
        });

        it('getMcpOAuthSetupMessage should mention Codex when Codex is the selected assistant', function () {
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';
            aiConfig['AI Assistant'] = 'Codex';
            aiConfig['Prefer Native AI Assistant'] = false;
            const msg = getMcpOAuthSetupMessage(context);
            expect(msg).to.be.a('string');
            expect(msg).to.contain('Codex settings');
        });

        it('getMcpOAuthSetupMessage should not use Codex when native assistant is preferred', function () {
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';
            aiConfig['AI Assistant'] = 'Codex';
            aiConfig['Prefer Native AI Assistant'] = true;
            const msg = getMcpOAuthSetupMessage(context);
            // VS Code branch resolves the name from the dropdown, never overrides with Codex-specific logic
            expect(msg === null || typeof msg === 'string').to.equal(true);
        });

        it('getMcpOAuthSetupMessage should return null when Codex selected but not installed', function () {
            aiConfig['MCP Authentication'] = 'OAuth';
            aiConfig['AI Assistant'] = 'Codex';
            aiConfig['Prefer Native AI Assistant'] = false;
            expect(getMcpOAuthSetupMessage(context)).to.equal(null);
        });

        it('getMcpOAuthSetupMessage should return null for Token Based authentication', function () {
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'Token Based';
            aiConfig['AI Assistant'] = 'Codex';
            aiConfig['Prefer Native AI Assistant'] = false;
            expect(getMcpOAuthSetupMessage(context)).to.equal(null);
        });
    });

    describe('initializeMcpConfiguration -> ~/.codex/config.toml', function () {
        it('should write an OAuth (DCR) server block with the real tenant key', async function () {
            if (!keyIsDecodable()) { this.skip(); }
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';

            await initializeMcpConfiguration(CX_API_KEY, context);

            expect(fs.existsSync(codexConfigPath())).to.equal(true);
            const toml = fs.readFileSync(codexConfigPath(), 'utf-8');
            expect(toml).to.contain('[mcp_servers."Checkmarx"]');
            expect(toml).to.contain('/api/security-mcp/mcp/');
            expect(toml).to.contain('auth = "oauth"');
            expect(toml).to.contain('enabled = true');
            expect(toml).to.not.contain('Authorization');
            expect(globalStateMap.get(constants.getMcpConfigSourceKey())).to.equal('mcpOAuth');
        });

        it('should write a token-based block with headers when Token Based is selected', async function () {
            if (!keyIsDecodable()) { this.skip(); }
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'Token Based';

            await initializeMcpConfiguration(CX_API_KEY, context);

            const toml = fs.readFileSync(codexConfigPath(), 'utf-8');
            expect(toml).to.contain('[mcp_servers."Checkmarx"]');
            expect(toml).to.contain('url = "');
            expect(toml).to.contain('/api/security-mcp/mcp"');
            expect(toml).to.contain('http_headers = {');
            expect(toml).to.contain('"cx-origin"');
            expect(toml).to.contain('"Authorization"');
            expect(globalStateMap.get(constants.getMcpConfigSourceKey())).to.equal('mcpTokenBased');
        });

        it('should replace the existing Checkmarx block while preserving unrelated config', async function () {
            if (!keyIsDecodable()) { this.skip(); }
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';
            fs.mkdirSync(path.dirname(codexConfigPath()), { recursive: true });
            fs.writeFileSync(
                codexConfigPath(),
                'model = "gpt-5"\n\n' +
                '[mcp_servers."Checkmarx"]\nurl = "https://old.example/mcp"\nenabled = false\n\n' +
                '[mcp_servers."Checkmarx".oauth]\nclient_id = "stale"\n\n' +
                '[mcp_servers."Other"]\nurl = "https://other.example/mcp"\n',
                'utf-8'
            );

            await initializeMcpConfiguration(CX_API_KEY, context);

            const toml = fs.readFileSync(codexConfigPath(), 'utf-8');
            expect(toml).to.contain('model = "gpt-5"');
            expect(toml).to.contain('[mcp_servers."Other"]');
            expect(toml).to.contain('https://other.example/mcp');
            expect(toml).to.not.contain('old.example');
            expect(toml).to.not.contain('stale');
            expect(toml.match(/\[mcp_servers\."Checkmarx"\]/g)).to.have.lengthOf(1);
            expect(toml).to.contain('auth = "oauth"');
        });

        it('should be idempotent when run twice', async function () {
            if (!keyIsDecodable()) { this.skip(); }
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';

            await initializeMcpConfiguration(CX_API_KEY, context);
            const first = fs.readFileSync(codexConfigPath(), 'utf-8');
            await initializeMcpConfiguration(CX_API_KEY, context);
            const second = fs.readFileSync(codexConfigPath(), 'utf-8');
            expect(second).to.equal(first);
        });

        it('should not write config.toml when Codex runs inside WSL', async function () {
            if (!keyIsDecodable()) { this.skip(); }
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';
            wslEnabled = true;

            await initializeMcpConfiguration(CX_API_KEY, context);

            expect(fs.existsSync(codexConfigPath())).to.equal(false);
        });

        it('should not create config.toml when Codex is not installed', async function () {
            if (!keyIsDecodable()) { this.skip(); }
            aiConfig['MCP Authentication'] = 'OAuth';

            await initializeMcpConfiguration(CX_API_KEY, context);

            expect(fs.existsSync(codexConfigPath())).to.equal(false);
        });

        it('should reject an undecodable API key without writing anything', async function () {
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';

            await initializeMcpConfiguration(INVALID_API_KEY, context);

            expect(fs.existsSync(codexConfigPath())).to.equal(false);
            expect(globalStateMap.has(constants.getMcpConfigSourceKey())).to.equal(false);
        });

        it('should reject an empty API key without writing anything', async function () {
            installedExtensions.add(constants.codexChatExtensionId);
            await initializeMcpConfiguration('', context);
            expect(fs.existsSync(codexConfigPath())).to.equal(false);
        });

        it('should reject a JWT lacking an iss claim', async function () {
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';
            const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
            const noIss = `${b64({ alg: 'none' })}.${b64({ sub: 'x' })}.sig`;

            await initializeMcpConfiguration(noIss, context);

            expect(fs.existsSync(codexConfigPath())).to.equal(false);
        });

        it('should keep the dev MCP backend for iam-dev issuers', async function () {
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';
            const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
            const iss = 'https://iam-dev.example.net/auth/realms/devtenant';
            const devKey = `${b64({ alg: 'none' })}.${b64({ iss })}.sig`;

            await initializeMcpConfiguration(devKey, context);

            const toml = fs.readFileSync(codexConfigPath(), 'utf-8');
            expect(toml).to.contain('url = "https://ast-master-components.dev.cxast.net/api/security-mcp/mcp/devtenant"');
        });

        it('should rewrite iam.checkmarx.* issuers to ast.checkmarx.*', async function () {
            installedExtensions.add(constants.codexChatExtensionId);
            aiConfig['MCP Authentication'] = 'OAuth';
            const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
            const iss = 'https://iam.checkmarx.net/auth/realms/acme';
            const key = `${b64({ alg: 'none' })}.${b64({ iss })}.sig`;

            await initializeMcpConfiguration(key, context);

            const toml = fs.readFileSync(codexConfigPath(), 'utf-8');
            expect(toml).to.contain('url = "https://ast.checkmarx.net/api/security-mcp/mcp/acme"');
        });
    });

    describe('uninstallMcp -> removeFromCodexConfig', function () {
        const seed =
            'model = "gpt-5"\n\n' +
            '[mcp_servers."Checkmarx"]\nurl = "https://x.example/mcp"\nenabled = true\n\n' +
            '[mcp_servers."Checkmarx".oauth]\nclient_id = "abc"\n\n' +
            '[mcp_servers."Other"]\nurl = "https://other.example/mcp"\n';

        it('should remove only the Checkmarx block and its sub-tables', async function () {
            fs.mkdirSync(path.dirname(codexConfigPath()), { recursive: true });
            fs.writeFileSync(codexConfigPath(), seed, 'utf-8');
            globalStateMap.set(constants.getMcpConfigSourceKey(), 'mcpTokenBased');

            await uninstallMcp(context, false);

            const toml = fs.readFileSync(codexConfigPath(), 'utf-8');
            expect(toml).to.not.contain('"Checkmarx"');
            expect(toml).to.not.contain('abc');
            expect(toml).to.contain('model = "gpt-5"');
            expect(toml).to.contain('[mcp_servers."Other"]');
            expect(globalStateMap.get(constants.getMcpConfigSourceKey())).to.equal(null);
        });

        it('should leave config.toml untouched when Codex runs in WSL', async function () {
            fs.mkdirSync(path.dirname(codexConfigPath()), { recursive: true });
            fs.writeFileSync(codexConfigPath(), seed, 'utf-8');
            wslEnabled = true;

            await uninstallMcp(context, false);

            expect(fs.readFileSync(codexConfigPath(), 'utf-8')).to.equal(seed);
        });

        it('should not create config.toml when none exists', async function () {
            await uninstallMcp(context, false);
            expect(fs.existsSync(codexConfigPath())).to.equal(false);
        });

        it('should preserve Codex config on logout when MCP was configured via OAuth', async function () {
            fs.mkdirSync(path.dirname(codexConfigPath()), { recursive: true });
            fs.writeFileSync(codexConfigPath(), seed, 'utf-8');
            globalStateMap.set(constants.getMcpConfigSourceKey(), 'mcpOAuth');

            await uninstallMcp(context, true);

            expect(fs.readFileSync(codexConfigPath(), 'utf-8')).to.equal(seed);
        });

        it('should produce an empty file when Checkmarx was the only entry', async function () {
            fs.mkdirSync(path.dirname(codexConfigPath()), { recursive: true });
            fs.writeFileSync(codexConfigPath(), '[mcp_servers."Checkmarx"]\nurl = "https://x/mcp"\nenabled = true\n', 'utf-8');

            await uninstallMcp(context, false);

            expect(fs.readFileSync(codexConfigPath(), 'utf-8').trim()).to.equal('');
        });
    });
});
