import { HoverData } from "../realtimeScanners/common/types";

/**
 * AI Fix telemetry event names
 * Centralized constants to ensure consistency across the codebase
 */
export const AI_FIX_EVENTS = {
  requested: 'ai_fix_requested',       // Initial fix request
  duplicate: 'ai_fix_duplicate',       // Duplicate fix request for same vulnerability
  mcpAdopted: 'ai_fix_mcp_adopted',   // User adopted MCP-suggested fix
  altUsed: 'ai_fix_alt_used',         // User used alternative fix
  rejected: 'ai_fix_rejected'          // User did not apply any fix
} as const;

/**
 * Scanner types supported by AI fix tracking
 */
export type ScannerType = 'Oss' | 'Secrets' | 'Asca' | 'Containers' | 'IaC';

/**
 * Possible outcomes of an AI fix suggestion
 */
export type FixOutcomeStatus =
  | 'mcp_adopted'    // User applied the MCP-suggested fix
  | 'alt_fix_used'   // User applied a different fix
  | 'fix_rejected';  // User did not apply any fix after all retries

/**
 * Issue types for MCP remediation requests
 */
export type IssueType = 'CVE' | 'malicious';

/**
 * Parameters for requesting MCP recommendation
 */
export interface McpRecommendationParams {
  scannerType: ScannerType;
  packageName?: string;
  packageVersion?: string;
  packageManager?: string;
  secretType?: string;
  imageName?: string;
  imageTag?: string;
  ruleName?: string;
  issueType?: IssueType;
  filePath: string;
  line: number;
}

/**
 * Response from MCP with remediation recommendation
 */
export interface McpRecommendation {
  suggestedVersion?: string;
  fixInstructions?: string;
  alternativePackage?: string;
  error?: string;
}

/**
 * Represents a pending AI fix that is being tracked
 */
export interface PendingAIFix {
  /** Unique identifier for this tracking instance */
  id: string;

  /** Unique key for deduplication: "scannerType:identifier:filePath" */
  vulnerabilityKey: string;

  /** Absolute path to the file being fixed */
  filePath: string;

  /** Line number where the vulnerability was detected */
  line: number;

  /** Type of scanner that detected the issue */
  scannerType: ScannerType;

  /** Severity of the vulnerability */
  severity: string;

  /** Original value before fix (version, secret pattern, etc.) */
  originalValue: string;

  /** MCP's suggested version for the fix */
  mcpSuggestedVersion?: string;

  /** Full MCP response for debugging */
  mcpFullResponse?: McpRecommendation;

  /** Timestamp when user clicked "Fix with CxOne Assist" */
  requestedAt: number;

  /** Current check iteration (0-5) */
  checkCount: number;

  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Interval between retries in milliseconds */
  retryIntervalMs: number;

  /** Timer ID for cleanup */
  timerId?: NodeJS.Timeout;

  /** Number of times user clicked fix for same vulnerability (dedup counter) */
  requestCount: number;

  /** Original hover data item for reference */
  originalItem: HoverData;
}

/**
 * Outcome of an AI fix attempt for telemetry
 */
export interface FixOutcome {
  /** Outcome status */
  status: FixOutcomeStatus;

  /** Scanner type that detected the original issue */
  scannerType: ScannerType;

  /** Severity of the original vulnerability */
  severity: string;

  /** Unique vulnerability key */
  vulnerabilityKey: string;

  /** MCP's suggested version (if applicable) */
  mcpSuggestedVersion?: string;

  /** Actual version applied by user (if different from MCP) */
  actualVersion?: string;

  /** Number of check attempts before outcome determined */
  retryCount: number;

  /** Number of duplicate fix requests for same vulnerability */
  duplicateRequests: number;
}

/**
 * Unified telemetry data sent for all fix outcomes (mcp_adopted, alt_fix_used, fix_rejected)
 * All fields are always present to ensure consistent telemetry structure
 */
export interface FixOutcomeTelemetry {
  /** MCP's suggested version - always has a value (version, action like 'remove', or 'unknown' if MCP failed) */
  mcpSuggestedVersion: string;

  /** Actual version found in file after fix attempt (or null if package removed/not found) */
  actualVersion: string | null;

  /** Outcome status: mcp_adopted, alt_fix_used, or fix_rejected */
  status: FixOutcomeStatus;

  /** Scanner type that detected the issue */
  scannerType: ScannerType;

  /** Severity of the vulnerability */
  severity: string;

  /** Relative file path where vulnerability was found */
  filePath: string;

  /** Package/item name */
  packageName: string;

  /** Original version before fix attempt */
  originalVersion: string;

  /** Version that was adopted (null if fix_rejected or package removed) */
  versionAdopted: string | null;

  /** Number of duplicate fix requests for same vulnerability */
  duplicateRequests: number;
}

/**
 * Configuration for the AI suggestion tracker
 */
export interface TrackerConfig {
  /** Interval between checks in milliseconds (default: 60000) */
  retryIntervalMs: number;

  /** Maximum number of retry attempts (default: 5) */
  maxRetries: number;

  /** Whether to also trigger check on file save (default: true) */
  checkOnSave: boolean;
}

/**
 * Default tracker configuration
 */
export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  retryIntervalMs: 60000,  // 60 seconds
  maxRetries: 5,           // 5 retries = 6 total checks over ~6 minutes
  checkOnSave: true
};

