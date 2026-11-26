// Test fixtures. Defaults match the mock data (TEST=true). For real-tenant runs
// (TEST=uiEndToEnd) override them via env vars - see CX_TEST_* below.
export const API_KEY: string = "1";
export const SCAN_ID: string = process.env.CX_TEST_SCAN_ID || "e3b2505a-0634-4b41-8fa1-dfeb2edc26f7";
export const CX_TEST_SCAN_PROJECT_NAME: string = process.env.CX_TEST_PROJECT_NAME || "test-proj-21";
export const CX_TEST_SCAN_BRANCH_NAME: string = process.env.CX_TEST_BRANCH_NAME || "main";
export const EMPTY_RESULTS_SCAN_ID: string = process.env.CX_TEST_EMPTY_SCAN_ID || "3";
// Scan containing secret-detection findings recorded against /secrets.go (suite 12).
export const SECRETS_SCAN_ID: string = process.env.CX_TEST_SECRETS_SCAN_ID || SCAN_ID;
// Project with more than one page (20) of branches (suite 11 branch pagination).
export const CX_TEST_PAGINATION_PROJECT_NAME: string = process.env.CX_TEST_PAGINATION_PROJECT_NAME || CX_TEST_SCAN_PROJECT_NAME;
