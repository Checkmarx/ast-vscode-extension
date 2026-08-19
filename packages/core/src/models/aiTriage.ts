import { constants } from "../utils/common/constants";

/**
 * Models and helpers for the platform "AI Triage" feature.
 *
 * AI Triage is a Checkmarx One platform capability that is supported for the
 * SAST and SCA engines only (see the AI Triage & Remediation API docs). Given a
 * scan result it produces an AI-suggested triage decision (state) asynchronously.
 *
 * The shapes here mirror the documented API contract:
 *   - POST /api/ai-triage/triage                         -> {@link AiTriageAcceptedResponse}
 *   - GET  /api/ssegateway/triage-status?...             -> {@link AiTriagePhase} stream
 *   - GET  /api/aitriage/triage/{projectId}/{similarityId} -> {@link AiTriageInfo}
 */

/** Engines that support AI Triage on the platform. */
export type AiTriageEngine = "sast" | "sca";

/** The engines for which AI Triage can be offered in the UI. */
export const AI_TRIAGE_SUPPORTED_ENGINES: readonly AiTriageEngine[] = ["sast", "sca"];

/**
 * Phase reported by the triage-status SSE stream. The job starts as RUNNING and
 * transitions to COMPLETED once processing has finished.
 */
export enum AiTriagePhase {
  running = "RUNNING",
  completed = "COMPLETED",
  failed = "FAILED",
}

/** A single grouping of result IDs keyed by scanner type (request payload). */
export interface AiTriageBucket {
  scannerType: AiTriageEngine;
  resultIDs: string[];
}

/** Request payload for POST /api/ai-triage/triage. */
export interface AiTriageRequest {
  scanID: string;
  buckets: AiTriageBucket[];
}

/** Response returned by POST /api/ai-triage/triage (HTTP 202 Accepted). */
export interface AiTriageAcceptedResponse {
  scanID: string;
  status: string;
  triageID: string;
  published: boolean;
  existingTriageState: string | null;
}

/**
 * Current AI Triage information for a result
 * (GET /api/aitriage/triage/{projectId}/{similarityId}).
 *
 * The docs do not pin the exact body, so this shape is intentionally permissive
 * and consumers should go through {@link normalizeTriageInfo}.
 */
export interface AiTriageInfo {
  state?: string;
  severity?: string;
  comment?: string;
  confidence?: string | number;
  changedBy?: string;
  updatedAt?: string;
  // Preserve anything else the backend returns without losing it.
  [key: string]: unknown;
}

/** Normalized, UI-friendly triage outcome used by the view and refresh logic. */
export interface NormalizedTriageResult {
  /** Display value of the triage state, e.g. "Not Exploitable". */
  stateDisplay: string;
  /** Platform tag for the state, e.g. "NOT_EXPLOITABLE". */
  stateTag: string;
  severity?: string;
  comment?: string;
  confidence?: string;
}

/** Parameters needed to trigger and monitor an AI Triage run for one result. */
export interface AiTriageRunParams {
  scanId: string;
  projectId: string;
  engine: AiTriageEngine;
  /** Result hash / result ID used in the triage request body. */
  resultId: string;
  /** Similarity ID used to read back the resulting triage info. */
  similarityId: string;
  /** Optional group id used by the SSE monitor when available. */
  groupId?: string;
}

/**
 * Map a Checkmarx result `type` to the AI Triage engine, or undefined when the
 * type is not supported (KICS, secrets, containers, IaC, …).
 */
export function toAiTriageEngine(resultType: string | undefined): AiTriageEngine | undefined {
  const normalized = (resultType || "").toLowerCase();
  if (normalized === constants.sast) {
    return "sast";
  }
  if (normalized === constants.sca) {
    return "sca";
  }
  return undefined;
}

/** True when a result type can be triaged with AI. */
export function isAiTriageSupported(resultType: string | undefined): boolean {
  return toAiTriageEngine(resultType) !== undefined;
}

/** Normalize an arbitrary state string to its platform tag (best effort). */
export function toStateTag(state: string | undefined): string {
  if (!state) {
    return "";
  }
  const trimmed = state.trim();
  // Already a tag (e.g. "NOT_EXPLOITABLE").
  const byTag = constants.state.find((s) => s.tag.toLowerCase() === trimmed.toLowerCase());
  if (byTag) {
    return byTag.tag;
  }
  // A display value (e.g. "Not Exploitable") or spaced variant.
  const byValue = constants.state.find(
    (s) =>
      s.value.toLowerCase() === trimmed.toLowerCase() ||
      s.value.replace(/\s+/g, "").toLowerCase() === trimmed.replace(/\s+/g, "").toLowerCase()
  );
  if (byValue) {
    return byValue.tag;
  }
  // Unknown / custom state: normalize to an upper-snake tag.
  return trimmed.replace(/\s+/g, "_").toUpperCase();
}

/** Map an arbitrary state string to its human-readable display value. */
export function toStateDisplay(state: string | undefined): string {
  if (!state) {
    return "";
  }
  const trimmed = state.trim();
  const byTag = constants.state.find((s) => s.tag.toLowerCase() === trimmed.toLowerCase());
  if (byTag) {
    return byTag.value;
  }
  const byValue = constants.state.find(
    (s) => s.value.replace(/\s+/g, "").toLowerCase() === trimmed.replace(/\s+/g, "").toLowerCase()
  );
  if (byValue) {
    return byValue.value;
  }
  // Unknown / custom state: turn UPPER_SNAKE into "Upper Snake".
  return trimmed
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize an {@link AiTriageInfo} payload (or a raw state string) into the
 * UI-facing {@link NormalizedTriageResult}. Returns undefined when there is no
 * usable state, so callers can surface a "no decision" message.
 */
export function normalizeTriageInfo(
  info: AiTriageInfo | string | null | undefined
): NormalizedTriageResult | undefined {
  if (!info) {
    return undefined;
  }
  const raw = typeof info === "string" ? { state: info } : info;
  const state = raw.state;
  if (!state || typeof state !== "string" || state.trim().length === 0) {
    return undefined;
  }
  return {
    stateDisplay: toStateDisplay(state),
    stateTag: toStateTag(state),
    severity: typeof raw.severity === "string" ? raw.severity : undefined,
    comment: typeof raw.comment === "string" ? raw.comment : undefined,
    confidence:
      raw.confidence === undefined || raw.confidence === null
        ? undefined
        : String(raw.confidence),
  };
}
