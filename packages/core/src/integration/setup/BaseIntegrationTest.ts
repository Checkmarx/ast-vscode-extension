import * as vscode from 'vscode';
import * as path from 'path';
import { Cx } from '../../cx/cx';
import { initialize as initializeCxSingleton } from '../../cx';
import { Logs } from '../../models/logs';
import { setExtensionConfig } from '../../config/extensionConfig';
import { mock as vscodeMock } from '../../unit/mocks/vscode-mock';
import { CX_API_KEY, INVALID_API_KEY, EMPTY_API_KEY } from './Environment';

// Cx's methods read constants (e.g. getAuthCredentialSecretKey) that require the
// extension config singleton to be set, normally done during real activation.
setExtensionConfig({
    extensionId: 'ast-results',
    commandPrefix: 'ast-results',
    viewContainerPrefix: 'ast',
    displayName: 'Checkmarx',
    extensionType: 'checkmarx',
});

// The shared vscode mock hardcodes "additionalParams" to "valid-api-key" for unit tests
// (they don't care about the value). Cx.getBaseAstConfiguration() forwards that value
// straight through as a real CLI argument, which would corrupt every live CLI call here —
// so override it to an empty string for this process only.
const originalGetConfiguration = vscodeMock.workspace.getConfiguration.bind(vscodeMock.workspace);
vscodeMock.workspace.getConfiguration = ((section: string) => {
    if (section === 'checkmarxOne') {
        return {
            get: (key: string) => (key === 'additionalParams' ? '' : undefined),
        };
    }
    return originalGetConfiguration(section);
}) as typeof vscodeMock.workspace.getConfiguration;

/**
 * Builds a minimal ExtensionContext (backed by the mocked "vscode" module already
 * required by .mocharc.integration.json) with an independent, in-memory globalState
 * so cached feature flags (standalone/CxOneAssist) don't bleed across test files.
 */
function createMockContext(apiKey: string): vscode.ExtensionContext {
    const globalState = new Map<string, unknown>();
    return {
        extensionPath: path.resolve(__dirname, '../../../'),
        secrets: {
            get: async (_key: string) => apiKey || undefined,
            store: async () => undefined,
            delete: async () => undefined,
            onDidChange: () => ({ dispose: () => { /* noop */ } }),
        },
        globalState: {
            get: (key: string) => globalState.get(key),
            update: async (key: string, value: unknown) => { globalState.set(key, value); },
            keys: () => Array.from(globalState.keys()),
        },
    } as unknown as vscode.ExtensionContext;
}

/**
 * Creates a Logs instance backed by the mocked vscode output channel.
 * Integration tests don't assert on log output — this just satisfies Cx's signature.
 */
export function createLogs(): Logs {
    return new Logs(vscode.window.createOutputChannel('cx-integration-tests'));
}

/**
 * Cx instance wired with real credentials from environment variables.
 * Also wires the ../cx module-level singleton (via initialize()) to the same
 * context, since some Cx methods (e.g. AuthService.validateApiKey) reach it
 * through getCx() rather than a locally held reference.
 */
export function createCx(): Cx {
    const context = createMockContext(CX_API_KEY);
    initializeCxSingleton(context);
    return new Cx(context);
}

/** Cx with invalid API key; also wires singleton so AuthService sees invalid context */
export function createInvalidCx(): Cx {
    const context = createMockContext(INVALID_API_KEY);
    initializeCxSingleton(context);
    return new Cx(context);
}

/** Cx with empty API key; also wires singleton so AuthService sees empty context */
export function createEmptyCx(): Cx {
    const context = createMockContext(EMPTY_API_KEY);
    initializeCxSingleton(context);
    return new Cx(context);
}
