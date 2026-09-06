import * as vscode from "vscode";
import { AstResult } from "../../models/results";
import { commands } from "../../utils/common/commandBuilder";
import { constants } from "../../utils/common/constants";
import { getFromState, Item } from "../../utils/common/globalState";
import { Logs } from "../../models/logs";
import { getMessages } from "../../config/extensionMessages";
import {
  getNonce,
  getResultsFilePath,
  readResultsFromFile,
} from "../../utils/utils";
import {
  AiTriageEngine,
  isAiTriageSupported,
  toAiTriageEngine,
  toStateDisplay,
} from "../../models/aiTriage";
import type { AiTriagePayload } from "../../commands/aiTriageCommand";
import { AiTriageService } from "../../services/aiTriageService";
import { cx } from "../../cx";

/** A single row rendered in the AI Triage table (one triage-able result). */
export interface AiTriageRow {
  resultId: string;
  similarityId: string;
  /** Platform-wide risk hash — the key the Risks API's `id`/`hash` correlates to. */
  alternateId: string;
  engine: AiTriageEngine;
  resultType: string;
  severity: string;
  status: string;
  stateDisplay: string;
  name: string;
  description: string;
  /** Risk name from the platform's Risks API, resolved lazily after the initial render. */
  riskName?: string;
}

/** Strip HTML tags/entities and collapse whitespace for a short description. */
export function cleanDescription(input: unknown, maxLen = 160): string {
  const text = String(input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen - 1).trimEnd()}…` : text;
}

/** Escape a string for safe interpolation into HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Duck-typed subset of {@link AstResult} needed to build a row. */
interface ResultLike {
  type?: string;
  severity?: string;
  status?: string;
  state?: string;
  similarityId?: string;
  label?: string;
  queryName?: string;
  description?: string;
  id?: string;
  // Platform-wide risk hash — the correlation key shared with the Risks API's
  // `id`/`hash` (also used to match ASPM results in riskManagementView.ts).
  alternateId?: string;
  getResultHash?: () => string;
}

/** Map a single result to a table row, or undefined when not triage-able. */
export function mapResultToRow(result: ResultLike): AiTriageRow | undefined {
  const engine = toAiTriageEngine(result.type);
  if (!engine || !isAiTriageSupported(result.type)) {
    return undefined;
  }
  const resultId = result.getResultHash?.() || result.id || "";
  const similarityId = result.similarityId || "";
  if (!resultId || !similarityId) {
    return undefined;
  }
  return {
    resultId,
    similarityId,
    alternateId: result.alternateId || "",
    engine,
    resultType: result.type as string,
    severity: (result.severity || "").toUpperCase(),
    status: result.status || "",
    stateDisplay: toStateDisplay(result.state) || "To Verify",
    name: result.queryName || result.label || result.id || similarityId,
    description: cleanDescription(result.description),
  };
}

/** Map a list of results to triage-able rows (filters out unsupported types). */
export function mapResultsToRows(results: ResultLike[] | undefined): AiTriageRow[] {
  if (!results || !Array.isArray(results)) {
    return [];
  }
  const rows: AiTriageRow[] = [];
  for (const result of results) {
    const row = mapResultToRow(result);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

const SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: "sev-critical",
  HIGH: "sev-high",
  MEDIUM: "sev-medium",
  LOW: "sev-low",
  INFO: "sev-info",
};

/**
 * A finding is considered already triaged when it carries a non-default state
 * (anything other than "To Verify"). Used to show the completed icon for
 * findings triaged earlier in the IDE or on the platform.
 */
export function isTriagedState(stateDisplay: string | undefined): boolean {
  const s = (stateDisplay || "").trim().toLowerCase();
  return s.length > 0 && s !== "to verify";
}

/**
 * Classify a triage change author as AI or Manual, from the predicate's
 * `CreatedBy` (and comment). AI-authored triages come from a system/AI account;
 * anything else is treated as a manual (human) triage.
 */
export function classifyTriageSource(
  author: string | undefined,
  comment?: string | undefined
): "AI" | "Manual" {
  const a = (author || "").toLowerCase();
  const c = (comment || "").toLowerCase();
  const aiMarkers = /\b(ai|pansophia|risk[- ]?orchestration|checkmarx[- ]?(ai|assist)|system|bot)\b/;
  if (!a || aiMarkers.test(a) || /\bai\b/.test(c) || c.includes("generated")) {
    return "AI";
  }
  return "Manual";
}

/**
 * Every plausible identifier a Risks API item might be looked up by, lower-cased.
 * For SCA findings the decisive one is `riskName` itself: it's the CVE ID (or
 * internal "Cx..." ID when there's no CVE) in upper/mixed case, while the matching
 * local scan result's `id`/`similarityId` carry the *same* value lower-cased
 * (confirmed against a real captured scan sample, e.g. local `id: "cve-2011-3374"`
 * vs. a Risks API `riskName: "CVE-2011-3374"`). The rest are kept as fallbacks for
 * engines/deployments where that isn't true.
 */
function riskLookupKeys(item: Record<string, unknown>, riskName: string): string[] {
  const keys: unknown[] = [
    riskName,
    item.similarityId,
    item.similarity_id,
    item.groupId,
    item.group_id,
    item.hash,
    item.id,
  ];
  return keys
    .filter((key) => key !== undefined && key !== null && String(key).length > 0)
    .map((key) => String(key).toLowerCase());
}

/**
 * Look up a row in a Risks-API-derived map, trying every identifier the row could
 * plausibly be indexed under (case-insensitively), most-likely first.
 */
export function lookupByRow<T>(map: Record<string, T>, row: AiTriageRow): T | undefined {
  for (const key of [row.alternateId, row.similarityId, row.resultId]) {
    if (key) {
      const hit = map[key.toLowerCase()];
      if (hit !== undefined) {
        return hit;
      }
    }
  }
  return undefined;
}

/**
 * Build a source map from the Risks API response, keyed by every plausible
 * identifier (see {@link riskLookupKeys}). Each risk item carries `stateChangedBy`
 * ("AI" | "manual" | "unchanged"); "unchanged" is omitted so those findings render
 * as untriaged.
 */
export function buildSourceMapFromRisks(
  risks: Array<Record<string, unknown>> | undefined
): Record<string, "AI" | "Manual"> {
  const map: Record<string, "AI" | "Manual"> = {};
  for (const item of risks || []) {
    if (!item || typeof item !== "object") {
      continue;
    }
    // Determine the triage source: stateChangedBy is authoritative
    // ("AI" | "manual" | "unchanged"); fall back to the isAiGenerated flag.
    const changedBy = String(item.stateChangedBy ?? item.state_changed_by ?? "").toLowerCase();
    let source: "AI" | "Manual" | undefined;
    if (changedBy === "ai") {
      source = "AI";
    } else if (changedBy === "manual") {
      source = "Manual";
    } else if (changedBy === "unchanged") {
      source = undefined;
    } else if (item.isAiGenerated === true) {
      source = "AI";
    }
    if (!source) {
      continue;
    }
    const riskName = String(item.riskName ?? item.risk_name ?? "").trim();
    for (const key of riskLookupKeys(item, riskName)) {
      map[key] = source;
    }
  }
  return map;
}

/**
 * Build a riskName map from the Risks API response (`riskName`), keyed by every
 * plausible identifier (see {@link riskLookupKeys}).
 */
export function buildRiskNameMapFromRisks(
  risks: Array<Record<string, unknown>> | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of risks || []) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const riskName = String(item.riskName ?? item.risk_name ?? "").trim();
    if (!riskName) {
      continue;
    }
    for (const key of riskLookupKeys(item, riskName)) {
      map[key] = riskName;
    }
  }
  return map;
}

const ENGINE_LABEL: Record<string, string> = { sast: "SAST", sca: "SCA" };

/** Sliders/filter icon reused from the risk management view for visual consistency. */
const FILTER_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.00033 3.33338C5.82351 3.33338 5.65395 3.40362 5.52892 3.52864C5.4039 3.65367 5.33366 3.82324 5.33366 4.00005C5.33366 4.17686 5.4039 4.34643 5.52892 4.47145C5.65395 4.59648 5.82351 4.66671 6.00033 4.66671C6.17714 4.66671 6.34671 4.59648 6.47173 4.47145C6.59675 4.34643 6.66699 4.17686 6.66699 4.00005C6.66699 3.82324 6.59675 3.65367 6.47173 3.52864C6.34671 3.40362 6.17714 3.33338 6.00033 3.33338ZM4.11366 3.33338C4.25139 2.94302 4.50682 2.605 4.84473 2.36591C5.18263 2.12681 5.58638 1.99841 6.00033 1.99841C6.41427 1.99841 6.81802 2.12681 7.15593 2.36591C7.49383 2.605 7.74926 2.94302 7.88699 3.33338H12.667C12.8438 3.33338 13.0134 3.40362 13.1384 3.52864C13.2634 3.65367 13.3337 3.82324 13.3337 4.00005C13.3337 4.17686 13.2634 4.34643 13.1384 4.47145C13.0134 4.59648 12.8438 4.66671 12.667 4.66671H7.88699C7.74926 5.05707 7.49383 5.39509 7.15593 5.63419C6.81802 5.87328 6.41427 6.00168 6.00033 6.00168C5.58638 6.00168 5.18263 5.87328 4.84473 5.63419C4.50682 5.39509 4.25139 5.05707 4.11366 4.66671H3.33366C3.15685 4.66671 2.98728 4.59648 2.86225 4.47145C2.73723 4.34643 2.66699 4.17686 2.66699 4.00005C2.66699 3.82324 2.73723 3.65367 2.86225 3.52864C2.98728 3.40362 3.15685 3.33338 3.33366 3.33338H4.11366ZM10.0003 7.33338C9.82351 7.33338 9.65395 7.40362 9.52892 7.52864C9.4039 7.65367 9.33366 7.82324 9.33366 8.00005C9.33366 8.17686 9.4039 8.34643 9.52892 8.47145C9.65395 8.59648 9.82351 8.66671 10.0003 8.66671C10.1771 8.66671 10.3467 8.59648 10.4717 8.47145C10.5968 8.34643 10.667 8.17686 10.667 8.00005C10.667 7.82324 10.5968 7.65367 10.4717 7.52864C10.3467 7.40362 10.1771 7.33338 10.0003 7.33338ZM8.11366 7.33338C8.25139 6.94303 8.50682 6.605 8.84473 6.36591C9.18263 6.12681 9.58638 5.99841 10.0003 5.99841C10.4143 5.99841 10.818 6.12681 11.1559 6.36591C11.4938 6.605 11.7493 6.94303 11.887 7.33338H12.667C12.8438 7.33338 13.0134 7.40362 13.1384 7.52864C13.2634 7.65367 13.3337 7.82324 13.3337 8.00005C13.3337 8.17686 13.2634 8.34643 13.1384 8.47145C13.0134 8.59648 12.8438 8.66671 12.667 8.66671H11.887C11.7493 9.05707 11.4938 9.39509 11.1559 9.63419C10.818 9.87328 10.4143 10.0017 10.0003 10.0017C9.58638 10.0017 9.18263 9.87328 8.84473 9.63419C8.50682 9.39509 8.25139 9.05707 8.11366 8.66671H3.33366C3.15685 8.66671 2.98728 8.59648 2.86225 8.47145C2.73723 8.34643 2.66699 8.17686 2.66699 8.00005C2.66699 7.82324 2.73723 7.65367 2.86225 7.52864C2.98728 7.40362 3.15685 7.33338 3.33366 7.33338H8.11366ZM6.00033 11.3334C5.82351 11.3334 5.65395 11.4036 5.52892 11.5286C5.4039 11.6537 5.33366 11.8232 5.33366 12C5.33366 12.1769 5.4039 12.3464 5.52892 12.4715C5.65395 12.5965 5.82351 12.6667 6.00033 12.6667C6.17714 12.6667 6.34671 12.5965 6.47173 12.4715C6.59675 12.3464 6.66699 12.1769 6.66699 12C6.66699 11.8232 6.59675 11.6537 6.47173 11.5286C6.34671 11.4036 6.17714 11.3334 6.00033 11.3334ZM4.11366 11.3334C4.25139 10.943 4.50682 10.605 4.84473 10.3659C5.18263 10.1268 5.58638 9.99841 6.00033 9.99841C6.41427 9.99841 6.81802 10.1268 7.15593 10.3659C7.49383 10.605 7.74926 10.943 7.88699 11.3334H12.667C12.8438 11.3334 13.0134 11.4036 13.1384 11.5286C13.2634 11.6537 13.3337 11.8232 13.3337 12C13.3337 12.1769 13.2634 12.3464 13.1384 12.4715C13.0134 12.5965 12.8438 12.6667 12.667 12.6667H7.88699C7.74926 13.0571 7.49383 13.3951 7.15593 13.6342C6.81802 13.8733 6.41427 14.0017 6.00033 14.0017C5.58638 14.0017 5.18263 13.8733 4.84473 13.6342C4.50682 13.3951 4.25139 13.0571 4.11366 12.6667H3.33366C3.15685 12.6667 2.98728 12.5965 2.86225 12.4715C2.73723 12.3464 2.66699 12.1769 2.66699 12C2.66699 11.8232 2.73723 11.6537 2.86225 11.5286C2.98728 11.4036 3.15685 11.3334 3.33366 11.3334H4.11366Z" fill="currentColor" /></svg>`;

/** Build the engine-filter dropdown (button + checkbox menu) from the distinct engines present in `rows`. */
function renderEngineFilter(rows: AiTriageRow[]): string {
  const engines = Array.from(new Set(rows.map((r) => r.engine))).sort();
  if (engines.length === 0) {
    return "";
  }
  const options = engines
    .map(
      (engine) => `<label class="filter-item">
        <input type="checkbox" class="engine-checkbox" value="${escapeHtml(engine)}" checked />
        <span>${escapeHtml(ENGINE_LABEL[engine] || engine.toUpperCase())}</span>
      </label>`
    )
    .join("");
  return `<div class="filter-wrap">
    <button class="filter-btn" id="engineFilterBtn" title="Filter by engine" aria-label="Filter by engine">
      <span class="filter-icon">${FILTER_ICON}</span>
    </button>
    <div class="filter-menu" id="engineFilterMenu">
      <div class="filter-menu-title">Engine</div>
      ${options}
    </div>
  </div>`;
}

/** Inner HTML badge for the "Triaged By" cell for a known source. */
export function sourceBadgeHtml(source: "AI" | "Manual"): string {
  return source === "AI"
    ? `<span class="src-ai" title="Triaged by AI">AI</span>`
    : `<span class="src-manual" title="Triaged manually">Manual</span>`;
}

function renderSourceCell(row: AiTriageRow, source: string | undefined): string {
  if (source === "AI" || source === "Manual") {
    return sourceBadgeHtml(source);
  }
  if (isTriagedState(row.stateDisplay)) {
    // Triaged, but the author hasn't been resolved yet (filled in asynchronously).
    return `<span class="src-triaged" title="Triaged (source pending)">Triaged</span>`;
  }
  return `<span class="src-none">—</span>`;
}

function renderRow(
  row: AiTriageRow,
  triagedIds: Set<string>,
  sourceBySimilarity: Record<string, string>,
  riskNameBySimilarity: Record<string, string>
): string {

  const sevClass = SEVERITY_CLASS[row.severity] || "sev-info";
  const payload: AiTriagePayload = {
    resultId: row.resultId,
    similarityId: row.similarityId,
    resultType: row.resultType,
    engine: row.engine,
    currentState: row.stateDisplay,
    severity: row.severity,
    label: row.name,
  };
  const encoded = escapeHtml(JSON.stringify(payload));
  const source = triagedIds.has(row.similarityId) ? "AI" : sourceBySimilarity[row.similarityId];
  const riskName = row.riskName || riskNameBySimilarity[row.similarityId] || "";

  const isDecided = triagedIds.has(row.similarityId) || isTriagedState(row.stateDisplay);
  const doneIcon = isDecided
    ? `<span class="ai-done" title="Triaged">✦</span> `
    : "";
  return `<tr data-similarity="${escapeHtml(row.similarityId)}" data-payload="${encoded}" data-engine="${escapeHtml(row.engine)}">
    <td><span class="badge ${sevClass}">${escapeHtml(row.severity || "N/A")}</span></td>
    <td><span class="badge engine">${escapeHtml(row.engine.toUpperCase())}</span></td>
    <td class="riskname" data-sim="${escapeHtml(row.similarityId)}" title="${escapeHtml(riskName)}">${riskName ? escapeHtml(riskName) : '<span class="src-none">—</span>'}</td>
    <td class="name" title="${escapeHtml(row.name + (row.description ? " — " + row.description : ""))}">
      <span class="vname">${escapeHtml(row.name)}</span>${row.description ? `<span class="vdesc">${escapeHtml(row.description)}</span>` : ""}
    </td>
    <td class="state">${doneIcon}${escapeHtml(row.stateDisplay)}</td>
    <td class="source" data-sim="${escapeHtml(row.similarityId)}">${renderSourceCell(row, source)}</td>

  </tr>`;
}

/** Build the full webview HTML for the AI Triage table (pure / testable). */
export function buildAiTriageHtml(params: {
  rows: AiTriageRow[];
  projectName?: string;
  scanId?: string;
  productName: string;
  nonce: string;
  authenticated: boolean;
  isLatestScan?: boolean;
  triagedIds?: Set<string>;
  sourceBySimilarity?: Record<string, string>;
  riskNameBySimilarity?: Record<string, string>;

}): string {
  const { rows, projectName, scanId, productName, nonce, authenticated } = params;
  const isLatestScan = params.isLatestScan ?? true;
  const triagedIds = params.triagedIds ?? new Set<string>();
  const sourceBySimilarity = params.sourceBySimilarity ?? {};
  const riskNameBySimilarity = params.riskNameBySimilarity ?? {};

  const header = `<div class="details-row">
      <div class="details">
        <div class="ellipsis">Project: ${escapeHtml(projectName || "—")}</div>
        <div class="ellipsis">Scan: ${escapeHtml(scanId || "—")}</div>
      </div>
      <div class="header-controls">
        <input type="text" id="triageSearchInput" class="search-input" placeholder="Filter by severity, engine, risk name, vulnerability, or state" />
        ${renderEngineFilter(rows)}
      </div>
    </div>`;

  let body: string;
  if (!authenticated) {
    body = `<div class="message">Authentication to Checkmarx One is required to use AI Triage and Remediation.</div>`;
  } else if (!projectName || !scanId) {
    body = `<div class="message">Select a project and scan in the Checkmarx One Results view to see triage-able SAST/SCA findings.</div>`;
  } else if (!isLatestScan) {
    body = `<div class="message">AI Triage and Remediation is only available for the latest scan. Select the latest scan for this project/branch in the Checkmarx One Results view.</div>`;
  } else if (rows.length === 0) {
    body = `<div class="message">No SAST or SCA findings available to triage for the selected scan.</div>`;
  } else {
    body = `${header}
      <table class="triage-table">
        <thead>
          <tr>
            <th>Severity</th><th>Engine</th><th>RiskName</th><th>Vulnerability</th><th>State</th><th>Triaged By</th>
          </tr>
        </thead>
          <tbody>${rows.map((r) => renderRow(r, triagedIds, sourceBySimilarity, riskNameBySimilarity)).join("")}</tbody>
      </table>
        <div class="hint">Right-click a row to access <b>Triage with AI</b> or <b>Remediate with AI</b> options.</div>`;
  }

  const csp =
    `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(productName)} AI Triage and Remediation</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 6px 8px; font-size: 12px; }
    .details-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
    .details { display:flex; gap:16px; color: var(--vscode-descriptionForeground); min-width:0; }
    .ellipsis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:50%; }
    .header-controls { display:flex; align-items:center; gap:8px; flex-shrink:0; }
    .search-input { width:260px; max-width:40vw; padding:3px 8px; font-size:12px; font-family:var(--vscode-font-family); color: var(--vscode-input-foreground); background: var(--vscode-input-background); border:1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius:4px; }
    .search-input:focus { outline:1px solid var(--vscode-focusBorder); outline-offset:-1px; }
    .filter-wrap { position:relative; flex-shrink:0; }
    .filter-btn { display:flex; align-items:center; justify-content:center; width:24px; height:24px; border:1px solid var(--vscode-panel-border); border-radius:4px; background:transparent; color: var(--vscode-foreground); cursor:pointer; padding:0; }
    .filter-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
    .filter-btn.active { border-color: var(--vscode-focusBorder); color: var(--vscode-focusBorder); }
    .filter-icon svg { display:block; }
    .filter-menu { display:none; position:absolute; right:0; top:28px; z-index:1000; min-width:140px; background: var(--vscode-menu-background, var(--vscode-editorWidget-background)); color: var(--vscode-menu-foreground, var(--vscode-foreground)); border:1px solid var(--vscode-menu-border, var(--vscode-panel-border)); border-radius:5px; box-shadow:0 2px 8px rgba(0,0,0,0.3); padding:6px 0; }
    .filter-menu.show { display:block; }
    .filter-menu-title { padding:4px 12px; font-weight:600; font-size:11px; color: var(--vscode-descriptionForeground); text-transform:uppercase; }
    .filter-item { display:flex; align-items:center; gap:6px; padding:4px 12px; cursor:pointer; white-space:nowrap; }
    .filter-item:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground)); }
    .message { padding:12px; color: var(--vscode-descriptionForeground); }
    .hint { margin-top:8px; color: var(--vscode-descriptionForeground); font-size:11px; }
    table.triage-table { width:100%; border-collapse:collapse; }
    table.triage-table th { text-align:left; padding:4px 6px; border-bottom:1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-weight:600; }
    table.triage-table td { padding:6px; border-bottom:1px solid var(--vscode-panel-border); vertical-align:middle; }
    table.triage-table tbody tr { cursor: pointer; }
    table.triage-table tr:hover { background: var(--vscode-list-hoverBackground); }
    td.riskname { max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    td.name { max-width:520px; }
    td.name .vname { font-weight:600; }
    td.name .vdesc { display:block; color: var(--vscode-descriptionForeground); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:520px; }
    td.action { width:28px; text-align:center; }
    .badge { display:inline-block; padding:1px 8px; border-radius:10px; border:1px solid transparent; font-size:11px; white-space:nowrap; }
    .badge.engine { border-color: var(--vscode-panel-border); }
    .sev-critical { color:#e5484d; border-color:#e5484d; }
    .sev-high { color:#f5a623; border-color:#f5a623; }
    .sev-medium { color:#e2b203; border-color:#e2b203; }
    .sev-low { color:#3aa675; border-color:#3aa675; }
    .sev-info { color: var(--vscode-descriptionForeground); border-color: var(--vscode-panel-border); }
    .ai-done { color:#8a63d2; font-weight:700; }
    .src-ai { display:inline-block; padding:1px 8px; border-radius:10px; border:1px solid #8a63d2; color:#8a63d2; font-size:11px; }
    .src-manual { display:inline-block; padding:1px 8px; border-radius:10px; border:1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size:11px; }
    .src-triaged { color: var(--vscode-descriptionForeground); font-size:11px; font-style:italic; }
    .src-none { color: var(--vscode-descriptionForeground); }
    .kebab { cursor:pointer; border:none; background:transparent; color: var(--vscode-foreground); font-size:15px; line-height:1; padding:0 4px; border-radius:4px; }
    .kebab:hover { background: var(--vscode-toolbar-hoverBackground); }
    .ctx-menu { position:absolute; z-index:1000; min-width:170px; background: var(--vscode-menu-background, var(--vscode-editorWidget-background)); color: var(--vscode-menu-foreground, var(--vscode-foreground)); border:1px solid var(--vscode-menu-border, var(--vscode-panel-border)); border-radius:5px; box-shadow:0 2px 8px rgba(0,0,0,0.3); padding:4px 0; }
    .ctx-item { padding:5px 12px; cursor:pointer; white-space:nowrap; }
    .ctx-item:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-activeSelectionBackground)); color: var(--vscode-menu-selectionForeground, var(--vscode-list-activeSelectionForeground)); }
    .spark { color:#8a63d2; }
    td.state.busy { color: var(--vscode-descriptionForeground); font-style:italic; }
  </style>
</head>
<body>
  ${body}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let menuEl = null;
    function cssEsc(s){ return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s); }
    function hideMenu(){ if (menuEl){ menuEl.remove(); menuEl = null; } }

    function setBusy(simId, cmd){
      const row = document.querySelector('tr[data-similarity="' + cssEsc(simId) + '"]');
      if (!row) { return; }
      const st = row.querySelector('td.state');
      if (st && st.getAttribute('data-prev') === null) {
        st.setAttribute('data-prev', st.innerHTML);
        st.classList.add('busy');
          st.textContent = cmd === 'remediateWithAI' ? 'Remediating…' : 'Triaging…';
      }
    }
    function clearBusy(simId){
      const row = document.querySelector('tr[data-similarity="' + cssEsc(simId) + '"]');
      const st = row && row.querySelector('td.state');
      if (st && st.getAttribute('data-prev') !== null){
        st.innerHTML = st.getAttribute('data-prev');
        st.removeAttribute('data-prev');
        st.classList.remove('busy');
      }
    }
    function showMenu(x, y, payloadStr){
      hideMenu();
      let p; try { p = JSON.parse(payloadStr); } catch(e){ return; }
      menuEl = document.createElement('div');
      menuEl.className = 'ctx-menu';
      menuEl.style.left = x + 'px';
      menuEl.style.top = y + 'px';
      [['triageWithAI','✦ Triage with AI'], ['remediateWithAI','✦ Remediate with AI']].forEach(function(pair){
        const it = document.createElement('div');
        it.className = 'ctx-item';
        it.innerHTML = '<span class="spark">✦</span> ' + pair[1].replace('✦ ','');
        it.addEventListener('click', function(ev){
          ev.stopPropagation();
          setBusy(p.similarityId, pair[0]);
          console.log('[AI Triage/Remediation] sending "' + pair[0] + '" with payload:', JSON.stringify(p, null, 2));
          vscode.postMessage({ command: pair[0], payload: p });
          hideMenu();
        });
        menuEl.appendChild(it);
      });
      document.body.appendChild(menuEl);
    }
    document.addEventListener('click', hideMenu);
    document.addEventListener('scroll', hideMenu, true);
    let applyFilters = function(){};
    (function setupFilters(){
      const btn = document.getElementById('engineFilterBtn');
      const menu = document.getElementById('engineFilterMenu');
      const searchInput = document.getElementById('triageSearchInput');
      const checkboxes = menu ? Array.from(menu.querySelectorAll('.engine-checkbox')) : [];
      if (btn && menu) {
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          menu.classList.toggle('show');
        });
        document.addEventListener('click', function(e){
          if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.remove('show');
          }
        });
      }
      function rowMatchesSearch(row, term){
        if (!term) { return true; }
        const sevText = (row.querySelector('td:nth-child(1)') || {}).textContent || '';
        const engineText = (row.querySelector('td:nth-child(2)') || {}).textContent || '';
        const riskText = (row.querySelector('td.riskname') || {}).textContent || '';
        const nameText = (row.querySelector('td.name') || {}).textContent || '';
        const stateText = (row.querySelector('td.state') || {}).textContent || '';
        const haystack = (sevText + ' ' + engineText + ' ' + riskText + ' ' + nameText + ' ' + stateText).toLowerCase();
        return haystack.indexOf(term) !== -1;
      }
      applyFilters = function(){
        const selected = checkboxes.length ? checkboxes.filter(function(cb){ return cb.checked; }).map(function(cb){ return cb.value; }) : null;
        if (btn) { btn.classList.toggle('active', !!selected && selected.length !== checkboxes.length); }
        const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const rows = document.querySelectorAll('tr[data-engine]');
        let anyVisible = false;
        rows.forEach(function(row){
          const engineOk = !selected || selected.indexOf(row.getAttribute('data-engine')) !== -1;
          const searchOk = rowMatchesSearch(row, term);
          const show = engineOk && searchOk;
          row.style.display = show ? '' : 'none';
          if (show) { anyVisible = true; }
        });
        let emptyRow = document.getElementById('filterEmptyRow');
        const tbody = document.querySelector('table.triage-table tbody');
        if (!anyVisible && tbody) {
          if (!emptyRow) {
            emptyRow = document.createElement('tr');
            emptyRow.id = 'filterEmptyRow';
            const td = document.createElement('td');
            td.colSpan = 6;
            td.style.textAlign = 'center';
            td.style.padding = '12px';
            td.style.color = 'var(--vscode-descriptionForeground)';
            td.textContent = 'No findings match the current filters.';
            emptyRow.appendChild(td);
            tbody.appendChild(emptyRow);
          }
          emptyRow.style.display = '';
        } else if (emptyRow) {
          emptyRow.style.display = 'none';
        }
      };
      checkboxes.forEach(function(cb){ cb.addEventListener('change', applyFilters); });
      if (searchInput) { searchInput.addEventListener('input', applyFilters); }
    })();
    document.querySelectorAll('tr[data-similarity]').forEach(function(row){
      const payloadStr = row.getAttribute('data-payload');
      row.addEventListener('contextmenu', function(e){ e.preventDefault(); showMenu(e.pageX, e.pageY, payloadStr); });
      row.addEventListener('click', function(){
        let p; try { p = JSON.parse(payloadStr); } catch(e){ return; }
        vscode.postMessage({ command: 'openDetails', payload: p });
      });
    });
    window.addEventListener('message', function(e){
      const m = e.data || {};
      if (m.command === 'clearBusy'){ clearBusy(m.similarityId); }
            else if (m.command === 'setSource'){
        const cell = document.querySelector('td.source[data-sim="' + cssEsc(m.similarityId) + '"]');
        if (cell && m.html){ cell.innerHTML = m.html; }
        applyFilters();
      }
            else if (m.command === 'setRiskName'){
        const cell = document.querySelector('td.riskname[data-sim="' + cssEsc(m.similarityId) + '"]');
        if (cell && m.riskName){
          cell.textContent = m.riskName;
          cell.setAttribute('title', m.riskName);
        }
        applyFilters();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Webview view that renders the selected scan's SAST/SCA findings as a table
 * (Severity · Engine · Vulnerability · State) with right-click / kebab actions
 * to Triage or Remediate with AI — mirroring the platform's Risk Orchestration.
 */
export class AiTriageViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private rows: AiTriageRow[] = [];
  /** Full wrapped results for the current scan, used to open the details panel. */
  private detailResults: ResultLike[] = [];
  private readonly triagedIds = new Set<string>();
  /** similarityId -> "AI" | "Manual", resolved lazily from the triage change-log. */
  private readonly sourceCache = new Map<string, "AI" | "Manual">();
  /** similarityId -> riskName, resolved lazily from the Risks API. */
  private readonly riskNameCache = new Map<string, string>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logs: Logs
  ) { }

  public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    webviewView.webview.onDidReceiveMessage((message) => this.handleMessage(message));
    await this.refresh();
  }

  /**
   * Reload results and re-render the table. Prefer the in-memory results passed
   * by the results provider (which reflect just-applied triage state) over the
   * on-disk scan file.
   */
  public async refresh(cxResults?: unknown[]): Promise<void> {
    if (!this.view) {
      return;
    }
    const authenticated = await this.isAuthenticated();
    const project = getFromState(this.context, constants.projectIdKey) as Item | undefined;
    const branch = getFromState(this.context, constants.branchIdKey) as Item | undefined;
    const scan = getFromState(this.context, constants.scanIdKey) as Item | undefined;

    this.rows = [];
    this.detailResults = [];
    let isLatestScan = true;
    if (authenticated && project?.id && branch?.id && scan?.id) {
      isLatestScan = await this.isSelectedScanLatest(project.id, branch.id, scan.id);
      if (isLatestScan) {
        try {
          const raw = cxResults ?? (await readResultsFromFile(getResultsFilePath(), scan.id)) ?? [];
          const astResults = (raw as unknown[]).map((r) =>
            typeof (r as ResultLike).getResultHash === "function"
              ? (r as ResultLike)
              : new AstResult(r)
          );
          this.detailResults = astResults;
          this.rows = mapResultsToRows(astResults);
          for (const row of this.rows) {
            this.logs.debug(
              `[AI Triage] row loaded: engine=${row.engine} severity=${row.severity} ` +
              `resultId=${row.resultId} similarityId=${row.similarityId} alternateId=${row.alternateId} name=${row.name}`
            );
          }
        } catch (error) {
          this.logs.warn(`AI Triage: failed to load results: ${error}`);
        }
      }
    }
    const sourceBySimilarity: Record<string, string> = {};
    for (const [sim, src] of this.sourceCache) {
      sourceBySimilarity[sim] = src;
    }
    const riskNameBySimilarity: Record<string, string> = {};
    for (const [sim, riskName] of this.riskNameCache) {
      riskNameBySimilarity[sim] = riskName;
    }

    this.view.webview.html = buildAiTriageHtml({
      rows: this.rows,
      projectName: project?.name,
      scanId: scan?.displayScanId || scan?.id,
      productName: getMessages().productName,
      nonce: getNonce(),
      authenticated,
      isLatestScan,
      triagedIds: this.triagedIds,
      sourceBySimilarity,
      riskNameBySimilarity,
    });

    // Resolve "Triaged By" for already-triaged rows in the background (bounded),
    // then patch each cell so the initial render is never blocked.
    if (authenticated && project?.id && isLatestScan) {
      void this.resolveTriageSources(project.id);
    }
  }

  /**
   * Whether `scanId` is the most recent completed scan for `projectId`/`branchName`.
   * Fails open (returns true) on error so a transient API issue doesn't block the view.
   */
  private async isSelectedScanLatest(
    projectId: string,
    branchName: string,
    scanId: string
  ): Promise<boolean> {
    try {
      const scans = await cx.getScans(projectId, branchName, 1);
      const latest = scans?.[0];
      return latest ? latest.id === scanId : true;
    } catch (error) {
      this.logs.warn(`AI Triage: failed to check latest scan: ${error}`);
      return true;
    }
  }

  /** Mark a result as AI-triaged (shows the completed icon) with its new state. */
  public markTriaged(similarityId: string, stateDisplay: string): void {
    this.triagedIds.add(similarityId);
    this.sourceCache.set(similarityId, "AI");
    const row = this.rows.find((r) => r.similarityId === similarityId);
    if (row) {
      row.stateDisplay = stateDisplay;
    }
  }

  /**
 * Resolve the "Triaged By" source for every row from the bulk Risks API
 * (`stateChangedBy`), then patch each cell. One call per distinct severity
 * present, best-effort (never blocks the initial render or throws).
 */
  private async resolveTriageSources(projectId: string): Promise<void> {
    try {
      const service = AiTriageService.getInstance(this.context, this.logs);

      // Primary: one paginated sweep with no severity filter (returns all).
      const items: Array<Record<string, unknown>> = [...(await service.getRisks(projectId))];

      // Fallback: if the no-severity call returned nothing, some deployments
      // require the severity filter — query per distinct severity present.
      if (items.length === 0) {
        const severities = Array.from(
          new Set(this.rows.map((r) => r.severity).filter((s) => s && s.length > 0))
        );
        for (const sev of severities) {
          items.push(...(await service.getRisks(projectId, sev)));
        }
      }

      if (items.length > 0) {
        this.logs.debug(
          `[AI Triage] risks: ${items.length} items; sample keys: ${Object.keys(items[0]).join(",")}`
        );
      }

      const map = buildSourceMapFromRisks(items);
      const riskNameMap = buildRiskNameMapFromRisks(items);
      let sourceMatched = 0;
      let riskNameMatched = 0;
      for (const row of this.rows) {
        const source = this.triagedIds.has(row.similarityId) ? "AI" : lookupByRow(map, row);
        if (source) {
          sourceMatched++;
          this.sourceCache.set(row.similarityId, source);
          this.view?.webview.postMessage({
            command: "setSource",
            similarityId: row.similarityId,
            html: sourceBadgeHtml(source),
          });
        }

        const riskName = lookupByRow(riskNameMap, row);
        if (riskName) {
          riskNameMatched++;
          row.riskName = riskName;
          this.riskNameCache.set(row.similarityId, riskName);
          this.view?.webview.postMessage({
            command: "setRiskName",
            similarityId: row.similarityId,
            riskName,
          });
        }
      }
      this.logs.debug(
        `[AI Triage] source matched ${sourceMatched}/${this.rows.length}, ` +
        `riskName matched ${riskNameMatched}/${this.rows.length} rows`
      );

      // If riskName correlation is failing, log a sample from both sides so the
      // mismatched key can be pinned down without another guess-and-check round.
      if (riskNameMatched === 0 && items.length > 0) {
        const s = items[0];
        this.logs.debug(
          `[AI Triage] sample risk: id=${s.id} groupId=${s.groupId} hash=${s.hash} ` +
          `riskName=${s.riskName} stateChangedBy=${s.stateChangedBy} isAiGenerated=${s.isAiGenerated}`
        );
        const r = this.rows[0];
        if (r) {
          this.logs.debug(
            `[AI Triage] sample row: similarityId=${r.similarityId} resultId=${r.resultId} ` +
            `alternateId=${r.alternateId} name=${r.name}`
          );
        }
      }
    } catch (error) {
      this.logs.debug(`AI Triage: resolveTriageSources failed: ${error}`);
    }
  }

  private async handleMessage(message: {
    command: string;
    payload?: AiTriagePayload;
  }): Promise<void> {
    this.logs.debug(`[AI Triage] webview message received: ${JSON.stringify(message)}`);
    switch (message?.command) {
      case "triageWithAI": {
        if (!message.payload) {
          return;
        }
        const result = await vscode.commands.executeCommand(
          commands.triageWithAI,
          message.payload
        );
        // On success the command mutates the results and triggers a full refresh
        // (which re-renders this table with the new state + completed icon).
        // On failure/cancel, just clear the row's busy indicator.
        if (!result || !(result as { stateDisplay?: string }).stateDisplay) {
          this.view?.webview.postMessage({
            command: "clearBusy",
            similarityId: message.payload.similarityId,
          });
        }
        break;
      }
      case "remediateWithAI": {
        if (!message.payload) {
          return;
        }
        await vscode.commands.executeCommand(commands.remediateWithAI, message.payload);
        // Remediation does not change the triage state column; clear the busy label.
        this.view?.webview.postMessage({
          command: "clearBusy",
          similarityId: message.payload.similarityId,
        });
        break;
      }
      case "openDetails": {
        if (!message.payload) {
          return;
        }
        await this.openDetails(message.payload);
        break;
      }
      case "refresh": {
        await this.refresh();
        break;
      }
    }
  }

  /** Open the standard result-details panel for a clicked row (same as the tree). */
  private async openDetails(payload: AiTriagePayload): Promise<void> {
    const match = this.detailResults.find(
      (r) =>
        r.similarityId === payload.similarityId ||
        (typeof r.getResultHash === "function" && r.getResultHash() === payload.resultId)
    );
    if (match) {
      await vscode.commands.executeCommand(commands.newDetails, match);
    } else {
      this.logs.warn(`AI Triage: could not find result to open details for ${payload.similarityId}`);
    }
  }

  private async isAuthenticated(): Promise<boolean> {
    const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());
    return !!token;
  }
}
