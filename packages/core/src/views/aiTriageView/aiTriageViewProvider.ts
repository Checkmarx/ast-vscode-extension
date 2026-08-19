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

/** A single row rendered in the AI Triage table (one triage-able result). */
export interface AiTriageRow {
  resultId: string;
  similarityId: string;
  engine: AiTriageEngine;
  resultType: string;
  severity: string;
  status: string;
  stateDisplay: string;
  name: string;
  description: string;
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
 * Build a similarityId -> source map from the Risks API response. Each risk item
 * carries `stateChangedBy` ("AI" | "manual" | "unchanged"); "unchanged" is
 * omitted so those findings render as untriaged.
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
    // The risk carries no similarityId, so index by every plausible identifier
    // (id, groupId, …); rows are matched against these by similarityId/resultId.
    for (const key of [
      item.similarityId,
      item.similarity_id,
      item.groupId,
      item.group_id,
      item.hash,
      item.id,
    ]) {
      if (key !== undefined && key !== null && String(key).length > 0) {
        map[String(key)] = source;
      }
    }
  }
  return map;
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
  sourceBySimilarity: Record<string, string>
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

  const isDecided = triagedIds.has(row.similarityId) || isTriagedState(row.stateDisplay);
  const doneIcon = isDecided
    ? `<span class="ai-done" title="Triaged">✦</span> `
    : "";
  return `<tr data-similarity="${escapeHtml(row.similarityId)}" data-payload="${encoded}">
    <td><span class="badge ${sevClass}">${escapeHtml(row.severity || "N/A")}</span></td>
    <td><span class="badge engine">${escapeHtml(row.engine.toUpperCase())}</span></td>
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
  triagedIds?: Set<string>;
  sourceBySimilarity?: Record<string, string>;

}): string {
  const { rows, projectName, scanId, productName, nonce, authenticated } = params;
  const triagedIds = params.triagedIds ?? new Set<string>();
  const sourceBySimilarity = params.sourceBySimilarity ?? {};

  const header = `<div class="details">
      <div class="ellipsis">Project: ${escapeHtml(projectName || "—")}</div>
      <div class="ellipsis">Scan: ${escapeHtml(scanId || "—")}</div>
    </div>`;

  let body: string;
  if (!authenticated) {
    body = `<div class="message">Authentication to Checkmarx One is required to use AI Triage and Remediation.</div>`;
  } else if (!projectName || !scanId) {
    body = `<div class="message">Select a project and scan in the Checkmarx One Results view to see triage-able SAST/SCA findings.</div>`;
  } else if (rows.length === 0) {
    body = `<div class="message">No SAST or SCA findings available to triage for the selected scan.</div>`;
  } else {
    body = `${header}
      <table class="triage-table">
        <thead>
          <tr>
            <th>Severity</th><th>Engine</th><th>Vulnerability</th><th>State</th><th>Triaged By</th>
          </tr>
        </thead>
          <tbody>${rows.map((r) => renderRow(r, triagedIds, sourceBySimilarity)).join("")}</tbody>
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
    .details { display:flex; gap:16px; margin-bottom:8px; color: var(--vscode-descriptionForeground); }
    .ellipsis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:50%; }
    .message { padding:12px; color: var(--vscode-descriptionForeground); }
    .hint { margin-top:8px; color: var(--vscode-descriptionForeground); font-size:11px; }
    table.triage-table { width:100%; border-collapse:collapse; }
    table.triage-table th { text-align:left; padding:4px 6px; border-bottom:1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-weight:600; }
    table.triage-table td { padding:6px; border-bottom:1px solid var(--vscode-panel-border); vertical-align:middle; }
    table.triage-table tbody tr { cursor: pointer; }
    table.triage-table tr:hover { background: var(--vscode-list-hoverBackground); }
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
          vscode.postMessage({ command: pair[0], payload: p });
          hideMenu();
        });
        menuEl.appendChild(it);
      });
      document.body.appendChild(menuEl);
    }
    document.addEventListener('click', hideMenu);
    document.addEventListener('scroll', hideMenu, true);
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
    const scan = getFromState(this.context, constants.scanIdKey) as Item | undefined;

    this.rows = [];
    this.detailResults = [];
    if (authenticated && project?.id && scan?.id) {
      try {
        const raw = cxResults ?? (await readResultsFromFile(getResultsFilePath(), scan.id)) ?? [];
        const astResults = (raw as unknown[]).map((r) =>
          typeof (r as ResultLike).getResultHash === "function"
            ? (r as ResultLike)
            : new AstResult(r)
        );
        this.detailResults = astResults;
        this.rows = mapResultsToRows(astResults);
      } catch (error) {
        this.logs.warn(`AI Triage: failed to load results: ${error}`);
      }
    }
    const sourceBySimilarity: Record<string, string> = {};
    for (const [sim, src] of this.sourceCache) {
      sourceBySimilarity[sim] = src;
    }

    this.view.webview.html = buildAiTriageHtml({
      rows: this.rows,
      projectName: project?.name,
      scanId: scan?.displayScanId || scan?.id,
      productName: getMessages().productName,
      nonce: getNonce(),
      authenticated,
      triagedIds: this.triagedIds,
      sourceBySimilarity,
    });

    // Resolve "Triaged By" for already-triaged rows in the background (bounded),
    // then patch each cell so the initial render is never blocked.
    if (authenticated && project?.id) {
      void this.resolveTriageSources(project.id);
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
      let matched = 0;
      for (const row of this.rows) {
        const source = this.triagedIds.has(row.similarityId)
          ? "AI"
          : (map[row.similarityId] ?? map[row.resultId]);
        if (source) {
          matched++;
          this.sourceCache.set(row.similarityId, source);
          this.view?.webview.postMessage({
            command: "setSource",
            similarityId: row.similarityId,
            html: sourceBadgeHtml(source),
          });
        }
      }
      this.logs.debug(`[AI Triage] source matched ${matched}/${this.rows.length} rows`);

      // If nothing matched, log a sample from both sides so the correlation key
      // can be pinned down.
      if (matched === 0 && items.length > 0) {
        const s = items[0];
        this.logs.debug(
          `[AI Triage] sample risk: id=${s.id} groupId=${s.groupId} riskName=${s.riskName} ` +
          `stateChangedBy=${s.stateChangedBy} isAiGenerated=${s.isAiGenerated}`
        );
        const r = this.rows[0];
        if (r) {
          this.logs.debug(
            `[AI Triage] sample row: similarityId=${r.similarityId} resultId=${r.resultId} name=${r.name}`
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
