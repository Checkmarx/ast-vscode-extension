# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo for **two Checkmarx VS Code extensions** that provide security scanning and remediation directly in the IDE. Both extensions share a common core library and are published separately to the marketplace.

- **Checkmarx One** (`packages/checkmarx`): Cloud-based scanning with full Checkmarx One account integration (SAST, SCA, IaC, Secrets)
- **Checkmarx Developer Assist** (`packages/project-ignite`): Lightweight realtime scanners (ASCA, OSS, Secrets, IaC, Containers) with MCP-based AI remediation
- **Shared Core** (`packages/core`): Common functionality used by both extensions

**Status:** Both extensions are actively maintained and published to the VS Code Marketplace (stable + pre-release channels).

## Technology Stack

- **Language:** TypeScript (compiled to JS in `out/`)
- **Runtime/Platform:** Node 18+, npm 9+, VS Code Extension API (Checkmarx One ≥ 1.63.0, Dev Assist ≥ 1.100.0)
- **Repo layout:** npm workspaces monorepo (`packages/core`, `packages/checkmarx`, `packages/project-ignite`)
- **HTTP:** axios (with `https-proxy-agent` for proxies)
- **Scanning engine:** `@checkmarx/ast-cli-javascript-wrapper` (wraps the Checkmarx CLI); KICS via Docker
- **AI:** MCP (Model Context Protocol) server; OpenAI/Gemini chat integrations
- **Tests:** Mocha + Chai + Sinon + Nock + mock-require; `vscode-extension-tester` for UI/E2E
- **No database** — state is persisted via VS Code `globalState`/`workspaceState`; secrets via VS Code `SecretStorage`

## Directory Structure

```
packages/
├── core/                          # Shared library exported as @checkmarx/vscode-core
│   ├── src/
│   │   ├── activate/             # Activation functions (activateCore, activateCxOne, activateProjectIgnite)
│   │   ├── commands/             # Command handlers (filter, group, scan, triage, etc.)
│   │   ├── realtimeScanners/     # ASCA, OSS, IaC, Secrets, Containers scanner implementations
│   │   ├── views/                # Webview components (auth, details, assist)
│   │   ├── utils/                # Utilities (config, listeners, tree items, pickers, proxy, triage)
│   │   ├── models/               # Type definitions and data models
│   │   ├── unit/                 # Unit tests
│   │   └── ...
│   └── out/                       # Compiled TypeScript output (git-ignored)
├── checkmarx/                      # Checkmarx One extension (marketplace: checkmarx.ast-results)
│   ├── src/extension.ts           # Main entry point, sets up config and calls core
│   ├── src/...                    # Extension-specific code
│   └── out/                       # Compiled output + bundled core
├── project-ignite/                # Developer Assist extension (marketplace: checkmarx.cx-dev-assist)
│   ├── src/extension.ts           # Main entry point
│   └── out/                       # Compiled output + bundled core
```

## Common Development Commands

All commands run from the root directory. Individual packages also have their own npm scripts.

### Build & Compilation

```bash
npm run build:all                  # Build all packages (core, checkmarx, cx-dev-assist)
npm run build:core                 # Build only core library
npm run build:checkmarx            # Build only Checkmarx One extension
npm run build:cx-dev-assist        # Build only Developer Assist extension

npm run clean                       # Remove all out/ directories
```

Build watches in development:

- `cd packages/core && npm run watch`
- `cd packages/checkmarx && npm run watch`
- `cd packages/project-ignite && npm run watch`

### Lint & Format

```bash
npm run lint                        # Run ESLint (fails on warnings)
npm run lint:fix                    # Run ESLint with auto-fix
```

### Testing

```bash
npm run unit:test:core             # Run mocha unit tests for core

# UI tests (requires VS Code 1.88.1)
npm run ui:test:checkmarx          # Linux/Mac UI tests
npm run win-ui:test:checkmarx      # Windows UI tests

# E2E tests (requires VS Code 1.88.1)
npm run e2e:test:checkmarx         # Linux/Mac E2E tests
npm run win-e2e:test:checkmarx     # Windows E2E tests

# Run single unit test
cd packages/core && npx mocha out/unit/YOUR_TEST_FILE.test.js
```

Test coverage:

```bash
npm run unit-coverage:test:core    # Generate coverage report
```

### Packaging & Publishing

```bash
npm run package:checkmarx          # Create VSIX for Checkmarx One
npm run package:cx-dev-assist      # Create VSIX for Developer Assist
npm run package:all                # Package both extensions

# Pre-release versions (alpha/beta)
npm run package:checkmarx:prerelease
npm run package:cx-dev-assist:prerelease

# Publish to marketplace (requires credentials)
npm run package:checkmarx:publish
npm run package:cx-dev-assist:publish
```

## Architecture & Key Patterns

### Extension Activation Pattern

Both extensions follow this pattern in their `src/extension.ts`:

1. Call `setExtensionConfig()` with extension-specific settings (ID, command prefix, display name, type)
2. Call `activateCore(context, logs)` to initialize shared functionality
3. Call `activateCxOne(context, logs)` OR `activateProjectIgnite(context, logs)` for extension-specific features

Extensions are configured via the type constant `EXTENSION_TYPE` enum.

### Core Shared Functionality

Core handles these universal concerns (see `packages/core/src/activate/`):

- **Authentication**: OAuth and API Key flows via Checkmarx CLI wrapper
- **CLI Integration**: Wraps the `@checkmarx/ast-cli-javascript-wrapper` for Checkmarx One API calls
- **Realtime Scanners**: ASCA (secure coding), OSS (dependencies), Secrets, IaC, and Containers scanners
- **KICS Scanning**: Free IaC scanning (Docker-based)
- **MCP Server**: Model Context Protocol for AI-powered remediation
- **Logging & Telemetry**: Structured logging across extensions
- **VS Code Listeners**: File save, open, workspace change handlers
- **Triage Management**: Edit result state (confirmed, not exploitable, etc.)
- **WebView Management**: Authentication and detail views

### Package Dependencies

- `@checkmarx/ast-cli-javascript-wrapper` (v0.0.155): Wraps Checkmarx CLI for scanning and result retrieval
- `axios` (1.13.5): HTTP client for API calls
- `dotenv` (^16.4.7): Environment configuration
- `jsonstream-ts`: JSON streaming for large result sets
- `jwt-decode`: Parse JWT tokens
- `validator` (13.15.22): Input validation
- `serialize-javascript`: Safe serialization for webviews
- `minimatch`: Glob pattern matching for file filtering
- `https-proxy-agent`: Proxy support for air-gapped environments

## Key Files to Know

| File                                                    | Purpose                                      |
| ------------------------------------------------------- | -------------------------------------------- |
| `packages/core/src/activate/activateCore.ts`            | Shared initialization (auth, CLI, listeners) |
| `packages/core/src/activate/activateCxOne.ts`           | Checkmarx One specific features              |
| `packages/core/src/activate/activateProjectIgnite.ts`   | Developer Assist specific features           |
| `packages/core/src/cx/index.ts`                         | Checkmarx CLI wrapper integration            |
| `packages/core/src/realtimeScanners/`                   | Realtime scanner implementations             |
| `packages/core/src/views/`                              | Webview components                           |
| `packages/core/src/utils/listener/listeners.ts`         | File save/open handlers                      |
| `packages/core/src/utils/listener/workspaceListener.ts` | Triggers rescans on workspace file changes   |
| `packages/checkmarx/src/extension.ts`                   | Checkmarx One entry point                    |
| `packages/project-ignite/src/extension.ts`              | Developer Assist entry point                 |

## Configuration & Extensibility

### Extension Configuration

Extension metadata is set via `setExtensionConfig()` in `activate()`:

- `extensionId`: Used for command prefixes, view IDs, context keys
- `commandPrefix`: Prefix for all VS Code commands
- `viewContainerPrefix`: Prefix for sidebar views
- `displayName`: Display name in UI
- `extensionType`: `EXTENSION_TYPE.CHECKMARX` or `EXTENSION_TYPE.PROJECT_IGNITE`

Context keys (used in `package.json` `when` clauses):

- `{prefix}.isValidCredentials`: User has authenticated
- `{prefix}.isScanEnabled`: Scan is allowed (varies by extension)
- `{prefix}.isStandaloneEnabled`: Running in standalone mode
- `{prefix}.createScanButton` / `cancelScanButton`: Scan button state

### Realtime Scanners

Each realtime scanner (ASCA, OSS, IaC, Secrets, Containers) implements `baseScannerService.ts`:

- Runs on file save (debounced)
- Publishes diagnostics to VS Code
- Stores results in extension state
- Can be toggled in settings

Scanners are registered in `scannerRegistry.ts` and managed by `configurationManager.ts`.

## Testing Strategy

- **Unit Tests**: Test individual functions/classes in isolation (mocked dependencies)
- **UI Tests**: Spin up VS Code instance with extension, test UI interactions
- **E2E Tests**: Full integration tests (getScan.test.js)
- **Locations**: unit in `packages/core/src/unit/`, UI/E2E in `packages/checkmarx/src/test/`, shared doubles in `packages/core/src/unit/mocks/`

When writing tests:

1. Use mocha's `describe()` and `it()` blocks
2. Use chai for assertions: `expect(value).to.equal(...)`
3. Use sinon for mocks: `sinon.stub(obj, 'method')`
4. Use nock for HTTP mocks: `nock('https://api.example.com').get('/path')`
5. Load mocks before importing modules under test

## CI/CD & Publishing

- Extensions are published via `vsce package` to the VS Code marketplace
- Both extensions use `--allow-star-activation` (activate on any file save)
- `--no-dependencies` flag means dependencies are bundled, not npm-linked
- Pre-release versions use `--pre-release` flag

## Coding Standards

- ESLint config: [.eslintrc.json](.eslintrc.json) — extends `eslint:recommended`, `@typescript-eslint/recommended`, `prettier`. `npm run lint` fails on warnings.
- Formatting handled by Prettier (no manual style debates — run `npm run lint:fix`).
- Enforced rules: `eqeqeq`, `curly`, `no-throw-literal`, `@typescript-eslint/semi`, `naming-convention`.
- All source is TypeScript; keep new code typed (avoid `any` where a model in `models/` fits).

## Project Rules (Don'ts & Constraints)

- **No direct dependency between `checkmarx` and `project-ignite`** — shared code must live in `core`.
- Don't hardcode command prefixes, view container IDs, or context keys; use the configured prefix.
- Don't commit `out/` (git-ignored, compiled output).
- Don't store credentials in `globalState`/`workspaceState` or settings — use `SecretStorage` only.
- Packaging uses `--no-dependencies` (deps are bundled); don't assume npm-linked modules at runtime.
- Webview content must be safely serialized (`serialize-javascript`) and validated (`validator`).

## External Integrations

- **Checkmarx One platform** — via the AST CLI wrapper (auth, scans, results, triage).
- **KICS** — free IaC scanning, runs in a local Docker container.
- **MCP server** — exposes AI-powered remediation to the IDE/agents.
- **AI chat** — OpenAI / Gemini ([openAIChatCommand.ts](packages/core/src/commands/openAIChatCommand.ts), [aiAssistantUtil.ts](packages/core/src/utils/aiAssistantUtil.ts)).
- **Proxy support** — `https-proxy-agent` for air-gapped environments.

## API / Interfaces

- **CLI wrapper** ([packages/core/src/cx/index.ts](packages/core/src/cx/index.ts)) is the single boundary to Checkmarx One; route all platform calls through it.
- **OAuth** — token endpoint `${baseUri}/auth/realms/${tenant}/protocol/openid-connect/token` ([authService.ts](packages/core/src/services/authService.ts)).
- **Realtime scanners** — implement `baseScannerService.ts`, registered in `scannerRegistry.ts`.
- **VS Code commands** — registered with the configured `commandPrefix`; surfaced via `package.json` contributions.

## Security & Access

- Credentials (OAuth refresh token / API key) are stored only in VS Code `SecretStorage` (`context.secrets`), keyed by `constants.getAuthCredentialSecretKey()`.
- API keys are validated before storage and deleted on validation failure ([authService.ts:307](packages/core/src/services/authService.ts#L307)).
- Context key `{prefix}.isValidCredentials` gates authenticated features.
- Never log tokens/keys; never persist secrets to state or settings.

## Logging

- Single `Logs` class ([packages/core/src/models/logs.ts](packages/core/src/models/logs.ts)) wrapping a VS Code `OutputChannel`.
- Levels: `info` / `debug` / `warn` / `error`; output appears in the **"Checkmarx"** output channel.
- A `Logs` instance is created in each `extension.ts` and threaded through `activateCore`/activate functions.

## Performance Considerations

- Realtime scanners run **debounced on file save** to avoid scan storms.
- Large result sets are parsed with `jsonstream-ts` (streaming) rather than loading whole JSON into memory.
- Extensions use eager (`*`) activation — keep activation work light and defer heavy operations.

## Debugging Steps

1. Open the **"Checkmarx"** output channel for runtime logs (`Logs` output).
2. Launch the extension with VS Code's **Run Extension** debug target (F5) from the package directory.
3. For build/sync issues: `npm run clean && npm run build:all`.
4. For scan/auth issues: verify credentials in `SecretStorage` and check `{prefix}.isValidCredentials`.
5. Reproduce CLI behavior via the wrapper in [packages/core/src/cx/](packages/core/src/cx/); KICS issues require Docker running.
6. Increase mocha timeout (`--timeout 10000`) when debugging tests.

## Common Issues & Solutions

**Build fails with "Cannot find module"**

- Run `npm run install:all` to install all dependencies
- Ensure `packages/core/out` exists: `npm run build:core`

**Tests timeout or fail**

- UI tests require VS Code 1.88.1: check the environment
- Increase mocha timeout if needed: `--timeout 10000`

**Extension doesn't activate**

- Check `activationEvents` in `package.json` (both use `*` for eager activation)
- Check logs in "Checkmarx" output channel

**Compiled code out of sync**

- Delete `packages/*/out` directories and rebuild: `npm run clean && npm run build:all`
