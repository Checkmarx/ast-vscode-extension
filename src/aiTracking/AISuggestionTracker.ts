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
//Add new
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

    this.logs.info("[AITracker] Initialized with config: " + JSON.stringify(this.config));
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
        this.logs.warn(`[AITracker] Unknown status: ${status}, defaulting to rejected`);
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
    this.logs.info("[AITracker] File save listener registered");
  }

  private registerChangeListener(): void {
    this.changeListener = vscode.workspace.onDidChangeTextDocument(
      (event) => this.onFileChanged(event)
    );
    this.logs.info("[AITracker] File change listener registered");
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

    this.logs.info(`[AITracker] File EDITED with ${fixesForFile.length} pending AI fix(es): ${filePath}`);
    this.logs.info(`[AITracker] Content changes count: ${event.contentChanges.length}`);

    const existingTimer = this.changeDebounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const debounceTimer = setTimeout(async () => {
      this.changeDebounceTimers.delete(filePath);
      this.logs.info(`[AITracker] Debounce complete (3s), checking fix status: ${filePath}`);
      this.logs.info(`[AITracker] Ensuring any inline suggestions have disappeared`);

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

    this.logs.info(`[AITracker] File SAVED with ${fixesForFile.length} pending AI fix(es): ${filePath}`);
    this.logs.info(`[AITracker] User confirmed changes by saving - checking outcomes`);

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
        const startIndex = secretsItem.location?.startIndex ?? 0;
        return `secrets:${line}:${startIndex}:${filePath}`;
      }
      case 'Asca': {
        const ascaItem = item as AscaHoverData;
        const ruleId = ascaItem.ruleId || ascaItem.ruleName;
        return `asca:${ruleId}:${line}:${filePath}`;
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
        this.logs.warn(`[AITracker] Unknown scanner type: ${scannerType}`);
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

    this.logs.info(`[AITracker] ========== NEW FIX REQUEST ==========`);
    this.logs.info(`[AITracker] New fix request: ${scannerType}/${severity} - ${vulnKey} (${filePath})`);

    // Check for duplicate request
    const existing = this.pendingFixes.get(vulnKey);
    if (existing) {
      existing.requestCount++;
      existing.requestedAt = Date.now();
      this.logs.info(`[AITracker] DUPLICATE request detected for ${vulnKey}`);
      this.logs.info(`[AITracker] Total request count: ${existing.requestCount}`);

      const eventName = AI_FIX_EVENTS.duplicate;
      this.sendTelemetry(eventName, {
        scannerType,
        severity,
        vulnerabilityKey: vulnKey,
        requestCount: existing.requestCount,
      });

      return existing.id;
    }

    let validatorState: unknown;
    this.logs.info(`[AITracker] Capturing initial file state using validator...`);
    try {
      validatorState = await this.validator.captureInitialState(filePath);
      this.logs.info(`[AITracker] Initial state captured successfully`);
    } catch (error) {
      this.logs.error(`[AITracker] Failed to capture initial state: ${error}`);
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
      requestCount: 1
    };

    this.pendingFixes.set(vulnKey, fix);
    this.logs.info(`[AITracker] Created tracking entry with ID: ${fix.id}`);
    this.logs.info(`[AITracker] Total pending fixes: ${this.pendingFixes.size}`);

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
    this.logs.info(`[AITracker] ========== CHECKING FIX OUTCOME ==========`);

    const currentValue = await this.getCurrentValue(fix);
    const isFixed = currentValue === null;

    if (isFixed) {
      this.logs.info(`[AITracker] Ghost text APPEARED - starting disappearance detection`);

      const intervalKey = fix.vulnerabilityKey;

      if (this.activeIntervals.has(intervalKey)) {
        this.logs.info(`[AITracker] Clearing existing interval for: ${intervalKey}`);
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
        const timeout = attempts >= 10;

        if (fileNotActive || vulnerabilityBack || timeout) {
          clearInterval(checkInterval);
          this.activeIntervals.delete(intervalKey);

          const reason = fileNotActive ? 'file closed' :
            vulnerabilityBack ? 'changes rejected' :
              'timeout';
          this.logs.info(`[AITracker] Ghost text DISAPPEARED (${reason})`);

          const changesAccepted = await this.validator.validate(fix.filePath, fix.validatorState);
          const outcome = changesAccepted ? 'changes_accepted' : 'changes_rejected';
          await this.finalizeFix(fix, outcome);
        } else {
          this.logs.info(`[AITracker] Polling... Ghost text still visible (${attempts * 2}s)`);
        }
      }, 2000);

      this.activeIntervals.set(intervalKey, checkInterval);
    } else {
      this.logs.info(`[AITracker] Vulnerability still present - no ghost text`);
    }
  }

  private async hasActiveInlineSuggestion(uri: vscode.Uri, fix: PendingAIFix): Promise<boolean> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.uri.fsPath !== uri.fsPath) {
        this.logs.info(`[AITracker] Document not in active editor - no active suggestions`);
        return false;
      }

      const pendingConf = this.pendingConfirmation.get(fix.vulnerabilityKey);
      if (pendingConf) {
        const timeSinceDetection = Date.now() - pendingConf.detectedAt;
        if (timeSinceDetection < 2000) {
          this.logs.info(`[AITracker] Recent fix detection (${timeSinceDetection}ms ago) - suggestion may still be active`);
          this.logs.info(`[AITracker] Waiting for inline suggestion to disappear completely`);
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logs.warn(`[AITracker] Error checking for active suggestions: ${error}`);
      return false;
    }
  }

  private async getCurrentValue(fix: PendingAIFix): Promise<string | null> {
    const uri = vscode.Uri.file(fix.filePath);

    const hasActiveSuggestion = await this.hasActiveInlineSuggestion(uri, fix);

    if (hasActiveSuggestion) {
      this.logs.info(`[AITracker] Active inline suggestion detected - waiting for user to accept/reject`);
      this.logs.info(`[AITracker] Current check is premature, diagnostic still shows original value`);
      return 'pending_user_action';
    }
    const diagnostics = vscode.languages.getDiagnostics(uri);

    this.logs.info(`[AITracker] Scanning diagnostics for: ${fix.filePath}`);
    this.logs.info(`[AITracker] Total diagnostics found: ${diagnostics.length}`);
    this.logs.info(`[AITracker] No active inline suggestions - safe to check diagnostics`);

    let matchingDiagnosticCount = 0;

    for (const diagnostic of diagnostics) {
      const data = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData }).data;
      if (!data?.item) {
        continue;
      }

      this.logs.info(`[AITracker] Found CxDiagnostic: type=${data.cxType}, line=${diagnostic.range.start.line}`);

      if (this.diagnosticMatchesFix(data, fix)) {
        matchingDiagnosticCount++;
        const currentValue = this.extractValueFromDiagnostic(data, fix.scannerType);
        this.logs.info(`[AITracker] MATCH FOUND! Vulnerability still present`);
        this.logs.info(`[AITracker] Current value: ${currentValue}`);
        return currentValue;
      }
    }

    this.logs.info(`[AITracker] No matching diagnostic found - vulnerability appears to be FIXED`);
    this.logs.info(`[AITracker] Scanned ${diagnostics.length} diagnostics, found ${matchingDiagnosticCount} matches`);
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
        const matches = ossItem.packageName === packageName &&
          ossItem.packageManager === packageManager;
        if (matches) {
          this.logs.info(`[AITracker] OSS Match: ${ossItem.packageName}@${ossItem.version}`);
        }
        return matches;
      }
      case 'Secrets': {
        if (!('secretValue' in item)) {
          return false;
        }
        const secretsItem = item as SecretsHoverData;
        const line = parseInt(keyParts[1]);
        const startIndex = parseInt(keyParts[2]);
        const matches = secretsItem.location?.line === line &&
          secretsItem.location?.startIndex === startIndex;
        if (matches) {
          this.logs.info(`[AITracker] Secrets Match: line ${line}, index ${startIndex}`);
        }
        return matches;
      }
      case 'Asca': {
        if (!('ruleName' in item)) {
          return false;
        }
        const ascaItem = item as AscaHoverData;
        const ruleId = keyParts[1];
        const line = parseInt(keyParts[2]);
        const matches = (String(ascaItem.ruleId) === ruleId || ascaItem.ruleName === ruleId) &&
          ascaItem.location?.line === line;
        if (matches) {
          this.logs.info(`[AITracker] ASCA Match: ${ascaItem.ruleName} at line ${line}`);
        }
        return matches;
      }
      case 'Containers': {
        if (!('imageName' in item)) {
          return false;
        }
        const containersItem = item as ContainersHoverData;
        const imageName = keyParts[1];
        const imageTag = keyParts[2];
        const matches = containersItem.imageName === imageName &&
          containersItem.imageTag === imageTag;
        if (matches) {
          this.logs.info(`[AITracker] Containers Match: ${imageName}:${imageTag}`);
        }
        return matches;
      }
      case 'IaC': {
        if (!('similarityId' in item)) {
          return false;
        }
        const iacItem = item as IacHoverData;
        const similarityId = keyParts[1];
        const matches = iacItem.similarityId === similarityId;
        if (matches) {
          this.logs.info(`[AITracker] IaC Match: ${similarityId} - ${iacItem.title}`);
        }
        return matches;
      }
      default:
        this.logs.warn(`[AITracker] Unknown scanner type: ${fix.scannerType}`);
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
        // Return masked secret for privacy
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
    this.logs.info(`[AITracker] ========== FINALIZING FIX ==========`);
    this.logs.info(`[AITracker] Vulnerability Key: ${fix.vulnerabilityKey}`);
    this.logs.info(`[AITracker] Final Status: ${status}`);

    // Checking no active inline suggestions
    const uri = vscode.Uri.file(fix.filePath);
    const hasActiveSuggestion = await this.hasActiveInlineSuggestion(uri, fix);

    if (hasActiveSuggestion) {
      this.logs.warn(`[AITracker] SAFETY CHECK FAILED: Active inline suggestion detected during finalization!`);
      this.logs.warn(`[AITracker] Cannot finalize yet - suggestion still visible. Aborting finalization.`);
      return;
    }

    this.logs.info(`[AITracker] Safety check passed - no active suggestions, safe to finalize`);

    const relativePath = this.getRelativePath(fix.filePath);
    const itemName = this.getItemName(fix);

    let finalState: unknown;
    let validatorMetadata: Record<string, unknown>;
    try {
      finalState = await this.validator.captureFinalState(fix.filePath);
      validatorMetadata = this.validator.getMetadata(fix.validatorState, finalState);
    } catch (error) {
      this.logs.error(`[AITracker] Error capturing final state: ${error}`);
      return;
    }

    const eventName = this.getEventNameFromStatus(status);

    this.logs.info(`[AITracker] Outcome Details:`);
    this.logs.info(`[AITracker]   - Scanner: ${fix.scannerType}`);
    this.logs.info(`[AITracker]   - Severity: ${fix.severity}`);
    this.logs.info(`[AITracker]   - File: ${relativePath}`);
    this.logs.info(`[AITracker]   - Package: ${itemName}`);
    this.logs.info(`[AITracker]   - Status: ${status}`);
    this.logs.info(`[AITracker]   - Validator Metadata: ${JSON.stringify(validatorMetadata)}`);
    this.logs.info(`[AITracker]   - Duplicate Requests: ${fix.requestCount - 1}`);
    this.logs.info(`[AITracker] Sending telemetry event: ${eventName}`);

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

    this.logs.info(`[AITracker] Sending telemetry: ${eventName}`);
    this.logs.info(`[AITracker]   - scannerType: ${fix.scannerType}`);
    this.logs.info(`[AITracker]   - severity: ${fix.severity}`);
    this.logs.info(`[AITracker]   - status: ${status}`);
    this.logs.info(`[AITracker]   - hashesMatch: ${validatorMetadata.hashesMatch}`);

    await this.sendTelemetry(eventName, telemetryData);

    this.logs.info(`[AITracker] Telemetry sent successfully: ${eventName}`);

    this.pendingFixes.delete(fix.vulnerabilityKey);
    this.logs.info(`[AITracker] Removed from pending. Remaining pending fixes: ${this.pendingFixes.size}`);
    this.logs.info(`[AITracker] ========== FIX FINALIZED ==========`);
  }

  // Get relative path from absolute path for Iac scans
  private getRelativePath(absolutePath: string): string {
    const normalizedPath = absolutePath.replace(/\\/g, '/');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // No workspace, return just the filename
      return normalizedPath.split('/').pop() || normalizedPath;
    }

    for (const folder of workspaceFolders) {
      const folderPath = folder.uri.fsPath.replace(/\\/g, '/');
      if (normalizedPath.toLowerCase().startsWith(folderPath.toLowerCase())) {
        // Return relative path with forward slashes
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
      default:
        return 'unknown';
    }
  }

  private async sendTelemetry(eventName: string, data: FixOutcomeTelemetry | Record<string, unknown>): Promise<void> {
    try {
      const dataObj = data as Record<string, unknown>;
      const scannerType = (dataObj.scannerType as string) || '';
      const severity = (dataObj.severity as string) || '';

      this.logs.info(`[AITracker] Sending telemetry: ${eventName}`);
      this.logs.info(`[AITracker]   - scannerType: ${scannerType}`);
      this.logs.info(`[AITracker]   - severity: ${severity}`);

      const telemetryData = {
        ...data,
        eventType: eventName
      };

      await cx.sendAIFixOutcomeTelemetry(
        'developer_assist_remediation',
        scannerType,
        severity,
        undefined,
        undefined,
        undefined,
        JSON.stringify(telemetryData)
      );

      this.logs.info(`[AITracker] Telemetry sent successfully: ${eventName}`);
    } catch (error) {
      this.logs.warn(`[AITracker] Failed to send telemetry: ${error}`);
    }
  }

  dispose(): void {
    this.logs.info("[AITracker] Disposing tracker...");

    this.logs.info(`[AITracker] Clearing ${this.pendingFixes.size} pending fixes`);
    this.pendingFixes.clear();

    for (const interval of this.activeIntervals.values()) {
      clearInterval(interval);
    }
    this.logs.info(`[AITracker] Cleared ${this.activeIntervals.size} active intervals`);
    this.activeIntervals.clear();

    for (const timer of this.changeDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.logs.info(`[AITracker] Cleared ${this.changeDebounceTimers.size} debounce timers`);
    this.changeDebounceTimers.clear();

    this.logs.info(`[AITracker] Cleared ${this.pendingConfirmation.size} pending confirmations`);
    this.pendingConfirmation.clear();

    if (this.saveListener) {
      this.saveListener.dispose();
      this.logs.info("[AITracker] Save listener disposed");
    }

    if (this.changeListener) {
      this.changeListener.dispose();
      this.logs.info("[AITracker] Change listener disposed");
    }

    AISuggestionTracker.instance = undefined as any;
    this.logs.info("[AITracker] Singleton instance cleared");

    this.logs.info("[AITracker] Tracker disposed successfully");
  }
}

