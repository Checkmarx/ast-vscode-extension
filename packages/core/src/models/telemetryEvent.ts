/**
 * Dev Assist analytics events (AST-184025).
 * Design: https://checkmarx.atlassian.net/wiki/spaces/AID/pages/10325360800
 */

export type TelemetryStatus = "Success" | "Failure";

export const TELEMETRY_TYPE = {
  install: "install",
  authentication: "authentication",
  scan: "Scan",
  click: "click",
} as const;

export const TELEMETRY_SUB_TYPE = {
  installation: "installation",
  authentication: "authentication",
  // Spelling from the design doc. Confirm with the Realtime Scanner API owner.
  scanTriggered: "scantriggerd",
} as const;

export const PLUGIN_TYPE_IDE = "IDE";
export const TELEMETRY_API_VERSION = "v2";
export const REMEDIATION_MODE_DEV_ASSIST = "DevAssist";

export const AI_PROVIDER_COPILOT = "Copilot";
export const AI_PROVIDER_CLAUDE = "Claude";
export const AI_PROVIDER_CODEX = "Codex";

export type AuthMethod = "OAuth" | "APIKey";

/** An event as raised by the extension, before the common envelope is added. */
export interface TelemetryEvent {
  type: string;
  subType: string;
  status: TelemetryStatus;
  engine?: string;
  problemSeverity?: string;
  totalCount?: number;
  aiProvider?: string;
  statusResult?: string;
  repoUrl?: string;
  eventAttributes?: { [key: string]: string | undefined };
}

/**
 * The full payload sent to the CLI wrapper.
 * Mirrors TelemetryEventOptions in @checkmarx/ast-cli-javascript-wrapper.
 */
export interface TelemetryPayload {
  aiProvider?: string;
  eventType?: string;
  subType?: string;
  engine?: string;
  problemSeverity?: string;
  scanType?: string;
  status?: string;
  totalCount?: number;
  agent?: string;
  agentVersion?: string;
  cxPluginVersion?: string;
  pluginType?: string;
  statusResult?: string;
  repoUrl?: string;
  eventAttributes?: { [key: string]: string | undefined };
}

/** Severity labels used in scan events, highest first. */
export const SEVERITY_LABELS = ["Critical", "High", "Medium", "Low", "Info"] as const;
export type SeverityLabel = typeof SEVERITY_LABELS[number];

/**
 * Maps a scanner severity or status to a telemetry label.
 * OSS and Containers "Malicious" count as Critical, "Unknown" is reported as Info,
 * and "OK" (no vulnerability) is not counted.
 */
export function toSeverityLabel(value: unknown): SeverityLabel | undefined {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "unknown";
  switch (raw) {
    case "critical":
    case "malicious":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "ok":
      return undefined;
    default:
      return "Info";
  }
}

/** A count of 0 for every severity label. */
export function createEmptySeverityCounts(): Record<SeverityLabel, number> {
  const counts = {} as Record<SeverityLabel, number>;
  for (const label of SEVERITY_LABELS) {
    counts[label] = 0;
  }
  return counts;
}

/** "Critical=1, High=0, Medium=2, Low=0, Info=0" */
export function formatSeverityCounts(counts: Record<SeverityLabel, number>): string {
  return SEVERITY_LABELS.map((label) => `${label}=${counts[label]}`).join(", ");
}

/** Reverses formatSeverityCounts. Unknown or malformed parts are ignored. */
export function parseSeverityCounts(statusResult: string | undefined): { label: SeverityLabel; count: number }[] {
  const result: { label: SeverityLabel; count: number }[] = [];
  for (const part of (statusResult ?? "").split(",")) {
    const match = part.trim().match(/^(\w+)=(\d+)$/);
    if (match && (SEVERITY_LABELS as readonly string[]).includes(match[1])) {
      result.push({ label: match[1] as SeverityLabel, count: Number(match[2]) });
    }
  }
  return result;
}

/** Maps the internal assistant ids ("copilot", "claude", "codex") to the names sent in telemetry. */
export function toAiProviderName(assistant: string | null | undefined): string | null {
  if (!assistant) {
    return null;
  }
  switch (assistant.toLowerCase()) {
    case "copilot":
      return AI_PROVIDER_COPILOT;
    case "claude":
      return AI_PROVIDER_CLAUDE;
    case "codex":
      return AI_PROVIDER_CODEX;
    default:
      return assistant;
  }
}
