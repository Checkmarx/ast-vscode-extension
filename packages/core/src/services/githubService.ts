import * as vscode from 'vscode';
import axios from 'axios';

export interface PullRequest {
    number: number;
    title: string;
    state: string;
    user: { login: string; avatar_url: string };
    head: { ref: string; sha: string };
    base: { ref: string };
    html_url: string;
    created_at: string;
    updated_at: string;
    body: string | null;
    draft: boolean;
    additions: number;
    deletions: number;
    changed_files: number;
}

export interface PullRequestFile {
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    previous_filename?: string;
}

export interface RepoInfo {
    owner: string;
    repo: string;
}

export interface PullRequestComment {
    id: number;
    user: { login: string };
    body: string;
    created_at: string;
}

export interface CheckmarxIssue {
    severity: string;
    name: string;
    fileName: string;
    line: number;
}

export interface PullRequestCommit {
    sha: string;
    html_url: string;
    commit: {
        message: string;
        author: { name: string; date: string };
    };
}

export interface CommitMessageForReview {
    sha: string;
    /** First line only. */
    message: string;
    /** Full commit message (summary + body) — sent to the AI assistant for its own risk judgment. */
    fullMessage: string;
    author: string;
    html_url: string;
}

export class GitHubService {
    private static instance: GitHubService;
    private _promptedForAuth = false;

    static getInstance(): GitHubService {
        if (!GitHubService.instance) {
            GitHubService.instance = new GitHubService();
        }
        return GitHubService.instance;
    }

    async getRepoInfo(): Promise<RepoInfo | undefined> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            const api = gitExtension?.getAPI(1);
            if (!api || api.repositories.length === 0) {
                return undefined;
            }
            const repo = api.repositories[0];
            const remoteUrl =
                repo.state.remotes.find((r: any) => r.name === 'origin')?.fetchUrl ??
                repo.state.remotes[0]?.fetchUrl;
            if (!remoteUrl) {
                return undefined;
            }
            return this.parseGitHubUrl(remoteUrl);
        } catch {
            return undefined;
        }
    }

    private parseGitHubUrl(url: string): RepoInfo | undefined {
        // https://github.com/owner/repo.git or https://github.com/owner/repo
        const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
        if (httpsMatch) {
            return { owner: httpsMatch[1], repo: httpsMatch[2] };
        }
        // git@github.com:owner/repo.git
        const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/);
        if (sshMatch) {
            return { owner: sshMatch[1], repo: sshMatch[2] };
        }
        return undefined;
    }

    private async getToken(): Promise<string | undefined> {
        try {
            // Try silently first (no prompt)
            const silent = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
            if (silent) {
                return silent.accessToken;
            }
            // Prompt once per extension session so the user gets authenticated rate limits (5000/hr vs 60/hr)
            if (!this._promptedForAuth) {
                this._promptedForAuth = true;
                const prompted = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
                return prompted?.accessToken;
            }
            return undefined;
        } catch {
            return undefined;
        }
    }

    private buildHeaders(token?: string): Record<string, string> {
        const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'vscode-checkmarx-extension',
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }
        return headers;
    }

    async getPullRequests(repoInfo: RepoInfo): Promise<PullRequest[]> {
        const token = await this.getToken();
        const response = await axios.get<PullRequest[]>(
            `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls?state=open&per_page=50&sort=updated&direction=desc`,
            { headers: this.buildHeaders(token) }
        );
        return response.data;
    }

    async getPullRequestFiles(repoInfo: RepoInfo, prNumber: number): Promise<PullRequestFile[]> {
        const token = await this.getToken();
        const response = await axios.get<PullRequestFile[]>(
            `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls/${prNumber}/files?per_page=100`,
            { headers: this.buildHeaders(token) }
        );
        return response.data;
    }

    async getPullRequest(repoInfo: RepoInfo, prNumber: number): Promise<PullRequest> {
        const token = await this.getToken();
        const response = await axios.get<PullRequest>(
            `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls/${prNumber}`,
            { headers: this.buildHeaders(token) }
        );
        return response.data;
    }

    async postComment(repoInfo: RepoInfo, prNumber: number, body: string): Promise<void> {
        const token = await this.getToken();
        if (!token) {
            throw new Error('GitHub authentication required to post a comment');
        }
        await axios.post(
            `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${prNumber}/comments`,
            { body },
            { headers: this.buildHeaders(token) }
        );
    }

    async getPullRequestCommits(repoInfo: RepoInfo, prNumber: number): Promise<PullRequestCommit[]> {
        const token = await this.getToken();
        const response = await axios.get<PullRequestCommit[]>(
            `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls/${prNumber}/commits?per_page=100`,
            { headers: this.buildHeaders(token) }
        );
        return response.data;
    }

    /** Maps raw commits to the shape sent for AI review — no local risk matching, the AI judges risk itself. */
    static toCommitMessagesForReview(commits: PullRequestCommit[]): CommitMessageForReview[] {
        return commits.map(commit => ({
            sha: commit.sha,
            message: commit.commit.message.split('\n')[0],
            fullMessage: commit.commit.message,
            author: commit.commit.author.name,
            html_url: commit.html_url,
        }));
    }

    /**
     * Resolves a repo-relative path (as reported in a PR's file list/issue table) to a real file in the
     * current workspace, so PR-diff actions (Fix/View details) can open and edit the actual source file.
     * Tries an exact join against each workspace folder first, then falls back to a basename search for
     * workspaces whose root isn't the repo root (e.g. a monorepo subfolder).
     */
    static async resolveWorkspaceFile(relativePath: string): Promise<vscode.Uri | undefined> {
        const normalized = relativePath.replace(/\\/g, '/');

        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const candidate = vscode.Uri.joinPath(folder.uri, normalized);
            try {
                await vscode.workspace.fs.stat(candidate);
                return candidate;
            } catch {
                // Not in this workspace folder — try the next one.
            }
        }

        const basename = normalized.split('/').pop();
        if (!basename) { return undefined; }
        const matches = await vscode.workspace.findFiles(`**/${basename}`, '**/node_modules/**', 20);
        return matches.find(uri => uri.fsPath.replace(/\\/g, '/').endsWith(normalized));
    }

    async getPullRequestComments(repoInfo: RepoInfo, prNumber: number): Promise<PullRequestComment[]> {
        const token = await this.getToken();
        const response = await axios.get<PullRequestComment[]>(
            `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${prNumber}/comments?per_page=100`,
            { headers: this.buildHeaders(token) }
        );
        return response.data;
    }

    /**
     * Finds the Checkmarx One PR-decoration comment and parses its "New Issues" table.
     *
     * Actual row format from the GitHub API (no leading/trailing pipe):
     *   N<!--resultId SAST-->|![SEVERITY](url)|[IssueName](url)|path/file\\.java: [line](url)|<details>...</details>
     */
    static parseCheckmarxNewIssues(comments: PullRequestComment[]): CheckmarxIssue[] {
        const cxComment = comments.find(c => c.body?.includes('Checkmarx'));
        if (!cxComment) {
            return [];
        }
        return GitHubService.parseNewIssuesRows(cxComment.body);
    }

    /**
     * Extracts only the "New Issues" section of the comment body (bounded by
     * <!--new issues section--> HTML comment markers) and parses each data row.
     */
    private static parseNewIssuesRows(body: string): CheckmarxIssue[] {
        const issues: CheckmarxIssue[] = [];

        // Isolate the New Issues block so we don't accidentally parse Fixed Issues rows
        const marker = '<!--new issues section-->';
        const firstMarker = body.indexOf(marker);
        const secondMarker = firstMarker >= 0
            ? body.indexOf(marker, firstMarker + marker.length)
            : -1;
        const section = firstMarker >= 0
            ? (secondMarker > firstMarker
                ? body.slice(firstMarker + marker.length, secondMarker)
                : body.slice(firstMarker + marker.length))
            : body;

        for (const rawLine of section.split('\n')) {
            const trimmed = rawLine.trim();

            // New Issues rows always begin with: N<!--resultId TYPE-->|
            // e.g. 1<!--1 FSse8u4Y6ruVyMqn4okBRW6yELQ%3D SAST-->|
            if (!/^\d+<!--/.test(trimmed)) { continue; }

            // Split on | — row has 5 cells (no leading/trailing pipe)
            const cells = trimmed.split('|');
            if (cells.length < 4) { continue; }

            const [numCell, severityCell, issueCell, fileCell] = cells;

            // Double-check first cell is purely numeric after stripping the HTML comment
            const numOnly = numCell.replace(/<!--[\s\S]*?-->/g, '').trim();
            if (!/^\d+$/.test(numOnly)) { continue; }

            // Severity: ![CRITICAL](url) → 'CRITICAL'
            const severity = GitHubService.parseSeverityFromAlt(severityCell);

            // Issue name: [Second_Order_SQL_Injection](url) → 'Second_Order_SQL_Injection'
            const nameMatch = issueCell.match(/\[([^\]]+)\]/);
            if (!nameMatch) { continue; }
            const name = nameMatch[1];

            // File + line: src/path/File\\.java: [55](github_url)
            const { fileName, line } = GitHubService.parseFileCell(fileCell);

            issues.push({ severity, name, fileName, line });
        }

        return issues;
    }

    /** Extracts severity from a Markdown image alt: ![CRITICAL](url) → 'CRITICAL' */
    private static parseSeverityFromAlt(cell: string): string {
        const altMatch = cell.match(/!\[([A-Z]+)\]/);
        if (altMatch) {
            switch (altMatch[1]) {
                case 'CRITICAL': return 'CRITICAL';
                case 'HIGH':     return 'HIGH';
                case 'MEDIUM':   return 'MEDIUM';
                case 'LOW':      return 'LOW';
                case 'INFO':     return 'INFO';
            }
        }
        // Fallback: look for severity keywords anywhere in the cell text
        const lower = cell.toLowerCase();
        if (lower.includes('critical')) { return 'CRITICAL'; }
        if (lower.includes('high'))     { return 'HIGH'; }
        if (lower.includes('medium'))   { return 'MEDIUM'; }
        if (lower.includes('low'))      { return 'LOW'; }
        if (lower.includes('info'))     { return 'INFO'; }
        return 'UNKNOWN';
    }

    /**
     * Parses the "Source File / Package" cell.
     * Format: src/path/File\\.java: [55](https://github.com/...)
     * The line number is a Markdown link; backslashes are Markdown escape chars.
     */
    private static parseFileCell(raw: string): { fileName: string; line: number } {
        const text = raw.trim();

        // Primary: line number expressed as Markdown link — ": [55](url)"
        const lineMatch = text.match(/:\s*\[(\d+)\]/);
        if (lineMatch) {
            const line = parseInt(lineMatch[1], 10);
            const colonIdx = text.indexOf(lineMatch[0]);
            // File path is everything before ": [55]", with escape backslashes removed
            const fileName = text.slice(0, colonIdx).trim().replace(/\\/g, '');
            return { fileName, line };
        }

        // Fallback: plain "file.java:55" format
        const lastColon = text.lastIndexOf(':');
        if (lastColon > 0) {
            const afterColon = text.slice(lastColon + 1).trim();
            if (/^\d+$/.test(afterColon)) {
                return {
                    fileName: text.slice(0, lastColon).trim().replace(/\\/g, ''),
                    line: parseInt(afterColon, 10),
                };
            }
        }

        return { fileName: text.replace(/\\/g, ''), line: 0 };
    }
}
