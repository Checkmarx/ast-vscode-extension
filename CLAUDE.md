# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **monorepo** containing two VS Code extensions for Checkmarx:
- **Checkmarx One** (`packages/checkmarx`) - Cloud-based security scanning with authentication
- **Developer Assist** (`packages/project-ignite`) - Standalone realtime scanners (ASCA, OSS, Secrets, IaC, Containers)

Both extensions share code through a **core library** (`packages/core`).

## Architecture

### Package Structure

```
packages/
├── core/              # Shared library (@checkmarx/vscode-core)
│   ├── src/
│   │   ├── activate/  # Activation functions for both extensions
│   │   ├── commands/  # VS Code commands (scan, filter, group, etc.)
│   │   ├── views/     # Tree and webview providers (results, auth, etc.)
│   │   ├── cx/        # Checkmarx API wrapper (AST CLI)
│   │   ├── services/  # Auth, MCP settings injection
│   │   ├── realtimeScanners/  # ASCA, OSS, Secrets, IaC, Containers scanners
│   │   ├── models/    # Data models for results, nodes, etc.
│   │   ├── utils/     # Common utilities (pickers, listeners, diagnostics)
│   │   └── unit/      # Unit tests (mocha)
│   └── package.json   # Exports core functionality for both extensions
│
├── checkmarx/         # Checkmarx One extension (ast-results)
│   ├── src/
│   │   ├── extension.ts    # Entry point
│   │   ├── test/           # UI and E2E tests (extest)
│   │   └── e2e/            # E2E test definitions
│   └── package.json        # VS Code extension config
│
└── project-ignite/    # Developer Assist extension (cx-dev-assist)
    ├── src/
    │   └── extension.ts    # Entry point
    └── package.json        # VS Code extension config
```

### Activation Flow

1. **Core activation** (`activateCore`) - Sets up shared infrastructure:
   - Logging system
   - Authentication service
   - MCP settings injection
   - Realtime scanners configuration
   - Common commands and listeners

2. **Extension-specific activation**:
   - **Checkmarx One**: `activateCxOne` - Cloud results provider, project/branch/scan pickers, triage
   - **Developer Assist**: `activateProjectIgnite` - Webview-based standalone scanner UI

### Key Modules

- **`cx/`**: Wrapper around Checkmarx AST CLI (`@checkmarx/ast-cli-javascript-wrapper`)
  - `cx.ts` - Main CX class (authenticate, scan, get results)
  - `cxPlatform.ts` - Platform-specific configuration

- **`realtimeScanners/`**: Lightweight scanners triggered on file save
  - `scannerRegistry.ts` - Manages scanner instances
  - `baseScannerService.ts` - Base class for all scanners
  - Each scanner (ASCA, OSS, IaC, Containers, Secrets) has its own command file

- **`views/`**: VS Code webviews and tree providers
  - Results trees (SAST, SCA results)
  - Auth webview (login/API key)
  - Assist webview (realtime scanner results)
  - Promo views (when extension not fully configured)

- **`commands/`**: VS Code command handlers
  - `scanCommand.ts` - Run scan, import results
  - `treeCommand.ts` - Tree item selection
  - `filterCommand.ts` - Filter/group results by severity, status, etc.

## Build & Development

### Install dependencies (first time)
```bash
npm run install:all
```

### Build all packages
```bash
npm run build:all
```
Or individual packages:
```bash
npm run build:core
npm run build:checkmarx
npm run build:cx-dev-assist
```

### Watch mode (for development)
From package directory:
```bash
cd packages/core && npm run watch
```

### Lint and fix
```bash
npm run lint           # Check all packages
npm run lint:fix       # Fix linting issues
```

## Testing

### Unit tests (core package only)
```bash
npm run unit:test:core              # Run all unit tests
npm run unit-coverage:test:core      # Run with coverage report

# From packages/core, run single test:
npm test -- --grep "test name pattern"
```

**Note:** Unit tests use Mocha and run TypeScript directly via ts-node. Tests are in `packages/core/src/unit/`.

### UI Tests (checkmarx package)
```bash
npm run ui:test:checkmarx           # Run UI tests (requires VS Code 1.88.1)
npm run win-ui:test:checkmarx       # Windows version
```

### E2E Tests (checkmarx package)
```bash
npm run e2e:test:checkmarx          # Requires valid credentials
npm run win-e2e:test:checkmarx
```

## Common Tasks

### Add a new realtime scanner
1. Create scanner service file: `packages/core/src/realtimeScanners/scanners/{name}/{name}ScannerService.ts`
2. Create scanner command: `packages/core/src/realtimeScanners/scanners/{name}/{name}ScannerCommand.ts`
3. Register in `scannerRegistry.ts`
4. Add configuration keys to extension package.json

### Add a VS Code command
1. Create handler in `packages/core/src/commands/` or extension-specific folder
2. Register command in the relevant package.json `contributes.commands`
3. Register command execution in activation function

### Update Checkmarx AST API wrapper
The core imports `@checkmarx/ast-cli-javascript-wrapper`. Check:
- Latest version in `packages/core/package.json`
- CLI docs: https://docs.checkmarx.com/

## Important Files

- **`packages/core/src/config/extensionConfig.ts`** - Shared configuration across both extensions
- **`packages/core/src/cx/cx.ts`** - Main API wrapper (authenticate, scan, results)
- **`packages/core/src/realtimeScanners/scannerRegistry.ts`** - Scanner initialization
- **`packages/core/src/models/results.ts`** - Result data models (SAST, SCA, IaC, etc.)
- **`packages/checkmarx/package.json`** - Checkmarx One VS Code extension manifest
- **`packages/project-ignite/package.json`** - Developer Assist VS Code extension manifest

## Development Notes

- Both extensions are **TypeScript** compiled to CommonJS
- Use `npm run build:all` before running/debugging
- VS Code extension context is passed through `activateCore` to both extensions
- Global state is managed in `utils/common/globalState.ts`
- Logging uses a custom system in `models/logs.ts`
- Webviews use media files from `packages/{extension}/media/`
