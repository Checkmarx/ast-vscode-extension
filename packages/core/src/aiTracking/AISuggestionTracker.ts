import * as vscode from "vscode";
import { randomUUID } from "crypto";
import { Logs } from "../models/logs";
import {
    PendingAIFix,
    FixOutcome,
    FixOutcomeTelemetry,
    TrackerConfig,
    DEFAULT_TRACKER_CONFIG,
    ScannerType,
    AI_FIX_EVENTS
} from "./types";
import { FixValidator, HashValidator } from "./validators";
import {
    HoverData,
    AscaHoverData,
    ContainersHoverData,
    IacHoverData,
    SecretsHoverData,
    CxDiagnosticData
} from "../realtimeScanners/common/types";
import { cx } from "../cx";

import {
    isAscaHoverData,
    isSecretsHoverData,
    isContainersHoverData,
    isIacHoverData
} from "../utils/utils";
type AnyHoverData = HoverData | AscaHoverData | ContainersHoverData | IacHoverData | SecretsHoverData;

export class AISuggestionTracker {
    private static instance: AISuggestionTracker;

    private pendingFixes: Map<string, PendingAIFix> = new Map();

    private config: TrackerConfig;

    private context: vscode.ExtensionContext;

    private logs: Logs;

    private saveListener: vscode.Disposable | undefined;

    private changeListener: vscode.Disposable | undefined;

    private changeDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

    private pendingConfirmation: Map<string, { detectedAt: number; detectedValue: string | null }> = new Map();

    private validator: FixValidator;

    private activeIntervals: Map<string, NodeJS.Timeout> = new Map();

    private constructor(context: vscode.ExtensionContext, logs: Logs, config?: Partial<TrackerConfig>, validator?: FixValidator) {
        this.pendingFixes.clear();
        this.changeDebounceTimers.clear();
        this.pendingConfirmation.clear();
        this.activeIntervals.clear();

        this.context = context;
        this.logs = logs;
        this.config = { ...DEFAULT_TRACKER_CONFIG, ...config };
        this.validator = validator || new HashValidator(logs);

        if (this.config.checkOnSave) {
            this.registerSaveListener();
            this.registerChangeListener();
        }
    }

    static getInstance(context?: vscode.ExtensionContext, logs?: Logs): AISuggestionTracker {
        if (!AISuggestionTracker.instance) {
            if (!context || !logs) {
                throw new Error("AISuggestionTracker must be initialized with context and logs first");
            }
            AISuggestionTracker.instance = new AISuggestionTracker(context, logs);
        }
        return AISuggestionTracker.instance;
    }

    private getEventNameFromStatus(status: FixOutcome['status']): string {
        switch (status) {
            case 'changes_accepted':
                return AI_FIX_EVENTS.changesAccepted;
            case 'changes_rejected':
                return AI_FIX_EVENTS.changesRejected;
            default:
                return AI_FIX_EVENTS.changesRejected;
        }
    }

    static initialize(context: vscode.ExtensionContext, logs: Logs, config?: Partial<TrackerConfig>, validator?: FixValidator): AISuggestionTracker {
        AISuggestionTracker.instance = new AISuggestionTracker(context, logs, config, validator);
        return AISuggestionTracker.instance;
    }

    private registerSaveListener(): void {
        this.saveListener = vscode.workspace.onDidSaveTextDocument(
            (document) => this.onFileSaved(document)
        );
    }

    private registerChangeListener(): void {
        this.changeListener = vscode.workspace.onDidChangeTextDocument(
            (event) => this.onFileChanged(event)
        );
    }

    /**
     * Handle file change event - debounced check for pending fixes
     * When ghost text appears and the vulnerability disappears from diagnostics,
     * we wait for the ghost text to fully disappear before validating with hash comparison.
     */
    private onFileChanged(event: vscode.TextDocumentChangeEvent): void {
        const filePath = event.document.uri.fsPath;

        if (event.contentChanges.length === 0) {
            return;
        }

        const fixesForFile = Array.from(this.pendingFixes.values())
            .filter(fix => fix.filePath === filePath);

        if (fixesForFile.length === 0) {
            return;
        }

        const existingTimer = this.changeDebounceTimers.get(filePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const debounceTimer = setTimeout(async () => {
            this.changeDebounceTimers.delete(filePath);
            for (const fix of fixesForFile) {
                await this.checkFixOutcome(fix);
            }
        }, 10000);

        this.changeDebounceTimers.set(filePath, debounceTimer);
    }

    /**
     * Handle file save event - check if any pending fixes were applied
     * Finalized on save as well as ghost text disappears
     */
    private async onFileSaved(document: vscode.TextDocument): Promise<void> {
        const filePath = document.uri.fsPath;

        const existingTimer = this.changeDebounceTimers.get(filePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.changeDebounceTimers.delete(filePath);
        }

        const fixesForFile = Array.from(this.pendingFixes.values())
            .filter(fix => fix.filePath === filePath);

        if (fixesForFile.length === 0) {
            return;
        }

        for (const fix of fixesForFile) {
            await this.checkFixOutcome(fix);
        }
    }

    /**
     * Generate a unique vulnerability key
     */
    private getVulnerabilityKey(item: AnyHoverData, scannerType: ScannerType): string {
        const filePath = this.getFilePath(item);
        const line = this.getLine(item);

        switch (scannerType) {
            case 'Oss': {
                const ossItem = item as HoverData;
                return `oss:${ossItem.packageManager}:${ossItem.packageName}:${ossItem.version}:${filePath}`;
            }
            case 'Secrets': {
                const secretsItem = item as SecretsHoverData;
                const line = secretsItem.location?.line ?? 0;
                const secretType = secretsItem.title || 'unknown';
                const secretValueHash = secretsItem.secretValue
                    ? secretsItem.secretValue.substring(0, 8)
                    : 'unknown';
                return `secrets:${secretType}:${line}:${secretValueHash}:${filePath}`;
            }
            case 'Asca': {
                const ascaItem = item as AscaHoverData;
                const ruleId = ascaItem.ruleId || ascaItem.ruleName;
                return `asca:${ruleId}:${filePath}`;
            }
            case 'Containers': {
                const containersItem = item as ContainersHoverData;
                return `containers:${containersItem.imageName}:${containersItem.imageTag}:${filePath}`;
            }
            case 'IaC': {
                const iacItem = item as IacHoverData;
                return `iac:${iacItem.similarityId}:${filePath}`;
            }
            default:
                return `unknown:${scannerType}:${line}:${filePath}`;
        }
    }

    private getFilePath(item: AnyHoverData): string {
        if ('filePath' in item && item.filePath) {
            return item.filePath;
        }
        return vscode.window.activeTextEditor?.document.uri.fsPath || '';
    }

    private getLine(item: AnyHoverData): number {
        if ('line' in item && typeof item.line === 'number') {
            return item.line;
        }
        if ('location' in item && item.location?.line !== undefined) {
            return item.location.line;
        }
        return 0;
    }

    private getScannerType(item: AnyHoverData): ScannerType {
        if (isAscaHoverData(item)) { return 'Asca'; }
        if (isSecretsHoverData(item)) { return 'Secrets'; }
        if (isContainersHoverData(item)) { return 'Containers'; }
        if (isIacHoverData(item)) { return 'IaC'; }
        return 'Oss';
    }

    private getSeverity(item: AnyHoverData): string {
        if ('severity' in item && item.severity) {
            return item.severity;
        }
        if ('status' in item) {
            return String(item.status);
        }
        return 'unknown';
    }

    /**
     * Track a new AI fix request
     * Called when user clicks "Fix with CxOne Assist"
     */
    async trackFixRequest(item: AnyHoverData): Promise<string> {
        const scannerType = this.getScannerType(item);
        const vulnKey = this.getVulnerabilityKey(item, scannerType);
        const filePath = this.getFilePath(item);
        const severity = this.getSeverity(item);

        this.logs.info(`User requested AI fix for ${scannerType} vulnerability`);

        // Check for duplicate request
        const existing = this.pendingFixes.get(vulnKey);
        if (existing) {
            existing.requestCount++;
            existing.requestedAt = Date.now();

            const eventName = AI_FIX_EVENTS.duplicate;
            await this.sendTelemetry(eventName, {
                scannerType,
                severity,
                vulnerabilityKey: vulnKey,
                requestCount: existing.requestCount,
            });

            return existing.id;
        }

        let validatorState: unknown;
        try {
            validatorState = await this.validator.captureInitialState(filePath);
        } catch (error) {
            throw error;
        }

        const fix: PendingAIFix = {
            id: randomUUID(),
            vulnerabilityKey: vulnKey,
            filePath: filePath,
            line: this.getLine(item),
            scannerType,
            severity,
            validatorState: validatorState,
            requestedAt: Date.now(),
            requestCount: 1,
            originalItem: item
        };

        this.pendingFixes.set(vulnKey, fix);

        // Send request telemetry , no need as we alrady have fixWithAIChat request
        /*
            const eventName = AI_FIX_EVENTS.requested;
            this.sendTelemetry(eventName, {
              scannerType,
              severity: fix.severity,
              vulnerabilityKey: vulnKey
            });
        */
        //this.logs.info(`[AITracker] ========== FIX REQUEST TRACKED ==========`);

        return fix.id;
    }

    private async checkFixOutcome(fix: PendingAIFix): Promise<void> {
        const currentValue = await this.getCurrentValue(fix);
        const isFixed = currentValue === null;

        if (isFixed) {
            const intervalKey = fix.vulnerabilityKey;

            if (this.activeIntervals.has(intervalKey)) {
                clearInterval(this.activeIntervals.get(intervalKey)!);
                this.activeIntervals.delete(intervalKey);
            }

            let attempts = 0;
            const checkInterval = setInterval(async () => {
                attempts++;

                const activeEditor = vscode.window.activeTextEditor;
                const vulnerabilityStatus = await this.getCurrentValue(fix);

                // Check if ghost text disappeared
                const fileNotActive = !activeEditor || activeEditor.document.uri.fsPath !== fix.filePath;
                const vulnerabilityBack = vulnerabilityStatus !== null;
                const timeout = attempts >= 150;

                if (fileNotActive || vulnerabilityBack || timeout) {
                    clearInterval(checkInterval);
                    this.activeIntervals.delete(intervalKey);

                    if (timeout) {
                        return; // Don't finalize
                    }

                    if (fix.scannerType === 'Secrets') {
                        if (vulnerabilityBack) {
                            await this.finalizeFix(fix, 'changes_rejected');
                        } else {
                            const fileChanged = await this.validator.validate(fix.filePath, fix.validatorState);
                            if (fileChanged) {
                                await this.finalizeFix(fix, 'changes_accepted');
                            }
                        }
                    } else {
                        const fileChanged = await this.validator.validate(fix.filePath, fix.validatorState);
                        const vulnerabilityGone = await this.getCurrentValue(fix) === null;
                        const changesAccepted = fileChanged && vulnerabilityGone;
                        const outcome = changesAccepted ? 'changes_accepted' : 'changes_rejected';
                        await this.finalizeFix(fix, outcome);
                    }
                }
            }, 2000);

            this.activeIntervals.set(intervalKey, checkInterval);
        }
    }

    private async hasActiveInlineSuggestion(uri: vscode.Uri, fix: PendingAIFix): Promise<boolean> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor || activeEditor.document.uri.fsPath !== uri.fsPath) {
                return false;
            }

            // CRITICAL FIX: Add grace period check
            const timeSinceRequest = Date.now() - fix.requestedAt;
            const gracePeriodMs = 25 * 1000; // 60 seconds (adjust as needed)

            if (timeSinceRequest < gracePeriodMs) {
                return true;
            }

            const pendingConf = this.pendingConfirmation.get(fix.vulnerabilityKey);
            if (pendingConf) {
                const timeSinceDetection = Date.now() - pendingConf.detectedAt;
                if (timeSinceDetection < 2000) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    private async getCurrentValue(fix: PendingAIFix): Promise<string | null> {
        const uri = vscode.Uri.file(fix.filePath);

        const hasActiveSuggestion = await this.hasActiveInlineSuggestion(uri, fix);

        if (hasActiveSuggestion) {
            return 'pending_user_action';
        }
        const diagnostics = vscode.languages.getDiagnostics(uri);

        const scannerDiagnostics = diagnostics.filter(d => {
            const data = (d as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
            return data?.cxType === fix.scannerType;
        });

        let matchingDiagnosticCount = 0;

        for (const diagnostic of scannerDiagnostics) {
            const data = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
            if (!data?.item) {
                continue;
            }

            if (this.diagnosticMatchesFix(data, fix)) {
                matchingDiagnosticCount++;
                const currentValue = this.extractValueFromDiagnostic(data, fix.scannerType);
                return currentValue;
            }
        }

        return null;
    }


    private diagnosticMatchesFix(data: CxDiagnosticData, fix: PendingAIFix): boolean {
        const item = data.item;
        const keyParts = fix.vulnerabilityKey.split(':');

        switch (fix.scannerType) {
            case 'Oss': {
                if (!('packageName' in item)) {
                    return false;
                }
                const ossItem = item as HoverData;

                const packageManager = keyParts[1];
                const packageName = keyParts[2];
                const expectedVersion = keyParts[3];

                const matches = ossItem.packageManager === packageManager &&
                    ossItem.packageName === packageName &&
                    ossItem.version === expectedVersion;

                return matches;
            }
            case 'Secrets': {
                if (!('secretValue' in item)) {
                    return false;
                }
                const secretsItem = item as SecretsHoverData;

                const expectedSecretType = keyParts[1];
                const expectedLine = parseInt(keyParts[2]);
                const expectedSecretValueHash = keyParts[3];

                const actualSecretType = secretsItem.title || 'unknown';
                const actualLine = secretsItem.location?.line ?? 0;
                const actualSecretValueHash = secretsItem.secretValue
                    ? secretsItem.secretValue.substring(0, 8)
                    : 'unknown';

                const matches = actualSecretType === expectedSecretType &&
                    actualLine === expectedLine &&
                    actualSecretValueHash === expectedSecretValueHash;

                return matches;
            }
            case 'Asca': {
                if (!('ruleName' in item)) {
                    return false;
                }
                const ascaItem = item as AscaHoverData;
                const ruleId = keyParts[1];
                const matches = String(ascaItem.ruleId) === ruleId || ascaItem.ruleName === ruleId;
                return matches;
            }
            case 'Containers': {
                if (!('imageName' in item)) {
                    return false;
                }
                const containersItem = item as ContainersHoverData;

                const imageName = keyParts[1];
                const expectedTag = keyParts[2];

                const matches = containersItem.imageName === imageName &&
                    containersItem.imageTag === expectedTag;

                return matches;
            }
            case 'IaC': {
                if (!('similarityId' in item)) {
                    return false;
                }
                const iacItem = item as IacHoverData;
                const similarityId = keyParts[1];
                const matches = iacItem.similarityId === similarityId;
                return matches;
            }
            default:
                return false;
        }
    }
    private extractValueFromDiagnostic(data: CxDiagnosticData, scannerType: ScannerType): string {
        const item = data.item;

        switch (scannerType) {
            case 'Oss':
                return (item as HoverData).version;
            case 'Secrets': {
                const secretsItem = item as SecretsHoverData;
                const secret = secretsItem.secretValue || '';
                return secret.length > 4 ? `${secret.substring(0, 4)}***` : '***';
            }
            case 'Asca': {
                const ascaItem = item as AscaHoverData;
                return ascaItem.ruleName || 'present';
            }
            case 'Containers': {
                const containersItem = item as ContainersHoverData;
                return `${containersItem.imageName}:${containersItem.imageTag}`;
            }
            case 'IaC': {
                const iacItem = item as IacHoverData;
                return iacItem.actualValue || 'present';
            }
            default:
                return 'present';
        }
    }

    private async finalizeFix(fix: PendingAIFix, status: FixOutcome['status']): Promise<void> {
        // Checking no active inline suggestions
        const uri = vscode.Uri.file(fix.filePath);
        const hasActiveSuggestion = await this.hasActiveInlineSuggestion(uri, fix);

        if (hasActiveSuggestion) {
            return;
        }

        const relativePath = this.getRelativePath(fix.filePath);
        const itemName = this.getItemName(fix);

        let finalState: unknown;
        let validatorMetadata: Record<string, unknown>;
        try {
            finalState = await this.validator.captureFinalState(fix.filePath);
            validatorMetadata = this.validator.getMetadata(fix.validatorState, finalState);
        } catch (error) {
            return;
        }
        const eventName = this.getEventNameFromStatus(status);

        const telemetryData: FixOutcomeTelemetry = {
            status,
            scannerType: fix.scannerType,
            severity: fix.severity,
            filePath: relativePath,
            packageName: itemName,
            duplicateRequests: fix.requestCount - 1,
            initialFileHash: (validatorMetadata.initialFileHash as string) || '',
            finalFileHash: (validatorMetadata.finalFileHash as string) || '',
            hashesMatch: (validatorMetadata.hashesMatch as boolean) || false
        };

        await this.sendTelemetry(eventName, telemetryData);
        this.pendingFixes.delete(fix.vulnerabilityKey);

        this.logs.info(`User ${status === 'changes_accepted' ? 'accepted' : 'rejected'} AI suggestion for ${fix.scannerType} vulnerability`);
    }

    // Get relative path from absolute path for Iac scans
    private getRelativePath(absolutePath: string): string {
        const normalizedPath = absolutePath.replace(/\\/g, '/');

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return normalizedPath.split('/').pop() || normalizedPath;
        }

        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath.replace(/\\/g, '/');
            if (normalizedPath.toLowerCase().startsWith(folderPath.toLowerCase())) {
                return normalizedPath
                    .substring(folderPath.length)
                    .replace(/^\/+/, ''); // Remove leading slashes
            }
        }

        return normalizedPath.split('/').pop() || normalizedPath;
    }

    private getItemName(fix: PendingAIFix): string {
        switch (fix.scannerType) {
            case 'Oss': {
                const ossItem = fix.originalItem as HoverData;
                return ossItem.packageName || 'unknown';
            }
            case 'Secrets': {
                const secretsItem = fix.originalItem as SecretsHoverData;
                return secretsItem.title || 'unknown';
            }
            case 'Asca': {
                const ascaItem = fix.originalItem as AscaHoverData;
                return ascaItem.ruleName || 'unknown';
            }
            case 'Containers': {
                const containersItem = fix.originalItem as ContainersHoverData;
                return `${containersItem.imageName}:${containersItem.imageTag}`;
            }
            case 'IaC': {
                const iacItem = fix.originalItem as IacHoverData;
                return iacItem.title || 'unknown';
            }
            default:
                return 'unknown';
        }
    }

    private async sendTelemetry(eventName: string, data: FixOutcomeTelemetry | Record<string, unknown>): Promise<void> {
        try {
            const dataObj = data as Record<string, unknown>;
            const scannerType = (dataObj.scannerType as string) || '';
            const severity = (dataObj.severity as string) || '';
            const telemetryData = {
                ...data,
                eventType: eventName
            };

            await cx.sendAIFixOutcomeTelemetry(
                eventName,
                scannerType,
                severity,
                undefined,
                undefined,
                undefined,
                JSON.stringify(telemetryData)
            );
        } catch (error) {
            // Silently fail
        }
    }

    dispose(): void {
        this.pendingFixes.clear();

        for (const interval of this.activeIntervals.values()) {
            clearInterval(interval);
        }
        this.activeIntervals.clear();

        for (const timer of this.changeDebounceTimers.values()) {
            clearTimeout(timer);
        }
        this.changeDebounceTimers.clear();
        this.pendingConfirmation.clear();

        if (this.saveListener) {
            this.saveListener.dispose();
        }

        if (this.changeListener) {
            this.changeListener.dispose();
        }

        AISuggestionTracker.instance = undefined as any;
    }
}
