/**
 * Environment variable constants for integration tests.
 *
 * Required before running:
 *   CX_API_KEY           - Checkmarx One API key
 *   CX_TEST_PROJECT_ID   - UUID of an existing project to use for tests
 *   CX_TEST_BRANCH       - Branch name present in CX_TEST_PROJECT_ID
 *   CX_TEST_SCAN_ID      - UUID of a completed scan in CX_TEST_PROJECT_ID / CX_TEST_BRANCH
 *
 * Optional:
 *   CX_BASE_URI             - Base URI (only needed for explicit URI tests)
 *   CX_TENANT               - Tenant name (only needed for explicit tenant tests)
 *   CX_NOT_MATCH_PROJECT    - A project name known NOT to exist (default provided)
 *   CX_NOT_MATCH_BRANCH     - A branch name known NOT to exist (default provided)
 *
 * Values are loaded from packages/core/.env (see .env.example) when present,
 * without overriding variables already set in the shell/CI environment.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const CX_BASE_URI          = process.env.CX_BASE_URI          ?? '';
export const CX_TENANT            = process.env.CX_TENANT             ?? '';
export const CX_API_KEY           = process.env.CX_API_KEY            ?? '';
export const CX_TEST_PROJECT_ID   = process.env.CX_TEST_PROJECT_ID    ?? '';
export const CX_TEST_BRANCH       = process.env.CX_TEST_BRANCH        ?? '';
export const CX_TEST_SCAN_ID      = process.env.CX_TEST_SCAN_ID       ?? '';
export const CX_NOT_MATCH_PROJECT = process.env.CX_NOT_MATCH_PROJECT  ?? 'nonexistent-project-xyz-000';
export const CX_NOT_MATCH_BRANCH  = process.env.CX_NOT_MATCH_BRANCH   ?? 'nonexistent-branch-xyz-000';

export const INVALID_API_KEY = 'invalid-api-key-for-integration-testing-12345';
export const EMPTY_API_KEY   = '';

export function validateRequiredEnv(): void {
    const required = [
        'CX_API_KEY',
        'CX_TEST_PROJECT_ID',
        'CX_TEST_BRANCH',
        'CX_TEST_SCAN_ID',
    ];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        throw new Error(
            `Integration tests require these environment variables to be set:\n` +
            `  ${missing.join('\n  ')}\n\n` +
            `Example:\n` +
            `  export CX_API_KEY="<your-api-key>"\n` +
            `  export CX_TEST_PROJECT_ID="<project-uuid>"\n` +
            `  export CX_TEST_BRANCH="main"\n` +
            `  export CX_TEST_SCAN_ID="<scan-uuid>"`
        );
    }
}
