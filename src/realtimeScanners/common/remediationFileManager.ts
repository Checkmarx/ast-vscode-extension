import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logs } from '../../models/logs';

export interface RemediationEntry {
    id: string;
    timestamp: string;
    vulnerabilityType: 'oss' | 'secrets' | 'containers' | 'iac' | 'asca';
    title: string;
    severity: string;
    description: string;
    filePath: string;
    startLine: number;
    endLine: number;
    originalCode: string;
    fixedCode: string;
    fixMethod: 'copilot' | 'cursor' | 'windsurf' | 'kiro' | 'manual';
    fixStrategy: 'ai-assisted' | 'manual' | 'auto';
    linesChanged: number;
    dateAdded: string;
}

export class RemediationFileManager {
    private static instance: RemediationFileManager;
    private workspacePath: string = '';
    private workspaceRootPath: string = '';
    private remediationData: Record<string, RemediationEntry> = {};
    private statusBarUpdateCallback?: () => void;
    private uiRefreshCallback?: () => void;
    private fileWatcher?: fs.FSWatcher;

    private constructor() { }

    public static getInstance(): RemediationFileManager {
        if (!RemediationFileManager.instance) {
            RemediationFileManager.instance = new RemediationFileManager();
        }
        return RemediationFileManager.instance;
    }

    public initialize(workspaceFolder: vscode.WorkspaceFolder): void {
        this.workspacePath = path.join(workspaceFolder.uri.fsPath, '.vscode');
        this.workspaceRootPath = workspaceFolder.uri.fsPath;
        console.log(`[RemediationFileManager] Initializing with workspace: ${this.workspaceRootPath}`);
        console.log(`[RemediationFileManager] Remediation file path: ${this.getRemediationFilePath()}`);
        this.ensureRemediationFileExists();
        this.loadRemediationData();
        this.startFileWatcher();
    }

    public setStatusBarUpdateCallback(callback: () => void): void {
        this.statusBarUpdateCallback = callback;
    }

    public setUiRefreshCallback(callback: () => void): void {
        this.uiRefreshCallback = callback;
    }

    public updateStatusBar(): void {
        this.loadRemediationData();
        if (this.statusBarUpdateCallback) {
            this.statusBarUpdateCallback();
        }
    }

    private startFileWatcher(): void {
        this.stopFileWatcher();

        const remediationFilePath = this.getRemediationFilePath();
        if (fs.existsSync(remediationFilePath)) {
            this.fileWatcher = fs.watch(remediationFilePath, async (eventType) => {
                if (eventType === 'change') {
                    await this.handleFileChange();
                }
            });
        }
    }

    private stopFileWatcher(): void {
        if (this.fileWatcher) {
            this.fileWatcher.close();
            this.fileWatcher = undefined;
        }
    }

    private async handleFileChange(): Promise<void> {
        this.loadRemediationData();
        if (this.uiRefreshCallback) {
            this.uiRefreshCallback();
        }
    }

    private ensureRemediationFileExists(): void {
        if (!fs.existsSync(this.workspacePath)) {
            fs.mkdirSync(this.workspacePath, { recursive: true });
        }
        const remediationFilePath = this.getRemediationFilePath();
        if (!fs.existsSync(remediationFilePath)) {
            fs.writeFileSync(remediationFilePath, JSON.stringify({}, null, 2));
        }
    }

    private loadRemediationData(): void {
        try {
            const data = fs.readFileSync(this.getRemediationFilePath(), 'utf-8');
            this.remediationData = JSON.parse(data);
        } catch {
            this.remediationData = {};
        }
    }

    private getRemediationFilePath(): string {
        return path.join(this.workspacePath, '.checkmarxRemediation');
    }

    public hasRemediationFile(): boolean {
        return fs.existsSync(this.getRemediationFilePath());
    }

    public getRemediationsData(): Record<string, RemediationEntry> {
        return this.remediationData;
    }

    public getRemediation(remediationId: string): RemediationEntry | undefined {
        return this.remediationData[remediationId];
    }

    public getRemediationsCount(): number {
        if (!fs.existsSync(this.getRemediationFilePath())) {
            return 0;
        }
        return Object.keys(this.remediationData).length;
    }

    public addRemediation(entry: RemediationEntry): void {
        const key = entry.id;
        console.log(`[RemediationFileManager] Adding remediation: ${key}`);
        console.log(`[RemediationFileManager] Title: ${entry.title}`);
        this.remediationData[key] = entry;
        this.saveRemediationFile();
        console.log(`[RemediationFileManager] Total remediations: ${Object.keys(this.remediationData).length}`);
        this.uiRefreshCallback?.();
    }

    public deleteRemediation(remediationId: string): boolean {
        if (!this.remediationData[remediationId]) {
            return false;
        }
        delete this.remediationData[remediationId];
        this.saveRemediationFile();
        this.uiRefreshCallback?.();
        return true;
    }

    private saveRemediationFile(): void {
        const filePath = this.getRemediationFilePath();
        console.log(`[RemediationFileManager] Saving to: ${filePath}`);
        fs.writeFileSync(filePath, JSON.stringify(this.remediationData, null, 2));
        console.log(`[RemediationFileManager] File saved successfully`);
        if (this.statusBarUpdateCallback) {
            console.log(`[RemediationFileManager] Calling status bar update callback`);
            this.statusBarUpdateCallback();
        } else {
            console.log(`[RemediationFileManager] ⚠️ No status bar callback registered!`);
        }
    }

    public dispose(): void {
        this.stopFileWatcher();
    }
}

