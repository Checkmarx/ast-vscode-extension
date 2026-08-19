import { CheckmarxIssue, PullRequest, PullRequestFile } from '../../services/githubService';

interface DiffLine {
    type: 'added' | 'removed' | 'context' | 'hunk';
    content: string;
    oldLineNo?: number;
    newLineNo?: number;
}

function parsePatch(patch: string): DiffLine[] {
    const lines: DiffLine[] = [];
    let oldLine = 0;
    let newLine = 0;

    for (const raw of patch.split('\n')) {
        const hunkMatch = raw.match(/^@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@(.*)/);
        if (hunkMatch) {
            oldLine = parseInt(hunkMatch[1], 10);
            newLine = parseInt(hunkMatch[2], 10);
            lines.push({ type: 'hunk', content: raw });
            continue;
        }
        if (raw.startsWith('+') && !raw.startsWith('+++')) {
            lines.push({ type: 'added', content: raw.slice(1), newLineNo: newLine++ });
        } else if (raw.startsWith('-') && !raw.startsWith('---')) {
            lines.push({ type: 'removed', content: raw.slice(1), oldLineNo: oldLine++ });
        } else if (raw && !raw.startsWith('\\') && !raw.startsWith('---') && !raw.startsWith('+++')) {
            lines.push({ type: 'context', content: raw.slice(1), oldLineNo: oldLine++, newLineNo: newLine++ });
        }
    }
    return lines;
}

function esc(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function statusBadge(status: PullRequestFile['status']): string {
    switch (status) {
        case 'added':    return '<span class="badge badge-added">Added</span>';
        case 'removed':  return '<span class="badge badge-removed">Deleted</span>';
        case 'renamed':  return '<span class="badge badge-modified">Renamed</span>';
        case 'copied':   return '<span class="badge badge-modified">Copied</span>';
        case 'modified':
        case 'changed':  return '<span class="badge badge-modified">Modified</span>';
        default:         return '';
    }
}

// ── Vulnerability helpers ─────────────────────────────────────────────────────

/**
 * A CheckmarxIssue plus its 1-based position in the PR's issue list — this is the exact same
 * number the Pull Requests tree's NewIssueItem uses (and that the "@Checkmarx remediate
 * vulnerability number N" GitHub-bot comment expects), since both are derived from the same
 * parseCheckmarxNewIssues() ordering.
 */
export interface IndexedCheckmarxIssue extends CheckmarxIssue {
    index: number;
}

function buildVulnMap(issues: IndexedCheckmarxIssue[]): Map<string, Map<number, IndexedCheckmarxIssue[]>> {
    const map = new Map<string, Map<number, IndexedCheckmarxIssue[]>>();
    for (const issue of issues) {
        if (!issue.fileName || issue.line <= 0) { continue; }
        if (!map.has(issue.fileName)) { map.set(issue.fileName, new Map()); }
        const lineMap = map.get(issue.fileName)!;
        const list = lineMap.get(issue.line) ?? [];
        list.push(issue);
        lineMap.set(issue.line, list);
    }
    return map;
}

const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function topSeverity(vulns: CheckmarxIssue[]): string {
    return vulns.reduce((top, v) =>
        SEV_ORDER.indexOf(v.severity) < SEV_ORDER.indexOf(top) ? v.severity : top,
        vulns[0]?.severity ?? 'INFO'
    );
}

function sevCssClass(sev: string): string {
    switch (sev) {
        case 'CRITICAL': return 'sev-critical';
        case 'HIGH':     return 'sev-high';
        case 'MEDIUM':   return 'sev-medium';
        case 'LOW':      return 'sev-low';
        default:         return 'sev-info';
    }
}

// Inline SVG paths from packages/core/media/icons/realtimeEngines/ — same icons the editor gutter uses
const SHIELD_OUTER = 'M1.41781 2.14076C2.89023 2.03149 4.34066 1.52625 5.60969 0.625046C5.84264 0.45962 6.15712 0.45962 6.39007 0.625046C7.6591 1.52625 9.10953 2.03149 10.582 2.14076C10.9184 2.16573 11.1927 2.44074 11.1884 2.77808C11.0897 10.5232 9.09557 11.3165 6.24758 12.4494L6.22731 12.4575C6.08156 12.5155 5.91819 12.5155 5.77245 12.4575L5.75218 12.4494C2.90419 11.3165 0.910022 10.5232 0.811329 2.77808C0.80703 2.44074 1.08136 2.16573 1.41781 2.14076Z';

const SEV_SVG: Record<string, string> = {
    // critical_severity.svg
    CRITICAL: `<svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.60969 0.625046C4.34066 1.52625 2.89023 2.03149 1.41781 2.14076C1.08136 2.16573 0.80703 2.44074 0.811329 2.77808C0.910022 10.5232 2.90419 11.3165 5.75218 12.4494L5.77245 12.4575C5.9182 12.5155 6.08156 12.5155 6.22731 12.4575L6.24758 12.4494C9.09557 11.3165 11.0897 10.5232 11.1884 2.77808C11.1927 2.44074 10.9184 2.16573 10.582 2.14076C9.10953 2.03149 7.6591 1.52625 6.39007 0.625046C6.15712 0.45962 5.84264 0.45962 5.60969 0.625046ZM4.6896 8.67422C5.04116 8.88942 5.46197 8.99702 5.95203 8.99702C6.36325 8.99702 6.72121 8.92244 7.02589 8.7733C7.33058 8.62202 7.57135 8.41321 7.74819 8.14688C7.92504 7.87841 8.02731 7.57053 8.05501 7.22322H6.94919C6.9151 7.40007 6.85224 7.55028 6.76062 7.67386C6.669 7.79744 6.55501 7.89226 6.41865 7.95831C6.28442 8.02223 6.13207 8.05419 5.96162 8.05419C5.72085 8.05419 5.51098 7.99027 5.332 7.86243C5.15515 7.73246 5.01772 7.54815 4.91971 7.30952C4.8217 7.06875 4.7727 6.78111 4.7727 6.44659C4.7727 6.11633 4.8217 5.83295 4.91971 5.59645C5.01986 5.35994 5.15942 5.17883 5.33839 5.05312C5.51737 4.92528 5.72511 4.86136 5.96162 4.86136C6.24074 4.86136 6.46339 4.94126 6.62959 5.10107C6.79791 5.25874 6.90444 5.45582 6.94919 5.69233H8.05501C8.02944 5.33864 7.92504 5.02969 7.7418 4.76548C7.55856 4.49915 7.31247 4.29354 7.00352 4.14865C6.6967 4.00163 6.34407 3.92813 5.94564 3.92813C5.46623 3.92813 5.05075 4.03572 4.69919 4.25092C4.34976 4.46399 4.07916 4.76229 3.8874 5.14581C3.69564 5.5272 3.59976 5.96719 3.59976 6.46577C3.59976 6.96222 3.69351 7.40114 3.88101 7.78253C4.07064 8.16179 4.34017 8.45902 4.6896 8.67422Z" fill="#E81C26"/><path d="M5.95203 8.99702C5.46197 8.99702 5.04116 8.88942 4.6896 8.67422C4.34017 8.45902 4.07064 8.16179 3.88101 7.78253C3.69351 7.40114 3.59976 6.96222 3.59976 6.46577C3.59976 5.96719 3.69564 5.5272 3.8874 5.14581C4.07916 4.76229 4.34976 4.46399 4.69919 4.25092C5.05075 4.03572 5.46623 3.92813 5.94564 3.92813C6.34407 3.92813 6.6967 4.00163 7.00352 4.14865C7.31247 4.29354 7.55856 4.49915 7.7418 4.76548C7.92504 5.02969 8.02944 5.33864 8.05501 5.69233H6.94919C6.90444 5.45582 6.79791 5.25874 6.62959 5.10107C6.46339 4.94126 6.24074 4.86136 5.96162 4.86136C5.72511 4.86136 5.51737 4.92528 5.33839 5.05312C5.15942 5.17883 5.01986 5.35994 4.91971 5.59645C4.8217 5.83295 4.7727 6.11633 4.7727 6.44659C4.7727 6.78111 4.8217 7.06875 4.91971 7.30952C5.01772 7.54815 5.15515 7.73246 5.332 7.86243C5.51098 7.99027 5.72085 8.05419 5.96162 8.05419C6.13207 8.05419 6.28442 8.02223 6.41865 7.95831C6.55501 7.89226 6.669 7.79744 6.76062 7.67386C6.85224 7.55028 6.9151 7.40007 6.94919 7.22322H8.05501C8.02731 7.57053 7.92504 7.87841 7.74819 8.14688C7.57135 8.41321 7.33058 8.62202 7.02589 8.7733C6.72121 8.92244 6.36325 8.99702 5.95203 8.99702Z" fill="black"/></svg>`,
    // high_severity.svg
    HIGH: `<svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${SHIELD_OUTER}" fill="#FF3B6C"/><path d="M3.91791 8.88293V3.99598H4.95114V6.01233H7.04862V3.99598H8.07946V8.88293H7.04862V6.8642H4.95114V8.88293H3.91791Z" fill="black"/></svg>`,
    // medium_severity.svg
    MEDIUM: `<svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.41781 2.13979C2.89023 2.03052 4.34066 1.52528 5.60969 0.62407C5.84264 0.458643 6.15712 0.458643 6.39007 0.62407C7.6591 1.52528 9.10953 2.03052 10.582 2.13979C10.9184 2.16475 11.1927 2.43976 11.1884 2.77711C11.0897 10.5222 9.09557 11.3155 6.24758 12.4485L6.22731 12.4565C6.08156 12.5145 5.91819 12.5145 5.77245 12.4565L5.75218 12.4485C2.90419 11.3155 0.910022 10.5222 0.811329 2.77711C0.80703 2.43976 1.08136 2.16475 1.41781 2.13979Z" fill="#FF7B00"/><path d="M3.32077 3.99501H4.595L5.94082 7.27843H5.99809L7.34391 3.99501H8.61814V8.88196H7.61594V5.70114H7.57537L6.31068 8.8581H5.62823L4.36354 5.68921H4.32297V8.88196H3.32077V3.99501Z" fill="black"/></svg>`,
    // low_severity.svg
    LOW: `<svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${SHIELD_OUTER}" fill="#D8C461"/><path d="M4.51834 8.88293V3.99598H5.55157V8.03106H7.64666V8.88293H4.51834Z" fill="black"/></svg>`,
};

/** Renders the gutter icon for a vulnerable line using the same SVGs as the editor gutter decorations. */
function gutterIcon(vulns: CheckmarxIssue[]): string {
    if (vulns.length === 0) { return ''; }
    const sev = topSeverity(vulns);
    const svg = SEV_SVG[sev] ?? SEV_SVG.LOW;
    return `<span class="gutter-icon">${svg}</span>`;
}

/** data-vulns payload for the hover popup — the fields the AI-fix/explain prompts and PR-remediation action need. */
function vulnDataAttr(vulns: IndexedCheckmarxIssue[]): string {
    if (vulns.length === 0) { return ''; }
    const payload = vulns.map(v => ({ severity: v.severity, name: v.name, fileName: v.fileName, line: v.line, index: v.index }));
    return ` data-vulns="${esc(JSON.stringify(payload))}"`;
}

// ── Diff rendering ────────────────────────────────────────────────────────────

function renderFileDiff(file: PullRequestFile, fileVulns: Map<number, IndexedCheckmarxIssue[]>): string {
    const displayName = file.previous_filename
        ? `${esc(file.previous_filename)} <span class="rename-arrow">→</span> ${esc(file.filename)}`
        : esc(file.filename);

    let rows = '';
    if (file.patch) {
        for (const line of parsePatch(file.patch)) {
            const lineNum = line.newLineNo;
            const vulns = (lineNum != null && fileVulns.has(lineNum)) ? fileVulns.get(lineNum)! : [];
            const hasVuln = vulns.length > 0;
            const sev = hasVuln ? topSeverity(vulns) : '';
            const icon = gutterIcon(vulns);
            const dataLine = lineNum != null ? ` data-new-line="${lineNum}"` : '';
            // squiggly underline class applied to the code-content cell; vuln-trigger classes/data-vulns
            // on both the gutter-icon cell and the code cell are what the hover popup listens for
            const squiggle = hasVuln ? ` squiggly ${sevCssClass(sev)}` : '';
            const lnClass = hasVuln ? 'ln vuln-trigger' : 'ln';
            const lcClass = `lc${hasVuln ? ' vuln-trigger' : ''}${squiggle}`;
            const vulnAttr = vulnDataAttr(vulns);

            if (line.type === 'hunk') {
                rows += `<tr class="hunk-row"${dataLine}><td class="ln"></td><td class="ln"></td><td class="lc hunk-header">${esc(line.content)}</td></tr>`;
            } else if (line.type === 'added') {
                rows += `<tr class="line-added"${dataLine}><td class="ln"></td><td class="${lnClass}"${vulnAttr}>${icon}${line.newLineNo ?? ''}</td><td class="${lcClass}"${vulnAttr}><span class="marker">+</span>${esc(line.content)}</td></tr>`;
            } else if (line.type === 'removed') {
                rows += `<tr class="line-removed"><td class="ln">${line.oldLineNo ?? ''}</td><td class="ln"></td><td class="lc"><span class="marker">-</span>${esc(line.content)}</td></tr>`;
            } else {
                rows += `<tr class="line-ctx"${dataLine}><td class="ln">${line.oldLineNo ?? ''}</td><td class="${lnClass}"${vulnAttr}>${icon}${line.newLineNo ?? ''}</td><td class="${lcClass}"${vulnAttr}><span class="marker"> </span>${esc(line.content)}</td></tr>`;
            }
        }
    } else {
        rows = `<tr><td colspan="3" class="no-diff">Binary file or diff not available</td></tr>`;
    }

    return `
<div class="file-block" data-filename="${esc(file.filename)}">
  <div class="file-header">
    <span class="file-name">${displayName}</span>
    ${statusBadge(file.status)}
    <span class="file-stats">
      <span class="s-add">+${file.additions}</span>
      <span class="s-del">-${file.deletions}</span>
    </span>
    <button class="toggle-btn" title="Toggle diff">▼</button>
  </div>
  <div class="diff-body">
    <table class="diff-table"><tbody>${rows}</tbody></table>
  </div>
</div>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PullRequestDiffWebviewUris {
    /** webview.cspSource for the panel — allows img-src to load the extension's own local media. */
    cspSource: string;
    /** webview.asWebviewUri() result for the "Checkmarx One/Developer Assist" badge icon. */
    badgeIconUri: string;
}

export function generatePullRequestDiffHtml(
    pr: PullRequest,
    files: PullRequestFile[],
    issues: CheckmarxIssue[] = [],
    webviewUris?: PullRequestDiffWebviewUris,
): string {
    // Index matches the Pull Requests tree's NewIssueItem numbering (both derive from
    // parseCheckmarxNewIssues() in the same order), so "PR Remediation" targets the same
    // vulnerability the GitHub-bot comment expects.
    const indexedIssues: IndexedCheckmarxIssue[] = issues.map((issue, i) => ({ ...issue, index: i + 1 }));
    const vulnMap = buildVulnMap(indexedIssues);
    const totalAdd = files.reduce((s, f) => s + f.additions, 0);
    const totalDel = files.reduce((s, f) => s + f.deletions, 0);
    const createdDate = new Date(pr.created_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
    });
    const filesDiff = files.map(f => renderFileDiff(f, vulnMap.get(f.filename) ?? new Map())).join('\n');

    const vulnCount = issues.length;
    const vulnBanner = vulnCount > 0
        ? `<div class="vuln-banner"><span class="vuln-banner-icon">⚠</span> <strong>${vulnCount} Checkmarx new issue${vulnCount !== 1 ? 's' : ''}</strong> found in this PR</div>`
        : '';

    const cspSource = webviewUris?.cspSource ?? '';
    const badgeIconUriJs = JSON.stringify(webviewUris?.badgeIconUri ?? '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https: data: ${cspSource};">
<title>PR #${pr.number}</title>
<style>
:root {
  --bg:           var(--vscode-editor-background,          #0d1117);
  --fg:           var(--vscode-editor-foreground,          #e6edf3);
  --border:       var(--vscode-panel-border,               #30363d);
  --sidebar-bg:   var(--vscode-sideBar-background,         #161b22);
  --hover:        var(--vscode-list-hoverBackground,       rgba(255,255,255,.05));
  --font-sans:    var(--vscode-font-family,                -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  --font-mono:    var(--vscode-editor-font-family,         'SF Mono', 'Fira Code', Consolas, monospace);
  --font-sz:      var(--vscode-editor-font-size,           12px);
  --muted:        #8b949e;
  --add-bg:       rgba(46,160,67,.15);
  --add-ln-bg:    rgba(46,160,67,.25);
  --add-col:      #3fb950;
  --del-bg:       rgba(248,81,73,.12);
  --del-ln-bg:    rgba(248,81,73,.22);
  --del-col:      #f85149;
  --hunk-bg:      rgba(121,192,255,.08);
  --hunk-col:     #79c0ff;
  --ln-bg:        var(--vscode-sideBar-background, #161b22);
  --radius:       6px;
  /* severity colours matching VS Code diagnostics */
  --sev-critical: #f85149;
  --sev-high:     #f85149;
  --sev-medium:   #e3b341;
  --sev-low:      #79c0ff;
  --sev-info:     #8b949e;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);font-size:14px;padding:20px}

/* ── PR Header ── */
.pr-header{background:var(--sidebar-bg);border:1px solid var(--border);border-radius:var(--radius);padding:18px 22px;margin-bottom:14px}
.pr-title{font-size:19px;font-weight:600;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.pr-num{color:var(--muted);font-weight:400;font-size:16px}
.pr-open-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:500;background:rgba(46,160,67,.2);color:#3fb950;border:1px solid rgba(46,160,67,.35)}
.pr-draft-badge{background:rgba(139,148,158,.15);color:var(--muted);border:1px solid rgba(139,148,158,.3)}
.pr-meta{color:var(--muted);font-size:13px;margin-top:4px}
.branch{display:inline-block;background:rgba(121,192,255,.1);color:#79c0ff;border:1px solid rgba(121,192,255,.2);border-radius:4px;padding:1px 7px;font-family:var(--font-mono);font-size:12px}
.pr-stats-row{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px}
.stat{color:var(--muted);font-size:13px}
.stat .s-add{color:var(--add-col);font-weight:600}
.stat .s-del{color:var(--del-col);font-weight:600}
.pr-body{margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:13px;color:var(--fg);white-space:pre-wrap;word-break:break-word;line-height:1.6}

/* ── Vulnerability banner ── */
.vuln-banner{display:flex;align-items:center;gap:8px;background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.25);border-radius:var(--radius);padding:9px 16px;margin-bottom:14px;font-size:13px;color:var(--sev-critical)}
.vuln-banner-icon{font-size:15px}

/* ── Diff Summary Bar ── */
.diff-bar{background:var(--sidebar-bg);border:1px solid var(--border);border-radius:var(--radius);padding:9px 16px;margin-bottom:14px;font-size:13px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.diff-bar .s-add{color:var(--add-col);font-weight:700}
.diff-bar .s-del{color:var(--del-col);font-weight:700}

/* ── File Block ── */
.file-block{border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;overflow:hidden}
.file-header{background:var(--sidebar-bg);padding:8px 14px;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;flex-wrap:wrap}
.file-header:hover{background:var(--hover)}
.file-icon{color:var(--muted);font-size:13px;flex-shrink:0}
.file-name{font-family:var(--font-mono);font-size:12.5px;flex:1;word-break:break-all}
.rename-arrow{color:var(--muted)}
.badge{padding:1px 9px;border-radius:12px;font-size:11px;font-weight:500}
.badge-added{background:rgba(46,160,67,.2);color:#3fb950;border:1px solid rgba(46,160,67,.3)}
.badge-removed{background:rgba(248,81,73,.15);color:#f85149;border:1px solid rgba(248,81,73,.3)}
.badge-modified{background:rgba(121,192,255,.12);color:#79c0ff;border:1px solid rgba(121,192,255,.2)}
.file-stats{display:flex;gap:6px;font-size:12px;margin-left:auto}
.s-add{color:var(--add-col);font-weight:600}
.s-del{color:var(--del-col);font-weight:600}
.toggle-btn{background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:2px 4px;border-radius:3px;transition:transform .2s}
.toggle-btn:hover{background:var(--hover)}
.toggle-btn.collapsed{transform:rotate(-90deg)}

/* ── Diff Table ── */
.diff-body{overflow-x:auto}
.diff-body.hidden{display:none}
.diff-table{width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:var(--font-sz);line-height:1.55}
.diff-table td{padding:0;border:none;vertical-align:top}
.ln{min-width:48px;width:48px;text-align:right;padding:0 6px;color:var(--muted);background:var(--ln-bg);user-select:none;white-space:nowrap;border-right:1px solid var(--border);font-size:11px}
.lc{padding:0 12px;white-space:pre;overflow-x:visible}
.marker{opacity:.65;margin-right:5px}

/* added */
.line-added{background:var(--add-bg)}
.line-added .ln{background:var(--add-ln-bg)}
.line-added .marker{color:var(--add-col)}

/* removed */
.line-removed{background:var(--del-bg)}
.line-removed .ln{background:var(--del-ln-bg)}
.line-removed .marker{color:var(--del-col)}

/* context */
.line-ctx .marker{opacity:.3}

/* hunk */
.hunk-row{background:var(--hunk-bg)}
.hunk-header{color:var(--hunk-col);font-style:italic;font-size:12px;padding:2px 12px}

/* misc */
.no-diff{padding:14px;color:var(--muted);text-align:center;font-style:italic}

/* ── Gutter icons — inline SVGs matching packages/core/media/icons/realtimeEngines/ ── */
.gutter-icon{
    display:inline-flex;
    align-items:center;
    vertical-align:middle;
    margin-right:3px;
    cursor:default;
    flex-shrink:0;
}
.gutter-icon svg{display:block}

/* ── Squiggly underlines on the code-content cell ── */
.squiggly{text-decoration:underline wavy;text-underline-offset:3px;text-decoration-skip-ink:none}
.squiggly.sev-critical{text-decoration-color:var(--sev-critical)}
.squiggly.sev-high    {text-decoration-color:var(--sev-high)}
.squiggly.sev-medium  {text-decoration-color:var(--sev-medium)}
.squiggly.sev-low     {text-decoration-color:var(--sev-low)}
.squiggly.sev-info    {text-decoration-color:var(--sev-info)}

/* ── Vulnerability hover popup (mirrors the editor's realtime-scanner hover card) ── */
.vuln-trigger{cursor:pointer}
.vuln-tooltip{
    position:fixed;display:none;z-index:9999;max-width:440px;max-height:260px;overflow-y:auto;
    background:var(--sidebar-bg);border:1px solid var(--border);border-radius:var(--radius);
    padding:10px 14px;font-family:var(--font-sans);font-size:12.5px;line-height:1.5;
    box-shadow:0 4px 16px rgba(0,0,0,.45);
}
.vuln-tooltip::-webkit-scrollbar{width:10px}
.vuln-tooltip::-webkit-scrollbar-track{background:transparent}
.vuln-tooltip::-webkit-scrollbar-thumb{background:var(--border);border-radius:5px}
.vuln-tooltip::-webkit-scrollbar-thumb:hover{background:var(--muted)}
.vuln-card{margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.vuln-card:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.vuln-card-badge{display:block;margin-bottom:6px;height:16px}
.vuln-card-title{font-weight:600}
.vuln-card-sev{font-style:italic;opacity:.8;margin:2px 0 8px;font-size:11.5px}
.vuln-card-sev.sev-critical{color:var(--sev-critical)}
.vuln-card-sev.sev-high    {color:var(--sev-high)}
.vuln-card-sev.sev-medium  {color:var(--sev-medium)}
.vuln-card-sev.sev-low     {color:var(--sev-low)}
.vuln-card-sev.sev-info    {color:var(--sev-info)}
.vuln-card-actions a{color:#3794ff;text-decoration:none;margin-right:16px;cursor:pointer}
.vuln-card-actions a:hover{text-decoration:underline}

/* ── Scroll-target flash animation ── */
@keyframes vuln-flash{
  0%,100%{background-color:transparent}
  30%{background-color:rgba(248,81,73,.25)}
}
.vuln-flash{animation:vuln-flash .5s ease-in-out 3}
</style>
</head>
<body>

<div class="pr-header">
  <div class="pr-title">
    <span class="${pr.draft ? 'pr-open-badge pr-draft-badge' : 'pr-open-badge'}">${pr.draft ? '⊙ Draft' : '⎇ Open'}</span>
    ${esc(pr.title)}
    <span class="pr-num">#${pr.number}</span>
  </div>
  <div class="pr-meta">
    Opened by <strong>${esc(pr.user.login)}</strong> on ${createdDate}
    &nbsp;·&nbsp;
    <span class="branch">${esc(pr.head.ref)}</span>
    <span style="color:var(--muted)"> → </span>
    <span class="branch">${esc(pr.base.ref)}</span>
  </div>
  <div class="pr-stats-row">
    <span class="stat">📁 ${files.length} file${files.length !== 1 ? 's' : ''} changed</span>
    <span class="stat"><span class="s-add">+${totalAdd}</span> additions</span>
    <span class="stat"><span class="s-del">-${totalDel}</span> deletions</span>
  </div>
  ${pr.body ? `<div class="pr-body">${esc(pr.body.trim())}</div>` : ''}
</div>

${vulnBanner}

<div class="diff-bar">
  <strong>Showing ${files.length} changed file${files.length !== 1 ? 's' : ''}</strong>
  <span class="s-add">+${totalAdd}</span>
  <span class="s-del">-${totalDel}</span>
</div>

${filesDiff}

<div id="vuln-tooltip" class="vuln-tooltip"></div>

<script>
var vscode = acquireVsCodeApi();
var badgeIconUri = ${badgeIconUriJs};

// ── Toggle expand/collapse on file header click ──
document.querySelectorAll('.file-header').forEach(function(header) {
  var block = header.closest('.file-block');
  var body  = block.querySelector('.diff-body');
  var btn   = header.querySelector('.toggle-btn');
  header.addEventListener('click', function() {
    var hidden = body.classList.toggle('hidden');
    btn.classList.toggle('collapsed', hidden);
  });
});

// ── Vulnerability hover popup: Fix with Checkmarx One Assist / View details ──
(function() {
  var tooltip = document.getElementById('vuln-tooltip');
  var hideTimer = null;

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function sevClass(sev) {
    switch (sev) {
      case 'CRITICAL': return 'sev-critical';
      case 'HIGH':      return 'sev-high';
      case 'MEDIUM':    return 'sev-medium';
      case 'LOW':       return 'sev-low';
      default:          return 'sev-info';
    }
  }

  function renderCard(vuln) {
    var issueJson = escHtml(JSON.stringify(vuln));
    var badge = badgeIconUri
      ? '<img class="vuln-card-badge" src="' + badgeIconUri + '" alt="Checkmarx One Assist"/>'
      : '';
    return '<div class="vuln-card">' +
      badge +
      '<div class="vuln-card-title">' + escHtml(vuln.name) + '</div>' +
      '<div class="vuln-card-sev ' + sevClass(vuln.severity) + '">' + escHtml(vuln.severity) + ' severity</div>' +
      '<div class="vuln-card-actions">' +
        '<a class="vuln-action" data-action="fixPRIssue" data-issue="' + issueJson + '">Fix with Checkmarx One Assist</a>' +
        '<a class="vuln-action" data-action="viewPRIssueDetails" data-issue="' + issueJson + '">View details</a>' +
        '<a class="vuln-action" data-action="remediatePRIssue" data-issue="' + issueJson + '">PR Remediation</a>' +
      '</div>' +
    '</div>';
  }

  function showTooltip(el, vulns) {
    clearTimeout(hideTimer);
    tooltip.innerHTML = vulns.map(renderCard).join('');
    var rect = el.getBoundingClientRect();
    tooltip.style.display = 'block';
    var top = rect.bottom + 4;
    var left = rect.left;
    var maxLeft = window.innerWidth - tooltip.offsetWidth - 8;
    if (left > maxLeft) { left = Math.max(8, maxLeft); }
    if (top + tooltip.offsetHeight > window.innerHeight) { top = Math.max(8, rect.top - tooltip.offsetHeight - 4); }
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
  }

  function scheduleHide() {
    hideTimer = setTimeout(function() { tooltip.style.display = 'none'; }, 200);
  }

  document.querySelectorAll('.vuln-trigger').forEach(function(el) {
    el.addEventListener('mouseenter', function() {
      var vulns = JSON.parse(el.getAttribute('data-vulns'));
      showTooltip(el, vulns);
    });
    el.addEventListener('mouseleave', scheduleHide);
  });

  tooltip.addEventListener('mouseenter', function() { clearTimeout(hideTimer); });
  tooltip.addEventListener('mouseleave', scheduleHide);

  tooltip.addEventListener('click', function(event) {
    var link = event.target.closest('.vuln-action');
    if (!link) { return; }
    event.preventDefault();
    var issue = JSON.parse(link.getAttribute('data-issue'));
    vscode.postMessage({ command: link.getAttribute('data-action'), issue: issue });
    tooltip.style.display = 'none';
  });
})();

// ── Receive scroll-to-vulnerability messages from the extension ──
window.addEventListener('message', function(event) {
  var msg = event.data;
  if (!msg || msg.command !== 'scrollToVuln') { return; }

  var filename = msg.filename;  // repo-relative path from CheckmarxIssue
  var line     = msg.line;      // 1-based line number

  var blocks = document.querySelectorAll('.file-block');
  var targetRow = null;

  for (var i = 0; i < blocks.length; i++) {
    var block    = blocks[i];
    var blockFile = block.getAttribute('data-filename');

    // Exact match first, then basename match as fallback
    var isMatch = (blockFile === filename) ||
                  (filename && blockFile &&
                   blockFile.split('/').pop() === filename.split('/').pop());
    if (!isMatch) { continue; }

    // Expand the diff body if it is currently collapsed
    var body = block.querySelector('.diff-body');
    var btn  = block.querySelector('.toggle-btn');
    if (body && body.classList.contains('hidden')) {
      body.classList.remove('hidden');
      if (btn) { btn.classList.remove('collapsed'); }
    }

    // Find the row for the target line
    if (line) {
      var rows = block.querySelectorAll('tr[data-new-line="' + line + '"]');
      if (rows.length > 0) { targetRow = rows[0]; }
    }

    // If no specific row matched, scroll to the file block header
    if (!targetRow) { block.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    break;
  }

  if (targetRow) {
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetRow.classList.add('vuln-flash');
    setTimeout(function() { targetRow.classList.remove('vuln-flash'); }, 2000);
  }
});
</script>
</body>
</html>`;
}
