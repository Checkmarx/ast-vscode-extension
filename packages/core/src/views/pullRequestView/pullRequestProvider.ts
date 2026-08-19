import * as vscode from 'vscode';
import { CheckmarxIssue, GitHubService, PullRequest, RepoInfo } from '../../services/githubService';
import { Logs } from '../../models/logs';
import { getCommandPrefix } from '../../config/extensionConfig';

export class PullRequestItem extends vscode.TreeItem {
    // undefined = not yet fetched; array = cached result (may be empty)
    public children: vscode.TreeItem[] | undefined;

    constructor(
        public readonly pr: PullRequest,
        public readonly repoInfo: RepoInfo,
    ) {
        super(`#${pr.number}  ${pr.title}`, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = new vscode.MarkdownString(
            `**${pr.title}**\n\nBy: \`${pr.user.login}\`  |  \`${pr.head.ref}\` → \`${pr.base.ref}\``
        );
        this.description = `${pr.user.login} · ${pr.head.ref} → ${pr.base.ref}`;
        this.iconPath = pr.draft
            ? new vscode.ThemeIcon('git-pull-request-draft', new vscode.ThemeColor('charts.yellow'))
            : new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.green'));
        this.command = {
            command: `${getCommandPrefix()}.openPullRequestDiff`,
            title: 'Open Pull Request Diff',
            arguments: [this],
        };
        this.contextValue = 'pullRequestItem';
    }

    /** Reflects the Checkmarx issue count on the PR row, mirroring the Problems panel's per-file count. */
    setIssueCount(count: number): void {
        const base = `#${this.pr.number}  ${this.pr.title}`;
        this.label = count > 0 ? `${base}  (${count})` : base;
        this.tooltip = new vscode.MarkdownString(
            `**${this.pr.title}**\n\nBy: \`${this.pr.user.login}\`  |  \`${this.pr.head.ref}\` → \`${this.pr.base.ref}\`` +
            (count > 0 ? `\n\n**${count}** Checkmarx issue${count !== 1 ? 's' : ''}` : '')
        );
    }
}

export class NewIssueItem extends vscode.TreeItem {
    constructor(
        public readonly issue: CheckmarxIssue,
        public readonly prItem: PullRequestItem,
        public readonly index: number,
    ) {
        super(issue.name, vscode.TreeItemCollapsibleState.None);

        const shortName = issue.fileName
            ? (issue.fileName.includes('/') || issue.fileName.includes('\\')
                ? issue.fileName.slice(Math.max(issue.fileName.lastIndexOf('/'), issue.fileName.lastIndexOf('\\')) + 1)
                : issue.fileName)
            : '';

        this.description = shortName
            ? (issue.line > 0 ? `${shortName}:${issue.line}` : shortName)
            : '';
        this.tooltip = `[${issue.severity}] ${issue.name}\n${issue.fileName}${issue.line > 0 ? ':' + issue.line : ''}`;
        this.iconPath = NewIssueItem.severityIcon(issue.severity);
        this.contextValue = 'pullRequestNewIssue';

        // Clicking the item opens/focuses the PR diff webview and scrolls to the vulnerable line
        this.command = {
            command: `${getCommandPrefix()}.openPRIssueLocation`,
            title: 'Go to Issue in PR Diff',
            arguments: [issue, prItem],
        };
    }

    private static severityIcon(severity: string): vscode.ThemeIcon {
        switch (severity) {
            case 'CRITICAL':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            case 'HIGH':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
            case 'MEDIUM':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
            case 'LOW':
                return new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'));
            case 'INFO':
                return new vscode.ThemeIcon('info');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}

class StatusItem extends vscode.TreeItem {
    constructor(message: string, iconId: string) {
        super(message, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(iconId);
        this.contextValue = 'pullRequestStatus';
    }
}

export class PullRequestProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private items: vscode.TreeItem[] = [];
    // Unfiltered PR items from the last successful load — the author filter is applied on top of this.
    private allPrItems: PullRequestItem[] = [];
    private _authorFilter: string | undefined;
    private _repoInfo: RepoInfo | undefined;
    private _loaded = false;
    private readonly githubService = GitHubService.getInstance();

    constructor(private readonly logs: Logs) {}

    /** Currently selected author filter, or undefined if showing PRs from all authors. */
    get authorFilter(): string | undefined {
        return this._authorFilter;
    }

    /** Unique PR author usernames from the last successful load, sorted alphabetically. */
    getAvailableAuthors(): string[] {
        return Array.from(new Set(this.allPrItems.map(item => item.pr.user.login))).sort();
    }

    /** Applies (or clears, when author is undefined) the author filter and refreshes the tree. */
    setAuthorFilter(author: string | undefined): void {
        this._authorFilter = author;
        this.applyAuthorFilter();
        this._onDidChangeTreeData.fire(undefined);
    }

    private applyAuthorFilter(): void {
        if (this.allPrItems.length === 0) {
            return;
        }
        if (!this._authorFilter) {
            this.items = this.allPrItems;
            return;
        }
        const filtered = this.allPrItems.filter(item => item.pr.user.login === this._authorFilter);
        this.items = filtered.length > 0
            ? filtered
            : [new StatusItem(`No open pull requests from ${this._authorFilter}`, 'info')];
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            return this.items;
        }
        if (element instanceof PullRequestItem) {
            if (element.children !== undefined) {
                return element.children;
            }
            return this.loadIssuesForPR(element);
        }
        return [];
    }

    get repoInfo(): RepoInfo | undefined {
        return this._repoInfo;
    }

    /** Called when the view becomes visible — only loads if not already loaded. */
    async refreshIfNeeded(): Promise<void> {
        if (!this._loaded) {
            await this.refresh();
        }
    }

    /** Call this to trigger a full reload (e.g. refresh button). */
    async refresh(): Promise<void> {
        this._loaded = false;
        this.items = [new StatusItem('Loading pull requests…', 'loading~spin')];
        this._onDidChangeTreeData.fire(undefined);

        try {
            this._repoInfo = await this.githubService.getRepoInfo();

            if (!this._repoInfo) {
                this.allPrItems = [];
                this.items = [new StatusItem('No GitHub repository detected in this workspace', 'warning')];
                this._onDidChangeTreeData.fire(undefined);
                return;
            }

            const prs = await this.githubService.getPullRequests(this._repoInfo);

            if (prs.length === 0) {
                this.allPrItems = [];
                this.items = [new StatusItem('No open pull requests', 'info')];
            } else {
                const prItems = prs.map(pr => new PullRequestItem(pr, this._repoInfo!));
                // Fetch each PR's Checkmarx issue count up front so it's visible on the
                // parent row without expanding — mirrors the Problems panel's per-file count.
                await Promise.all(prItems.map(async prItem => {
                    const children = await this.loadIssuesForPR(prItem);
                    const count = children.filter(c => c instanceof NewIssueItem).length;
                    prItem.setIssueCount(count);
                }));
                this.allPrItems = prItems;
                this.applyAuthorFilter();
            }

            this._loaded = true;
            this.logs.info(`Pull Requests: loaded ${prs.length} open PR(s) for ${this._repoInfo.owner}/${this._repoInfo.repo}`);
        } catch (err: any) {
            const status = (err as any)?.response?.status;
            const rawMessage = err?.response?.data?.message ?? err?.message ?? String(err);
            const message = status === 403 || status === 429
                ? 'GitHub API rate limit exceeded — sign in to GitHub to increase the limit'
                : rawMessage;
            this.allPrItems = [];
            this.items = [new StatusItem(`Error: ${message}`, 'error')];
            this.logs.error(`Pull Requests: failed to load — ${rawMessage}`);
        }

        this._onDidChangeTreeData.fire(undefined);
    }

    private async loadIssuesForPR(prItem: PullRequestItem): Promise<vscode.TreeItem[]> {
        try {
            const comments = await this.githubService.getPullRequestComments(
                prItem.repoInfo,
                prItem.pr.number
            );

            const issues = GitHubService.parseCheckmarxNewIssues(comments);

            if (issues.length === 0) {
                const hasCheckmarxComment = comments.some(c => c.body?.includes('Checkmarx'));
                prItem.children = [
                    new StatusItem(
                        hasCheckmarxComment
                            ? 'No new issues found in Checkmarx scan'
                            : 'No Checkmarx scan comment found for this PR',
                        hasCheckmarxComment ? 'pass' : 'info'
                    ),
                ];
            } else {
                prItem.children = issues.map((issue, i) => new NewIssueItem(issue, prItem, i + 1));
                this.logs.info(
                    `Pull Requests: ${issues.length} new issue(s) for PR #${prItem.pr.number}`
                );
            }

            return prItem.children;
        } catch (err: any) {
            const status = (err as any)?.response?.status;
            const rawMessage = err?.response?.data?.message ?? err?.message ?? String(err);
            const message = status === 403 || status === 429
                ? 'GitHub API rate limit exceeded — sign in to GitHub to increase the limit'
                : rawMessage;
            // Don't cache the error — leave children undefined so the user can retry
            this.logs.error(
                `Pull Requests: failed to load issues for PR #${prItem.pr.number} — ${rawMessage}`
            );
            return [new StatusItem(`Error: ${message}`, 'error')];
        }
    }
}
