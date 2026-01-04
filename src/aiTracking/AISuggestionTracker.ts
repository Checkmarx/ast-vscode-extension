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
  McpRecommendation,
  AI_FIX_EVENTS
} from "./types";
import { McpClient } from "./mcpClient";
import {
  HoverData,
  AscaHoverData,
  ContainersHoverData,
  IacHoverData,
  CxDiagnosticData
} from "../realtimeScanners/common/types";
import { CxRealtimeEngineStatus } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
import { cx } from "../cx";

type AnyHoverData = HoverData | AscaHoverData | ContainersHoverData | IacHoverData;

/**
 * Singleton service to track AI fix requests and their outcomes.
 * Monitors whether users adopt MCP suggestions, use alternatives, or reject fixes.
 */
export class AISuggestionTracker {
  private static instance: AISuggestionTracker;

  /** Map of vulnerability key -> pending fix tracking data */
  private pendingFixes: Map<string, PendingAIFix> = new Map();

  /** Configuration for retry intervals and limits */
  private config: TrackerConfig;

  /** Extension context for accessing secrets and services */
  private context: vscode.ExtensionContext;

  /** Logger instance */
  private logs: Logs;

  /** File save listener disposable */
  private saveListener: vscode.Disposable | undefined;

  /** File change listener disposable */
  private changeListener: vscode.Disposable | undefined;

  /** Debounce timers for file changes */
  private changeDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /** Track if a fix was detected (pending confirmation via save) */
  private pendingConfirmation: Map<string, { detectedAt: number; detectedValue: string | null }> = new Map();

  /** MCP client for fetching recommendations */
  private mcpClient: McpClient;

  private constructor(context: vscode.ExtensionContext, logs: Logs, config?: Partial<TrackerConfig>) {
    this.context = context;
    this.logs = logs;
    this.config = { ...DEFAULT_TRACKER_CONFIG, ...config };
    this.mcpClient = McpClient.getInstance(context);

    // Register file save listener
    if (this.config.checkOnSave) {
      this.registerSaveListener();
      this.registerChangeListener();
    }

    this.logs.info("[AITracker] Initialized with config: " + JSON.stringify(this.config));
  }

  /**
   * Get singleton instance
   */
  static getInstance(context?: vscode.ExtensionContext, logs?: Logs): AISuggestionTracker {
    if (!AISuggestionTracker.instance) {
      if (!context || !logs) {
        throw new Error("AISuggestionTracker must be initialized with context and logs first");
      }
      AISuggestionTracker.instance = new AISuggestionTracker(context, logs);
    }
    return AISuggestionTracker.instance;
  }

  /**
   * Convert fix outcome status to telemetry event name
   */
  private getEventNameFromStatus(status: FixOutcome['status']): string {
    switch (status) {
      case 'mcp_adopted':
        return AI_FIX_EVENTS.mcpAdopted;
      case 'alt_fix_used':
        return AI_FIX_EVENTS.altUsed;
      case 'fix_rejected':
        return AI_FIX_EVENTS.rejected;
      default:
        this.logs.warn(`[AITracker] Unknown status: ${status}, defaulting to rejected`);
        return AI_FIX_EVENTS.rejected;
    }
  }

  /**
   * Initialize the tracker with extension context
   */
  static initialize(context: vscode.ExtensionContext, logs: Logs, config?: Partial<TrackerConfig>): AISuggestionTracker {
    AISuggestionTracker.instance = new AISuggestionTracker(context, logs, config);
    return AISuggestionTracker.instance;
  }

  /**
   * Register listener for file save events
   */
  private registerSaveListener(): void {
    this.saveListener = vscode.workspace.onDidSaveTextDocument(
      (document) => this.onFileSaved(document)
    );
    this.logs.info("[AITracker] File save listener registered");
  }

  /**
   * Register listener for file change events (edits without save)
   */
  private registerChangeListener(): void {
    this.changeListener = vscode.workspace.onDidChangeTextDocument(
      (event) => this.onFileChanged(event)
    );
    this.logs.info("[AITracker] File change listener registered");
  }

  /**
   * Handle file change event - debounced check for pending fixes
   * NOTE: On file edit (not save), we only detect potential fixes but do NOT finalize.
   * This allows users to Undo before we report the outcome.
   * 
   * IMPORTANT: When AI shows inline suggestion (ghost text), we need to wait for:
   * 1. User to accept/reject the suggestion
   * 2. The suggestion to disappear completely
   * 3. Document to stabilize before checking diagnostics
   */
  private onFileChanged(event: vscode.TextDocumentChangeEvent): void {
    const filePath = event.document.uri.fsPath;

    // Only process if there are actual content changes
    if (event.contentChanges.length === 0) {
      return;
    }

    // Find all pending fixes for this file
    const fixesForFile = Array.from(this.pendingFixes.values())
      .filter(fix => fix.filePath === filePath);

    if (fixesForFile.length === 0) {
      return;
    }

    this.logs.info(`[AITracker] File EDITED (not saved) with ${fixesForFile.length} pending AI fix(es): ${filePath}`);
    this.logs.info(`[AITracker] Content changes count: ${event.contentChanges.length}`);

    // Debounce the check - wait 3 seconds after last change before checking
    // INCREASED from 2s to 3s to ensure inline suggestions fully disappear
    const existingTimer = this.changeDebounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const debounceTimer = setTimeout(async () => {
      this.changeDebounceTimers.delete(filePath);
      this.logs.info(`[AITracker] Debounce complete (3s), checking fix status (NOT finalizing - waiting for save): ${filePath}`);
      this.logs.info(`[AITracker] This ensures any inline suggestions have disappeared`);

      for (const fix of fixesForFile) {
        // Pass isFromSave=false to indicate we should NOT finalize positive outcomes
        await this.checkFixOutcome(fix, false);
      }
    }, 3000); // INCREASED to 3 seconds to ensure inline suggestions disappear

    this.changeDebounceTimers.set(filePath, debounceTimer);
  }

  /**
   * Handle file save event - check if any pending fixes were applied
   * NOTE: On file SAVE, we can finalize the outcome because user confirmed they want to keep changes.
   */
  private async onFileSaved(document: vscode.TextDocument): Promise<void> {
    const filePath = document.uri.fsPath;

    // Clear any pending debounce timer since file was saved
    const existingTimer = this.changeDebounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.changeDebounceTimers.delete(filePath);
    }

    // Find all pending fixes for this file
    const fixesForFile = Array.from(this.pendingFixes.values())
      .filter(fix => fix.filePath === filePath);

    if (fixesForFile.length === 0) {
      return;
    }

    this.logs.info(`[AITracker] File SAVED with ${fixesForFile.length} pending AI fix(es): ${filePath}`);
    this.logs.info(`[AITracker] User confirmed changes by saving - will finalize outcomes`);

    // Check each pending fix - pass isFromSave=true to finalize positive outcomes
    for (const fix of fixesForFile) {
      await this.checkFixOutcome(fix, true);
    }
  }

  /**
   * Generate a unique vulnerability key 
   */
  private getVulnerabilityKey(item: AnyHoverData, scannerType: ScannerType): string {
    const filePath = this.getFilePath(item);

    switch (scannerType) {
      case 'Oss': {
        const ossItem = item as HoverData;
        return `oss:${ossItem.packageManager}:${ossItem.packageName}:${ossItem.version}:${filePath}`;
      }
      default:
        return `unknown:${filePath}:${Date.now()}`;
    }
  }

  /**
   * Get file path from hover data item
   */
  private getFilePath(item: AnyHoverData): string {
    if ('filePath' in item && item.filePath) {
      return item.filePath;
    }
    // Fallback to active editor
    return vscode.window.activeTextEditor?.document.uri.fsPath || '';
  }

  /**
   * Get line number from hover data item
   */
  private getLine(item: AnyHoverData): number {
    if ('line' in item && typeof item.line === 'number') {
      return item.line;
    }
    if ('location' in item && item.location?.line !== undefined) {
      return item.location.line;
    }
    return 0;
  }

  /**
   * Determine scanner type from hover data
   */
  private getScannerType(item: AnyHoverData): ScannerType {
    return 'Oss';
  }

  /**
   * Get original value (version, secret type, etc.) from hover data
   */
  private getOriginalValue(item: AnyHoverData, scannerType: ScannerType): string {
    switch (scannerType) {
      case 'Oss':
        return (item as HoverData).version;
      default:
        return 'unknown';
    }
  }

  /**
   * Get severity from hover data
   */
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
    const originalValue = this.getOriginalValue(item, scannerType);
    const severity = this.getSeverity(item);

    this.logs.info(`[AITracker] ========== NEW FIX REQUEST ==========`);
    this.logs.info(`[AITracker] Scanner Type: ${scannerType}`);
    this.logs.info(`[AITracker] Vulnerability Key: ${vulnKey}`);
    this.logs.info(`[AITracker] File Path: ${filePath}`);
    this.logs.info(`[AITracker] Original Value: ${originalValue}`);
    this.logs.info(`[AITracker] Severity: ${severity}`);

    // Check for duplicate request
    const existing = this.pendingFixes.get(vulnKey);
    if (existing) {
      existing.requestCount++;
      existing.requestedAt = Date.now();
      this.logs.info(`[AITracker] DUPLICATE request detected for ${vulnKey}`);
      this.logs.info(`[AITracker] Total request count: ${existing.requestCount}`);

      // Send duplicate telemetry
      const eventName = AI_FIX_EVENTS.duplicate;
      this.sendTelemetry(eventName, {
        scannerType,
        severity,
        vulnerabilityKey: vulnKey,
        requestCount: existing.requestCount,
      });

      return existing.id;
    }

    // Fetch MCP recommendation
    let mcpRecommendation: McpRecommendation | undefined;
    this.logs.info(`[AITracker] Fetching MCP recommendation (check Developer Console for full request details)...`);
    try {
      mcpRecommendation = await this.fetchMcpRecommendation(item, scannerType);

      // DEBUG: Print the curl command for manual testing
      if (this.mcpClient.lastCurlCommand) {
        this.logs.info(`[AITracker] ========== CURL COMMAND FOR TESTING ==========`);
        this.logs.info(`[AITracker] You can test this MCP request manually by copying this curl command:`);
        this.logs.info(`[AITracker] ${this.mcpClient.lastCurlCommand}`);
        this.logs.info(`[AITracker] ================================================`);
      }

      // DEBUG: Print the MCP response as JSON
      this.logs.info(`[AITracker] MCP Response JSON: ${JSON.stringify(mcpRecommendation, null, 2)}`);
    } catch (error) {
      this.logs.warn(`[AITracker] Failed to fetch MCP recommendation: ${error}`);
    }

    // Create new tracking entry
    const fix: PendingAIFix = {
      id: randomUUID(),
      vulnerabilityKey: vulnKey,
      filePath: filePath,
      line: this.getLine(item),
      scannerType,
      severity,
      originalValue: originalValue,
      mcpSuggestedVersion: mcpRecommendation?.suggestedVersion,
      mcpFullResponse: mcpRecommendation,
      requestedAt: Date.now(),
      checkCount: 0,
      maxRetries: this.config.maxRetries,
      retryIntervalMs: this.config.retryIntervalMs,
      requestCount: 1,
      originalItem: item
    };

    this.pendingFixes.set(vulnKey, fix);
    this.logs.info(`[AITracker] Created tracking entry with ID: ${fix.id}`);
    this.logs.info(`[AITracker] Total pending fixes: ${this.pendingFixes.size}`);

    // Start check timer
    this.startCheckTimer(fix);
    this.logs.info(`[AITracker] Started check timer (${this.config.retryIntervalMs}ms interval, max ${this.config.maxRetries} retries)`);

    // Send request telemetry
    const eventName = AI_FIX_EVENTS.requested;
    this.sendTelemetry(eventName, {
      scannerType,
      severity: fix.severity,
      vulnerabilityKey: vulnKey,
      mcpSuggestedVersion: mcpRecommendation?.suggestedVersion
    });

    this.logs.info(`[AITracker] ========== FIX REQUEST TRACKED ==========`);

    return fix.id;
  }

  /**
   * Fetch MCP recommendation based on scanner type
   */
  private async fetchMcpRecommendation(item: AnyHoverData, scannerType: ScannerType): Promise<McpRecommendation> {
    switch (scannerType) {
      case 'Oss': {
        const ossItem = item as HoverData;
        const isMalicious = ossItem.status === CxRealtimeEngineStatus.malicious;
        return this.mcpClient.getRecommendation({
          scannerType: 'Oss',
          packageName: ossItem.packageName,
          packageVersion: ossItem.version,
          packageManager: ossItem.packageManager,
          issueType: isMalicious ? 'malicious' : 'CVE',
          filePath: ossItem.filePath,
          line: ossItem.line
        });
      }
      default:
        return { error: 'Unknown scanner type' };
    }
  }

  /**
   * Start the check timer for a pending fix
   */
  private startCheckTimer(fix: PendingAIFix): void {
    // Clear existing timer if any
    if (fix.timerId) {
      clearTimeout(fix.timerId);
    }

    fix.timerId = setTimeout(async () => {
      const isLastRetry = fix.checkCount >= fix.maxRetries;

      if (isLastRetry) {
        this.logs.info(`[AITracker] Timer fired - FINAL check (will finalize)`);
        await this.checkFixOutcome(fix);
      } else {
        this.logs.info(`[AITracker] Timer fired - checking status (not final)`);
        await this.checkFixOutcome(fix);
      }
    }, fix.retryIntervalMs);
  }

  private async checkFixOutcome(fix: PendingAIFix): Promise<void> {
    fix.checkCount++;

    this.logs.info(`[AITracker] ========== CHECKING FIX OUTCOME ==========`);
    this.logs.info(`[AITracker] Vulnerability Key: ${fix.vulnerabilityKey}`);
    this.logs.info(`[AITracker] Check attempt: ${fix.checkCount}/${fix.maxRetries + 1}`);
    this.logs.info(`[AITracker] Original Value: ${fix.originalValue}`);
    this.logs.info(`[AITracker] MCP Suggested Version: ${fix.mcpSuggestedVersion || 'N/A'}`);
    this.logs.info(`[AITracker] Time since request: ${Date.now() - fix.requestedAt}ms`);

    const currentValue = await this.getCurrentValue(fix);
    const isFixed = currentValue === null; // Vulnerability no longer present

    this.logs.info(`[AITracker] Current Value from diagnostics: ${currentValue === null ? 'NULL (vulnerability not found)' : currentValue}`);
    this.logs.info(`[AITracker] Is Fixed: ${isFixed}`);

    const pendingConf = this.pendingConfirmation.get(fix.vulnerabilityKey);
    if (pendingConf) {
      this.logs.info(`[AITracker] Pending confirmation exists from: ${new Date(pendingConf.detectedAt).toISOString()}`);
    }


    if (isFixed) {
      // Check for active ghost text before reading file
      const uri = vscode.Uri.file(fix.filePath);
      let hasActiveSuggestion = await this.hasActiveInlineSuggestion(uri, fix);
      let ghostTextCheckCount = 0;
      const maxGhostTextChecks = 5; // Maximum number of times to check for ghost text

      while (hasActiveSuggestion && ghostTextCheckCount < maxGhostTextChecks) {
        ghostTextCheckCount++;
        this.logs.info(`[AITracker] DECISION: Ghost text still active (check ${ghostTextCheckCount}/${maxGhostTextChecks})`);
        this.logs.info(`[AITracker] Waiting for user to accept/reject inline suggestion before checking file`);
        this.logs.info(`[AITracker] Cannot safely read file content while ghost text is visible`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Re-check if ghost text is still active
        hasActiveSuggestion = await this.hasActiveInlineSuggestion(uri, fix);
        this.logs.info(`[AITracker] Re-checking ghost text status... hasActiveSuggestion: ${hasActiveSuggestion}`);
      }

      if (hasActiveSuggestion) {
        this.logs.info(`[AITracker] Ghost text still active after ${maxGhostTextChecks} checks`);
        if (fix.checkCount <= fix.maxRetries) {
          this.logs.info(`[AITracker] Scheduling retry to check later`);
          this.startCheckTimer(fix);
        } else {
          this.logs.info(`[AITracker] Max retries reached with active ghost text, cannot finalize`);
        }
        return; // Exit - don't read file yet
      }

      this.logs.info(`[AITracker] Ghost text disappeared - safe to read file and determine outcome`);

      const actualVersion = await this.getActualVersionFromFile(fix);

      // Determine if user used MCP suggestion or alternative
      const outcome = this.determineOutcomeWithVersion(fix, actualVersion);
      this.logs.info(`[AITracker] DECISION: Vulnerability appears FIXED`);
      this.logs.info(`[AITracker] Actual version in file: ${actualVersion || '(not found/removed)'}`);
      this.logs.info(`[AITracker] Final outcome: ${outcome}`);
      this.logs.info(`[AITracker] Original version: ${fix.originalValue}`);
      this.logs.info(`[AITracker] MCP suggested version: ${fix.mcpSuggestedVersion || 'N/A'}`);
      this.logs.info(`[AITracker] Actual version applied: ${actualVersion || '(removed/fixed)'}`);

      // We have all the information needed - finalize immediately
      this.logs.info(`[AITracker] Ghost text gone, vulnerability fixed, all versions known - FINALIZING NOW`);
      this.pendingConfirmation.delete(fix.vulnerabilityKey);
      await this.finalizeFix(fix, outcome, actualVersion);
    } else {
      // Vulnerability still present

      // Clear any pending confirmation since vulnerability came back (user might have undone)
      if (pendingConf) {
        this.logs.info(`[AITracker] Vulnerability REAPPEARED - user likely clicked UNDO`);
        this.logs.info(`[AITracker] Clearing pending confirmation`);
        this.pendingConfirmation.delete(fix.vulnerabilityKey);
      }

      if (fix.checkCount <= fix.maxRetries) {
        // Not fixed yet, schedule retry
        this.logs.info(`[AITracker] DECISION: Vulnerability still present, scheduling retry`);
        this.logs.info(`[AITracker] Next check in: ${fix.retryIntervalMs}ms`);
        this.startCheckTimer(fix);
      } else {
        // Max retries reached, mark as rejected
        this.logs.info(`[AITracker] DECISION: Max retries reached, marking as REJECTED`);
        await this.finalizeFix(fix, 'fix_rejected', currentValue || undefined);
      }
    }

    this.logs.info(`[AITracker] ========== CHECK COMPLETE ==========`);
  }

  /**
   * Check if there's an active inline suggestion (ghost text) for the vulnerability line
   * This helps us avoid false positives when AI shows a suggestion but user hasn't accepted it yet
   */
  private async hasActiveInlineSuggestion(uri: vscode.Uri, fix: PendingAIFix): Promise<boolean> {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.uri.fsPath !== uri.fsPath) {
        this.logs.info(`[AITracker] Document not in active editor - no active suggestions`);
        return false;
      }

      const pendignConf = this.pendingConfirmation.get(fix.vulnerabilityKey);
      if (pendingConf) {
        const timeSinceDetection = Date.now() - pendingConf.detectedAt;
        if (timeSinceDetection < 2000) {
          this.logs.info(`[AITracker] Recent fix detection (${timeSinceDetection}ms ago) - suggestion may still be active`);
          this.logs.info(`[AITracker] Waiting for inline suggestion to disappear completely`);
          return true;
        }
      }
    } catch (error) {
      this.logs.warn(`[AITracker] Error checking for active suggestions: ${error}`);
      return false;
    }
  }

  private async getCurrentValue(fix: PendingAIFix): Promise<string | null> {
    const uri = vscode.Uri.file(fix.filePath);

    // Check if there are active inline suggestions/completions in the document
    const hasActiveSuggestion = await this.hasActiveInlineSuggestion(uri, fix);

    if (hasActiveSuggestion) {
      this.logs.info(`[AITracker] Active inline suggestion detected - waiting for user to accept/reject`);
      this.logs.info(`[AITracker] Current check is premature, diagnostic still shows original value`);
      return fix.originalValue;
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

    switch (fix.scannerType) {
      case 'Oss': {
        if (!('packageName' in item)) {
          return false;
        }
        const ossItem = item as HoverData;
        const originalOss = fix.originalItem as HoverData;
        const matches = ossItem.packageName === originalOss.packageName &&
          ossItem.packageManager === originalOss.packageManager;
        if (matches) {
          this.logs.info(`[AITracker] OSS Match: ${ossItem.packageName}@${ossItem.version} (original: ${originalOss.version})`);
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
      default:
        return 'present';
    }
  }

  /**
   * Determine the file type from file path
   */
  private getFileType(filePath: string): string {
    const lowerPath = filePath.toLowerCase();

    if (lowerPath.endsWith('package.json')) {
      return 'package.json';
    }
    /**    if (lowerPath.endsWith('requirements.txt')) {
        return 'requirements.txt';
      }
      if (lowerPath.endsWith('go.mod')) {
        return 'go.mod';
      }
      if (lowerPath.endsWith('pom.xml')) {
        return 'pom.xml';
      }
      if (lowerPath.endsWith('.csproj')) {
        return 'csproj';
      }
      if (lowerPath.includes('packages.config')) {
        return 'packages.config';
      }
      if (lowerPath.includes('directory.packages.props')) {
        return 'directory.packages.props';
      }
  */
    return 'unknown';
  }

  /**
   * Get the actual version from the file for OSS packages
   */
  private async getActualVersionFromFile(fix: PendingAIFix): Promise<string | undefined> {
    if (fix.scannerType !== 'Oss') {
      return undefined;
    }

    try {
      const document = await vscode.workspace.openTextDocument(fix.filePath);
      const text = document.getText();
      const originalItem = fix.originalItem as HoverData;
      const packageName = originalItem.packageName;

      this.logs.info(`[AITracker] Searching for ${packageName} version in: ${fix.filePath}`);

      const fileType = this.getFileType(fix.filePath);
      let patterns: RegExp[] = [];

      switch (fileType) {
        case 'package.json':
          // package.json (Node.js/JavaScript)
          // Handles: "package": "1.2.3" or "package": "^1.2.3"
          patterns = [
            new RegExp(`"${this.escapeRegex(packageName)}"\\s*:\\s*"([^"]+)"`, 'i'),
            new RegExp(`'${this.escapeRegex(packageName)}'\\s*:\\s*'([^']+)'`, 'i'),
          ];
          break;

        /**  case 'requirements.txt':
           // requirements.txt (Python)
           // Handles: package==1.2.3, package>=1.2.3, package~=1.2.3
           patterns = [
             new RegExp(`^${this.escapeRegex(packageName)}\\s*[=~><!]+\\s*([^\\s#]+)`, 'im'),
             new RegExp(`^${this.escapeRegex(packageName)}\\s*==\\s*([^\\s#]+)`, 'im'),
           ];
           break;
 
         case 'go.mod':
           // go.mod (Go)
           // Handles: require packageName v1.2.3 or inside require (...) block
           patterns = [
             new RegExp(`${this.escapeRegex(packageName)}\\s+v?([^\\s]+)`, 'im'),
           ];
           break;
 
         case 'pom.xml':
           // pom.xml (Maven/Java)
           // Matches <artifactId>package</artifactId> followed by <version>1.2.3</version>
           patterns = [
             new RegExp(`<artifactId>${this.escapeRegex(packageName)}</artifactId>[\\s\\S]*?<version>([^<]+)</version>`, 'i'),
             new RegExp(`<artifactId>${this.escapeRegex(packageName)}</artifactId>[\\s\\S]{0,200}<version>([^<]+)</version>`, 'i'),
           ];
           break;
 
         case 'csproj':
           // *.csproj (C# Project)
           // Handles: <PackageReference Include="package" Version="1.2.3" />
           patterns = [
             new RegExp(`<PackageReference\\s+Include=["']${this.escapeRegex(packageName)}["']\\s+Version=["']([^"']+)["']`, 'i'),
             new RegExp(`<PackageReference\\s+Include=["']${this.escapeRegex(packageName)}["'][\\s\\S]*?Version=["']([^"']+)["']`, 'i'),
           ];
           break;
 
         case 'packages.config':
           // packages.config (NuGet)
           // Handles: <package id="package" version="1.2.3" />
           patterns = [
             new RegExp(`<package\\s+id=["']${this.escapeRegex(packageName)}["']\\s+version=["']([^"']+)["']`, 'i'),
             new RegExp(`<package\\s+id=["']${this.escapeRegex(packageName)}["'][\\s\\S]*?version=["']([^"']+)["']`, 'i'),
           ];
           break;
 
         case 'directory.packages.props':
           // Directory.Packages.props (NuGet Central Package Management)
           // Handles: <PackageVersion Include="package" Version="1.2.3" />
           patterns = [
             new RegExp(`<PackageVersion\\s+Include=["']${this.escapeRegex(packageName)}["']\\s+Version=["']([^"']+)["']`, 'i'),
             new RegExp(`<PackageVersion\\s+Include=["']${this.escapeRegex(packageName)}["'][\\s\\S]*?Version=["']([^"']+)["']`, 'i'),
           ];
           break;
 */
        default:
          // Unknown file type - try generic patterns (JSON as fallback)
          this.logs.info(`[AITracker] Unknown file type, trying generic patterns`);
          patterns = [
            new RegExp(`"${this.escapeRegex(packageName)}"\\s*:\\s*"([^"]+)"`, 'i'),
            new RegExp(`'${this.escapeRegex(packageName)}'\\s*:\\s*'([^']+)'`, 'i'),
          ];
          break;
      }

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Clean version string (remove ^ ~ >= < > etc.)
          let version = match[1].trim().replace(/^[\^~>=<]+/, '');
          // Remove 'v' prefix if present (common in Go)
          version = version.replace(/^v/, '');
          this.logs.info(`[AITracker] Found actual version in file: ${packageName}@${version}`);
          return version;
        }
      }

      this.logs.info(`[AITracker] Could not find ${packageName} version in file`);
      return undefined;
    } catch (error) {
      this.logs.warn(`[AITracker] Error reading file for version: ${error}`);
      return undefined;
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Determine the outcome of a fix attempt with actual version info
   */
  private determineOutcomeWithVersion(fix: PendingAIFix, actualVersion: string | undefined): FixOutcome['status'] {
    this.logs.info(`[AITracker] Determining outcome with version info...`);
    this.logs.info(`[AITracker]   - Original Value: ${fix.originalValue}`);
    this.logs.info(`[AITracker]   - MCP Suggested: ${fix.mcpSuggestedVersion || 'N/A'}`);
    this.logs.info(`[AITracker]   - Actual Version: ${actualVersion || '(not found)'}`);

    if (actualVersion && actualVersion === fix.originalValue) {
      this.logs.info(`[AITracker]   -> Actual version is SAME as original (${actualVersion}), NO FIX APPLIED`);
      this.logs.info(`[AITracker]   -> This should NOT happen if vulnerability is gone from diagnostics`);
      this.logs.info(`[AITracker]   -> Returning FIX_REJECTED (false positive detection)`);
      return 'fix_rejected';
    }

    if (fix.scannerType === 'Oss' && actualVersion) {
      if (fix.mcpSuggestedVersion && actualVersion === fix.mcpSuggestedVersion) {
        this.logs.info(`[AITracker]   -> Actual version MATCHES MCP suggestion (${actualVersion}), MCP_ADOPTED`);
        return 'mcp_adopted';
      }

      if (actualVersion !== fix.originalValue) {
        if (fix.mcpSuggestedVersion) {
          this.logs.info(`[AITracker]   -> Actual version (${actualVersion}) DIFFERS from MCP suggestion (${fix.mcpSuggestedVersion}), ALT_FIX_USED`);
        } else {
          this.logs.info(`[AITracker]   -> Version changed to ${actualVersion} (no MCP suggestion available), ALT_FIX_USED`);
        }
        return 'alt_fix_used';
      }
    }

    // If package removed
    if (!actualVersion) {
      this.logs.info(`[AITracker]   -> Package/vulnerability removed from file, MCP_ADOPTED`);
      return 'mcp_adopted';
    }

    // Fallback 
    this.logs.warn(`[AITracker]   -> UNEXPECTED STATE: Could not determine outcome`);
    this.logs.warn(`[AITracker]   -> Original: ${fix.originalValue}, Actual: ${actualVersion}, MCP: ${fix.mcpSuggestedVersion || 'N/A'}`);
    return 'fix_rejected';
  }

  // Get the MCP suggested version - always returns a value

  private getMcpSuggestedVersionValue(fix: PendingAIFix): string {
    if (fix.mcpSuggestedVersion) {
      return fix.mcpSuggestedVersion;
    }

    if (fix.mcpFullResponse?.error) {
      return 'error';
    }

    return 'unknown';
  }

  /**
   * Finalize a fix tracking and send telemetry
   */
  private async finalizeFix(fix: PendingAIFix, status: FixOutcome['status'], actualVersion?: string): Promise<void> {
    this.logs.info(`[AITracker] ========== FINALIZING FIX ==========`);
    this.logs.info(`[AITracker] Vulnerability Key: ${fix.vulnerabilityKey}`);
    this.logs.info(`[AITracker] Final Status: ${status}`);

    // Once agin checking that no active inline suggestions
    const uri = vscode.Uri.file(fix.filePath);
    const hasActiveSuggestion = await this.hasActiveInlineSuggestion(uri, fix);

    if (hasActiveSuggestion) {
      this.logs.warn(`[AITracker] SAFETY CHECK FAILED: Active inline suggestion detected during finalization!`);
      this.logs.warn(`[AITracker] Cannot finalize yet - suggestion still visible. Aborting finalization.`);
      this.logs.warn(`[AITracker] Will retry on next check cycle.`);
      this.startCheckTimer(fix);
      return;
    }

    this.logs.info(`[AITracker] Safety check passed - no active suggestions, safe to finalize`);

    // Clear timer
    if (fix.timerId) {
      clearTimeout(fix.timerId);
      this.logs.info(`[AITracker] Cleared pending timer`);
    }

    // Get relative path (clean up the path)
    const relativePath = this.getRelativePath(fix.filePath);

    const timeToFixMs = Date.now() - fix.requestedAt;

    const eventName = this.getEventNameFromStatus(status);

    const itemName = this.getItemName(fix);

    const mcpSuggestedVersion = this.getMcpSuggestedVersionValue(fix);

    let versionAdopted: string | null = null;
    if (status === 'mcp_adopted') {
      versionAdopted = fix.mcpSuggestedVersion || actualVersion || null;
    } else if (status === 'alt_fix_used') {
      versionAdopted = actualVersion || null;
    }

    this.logs.info(`[AITracker] Outcome Details:`);
    this.logs.info(`[AITracker]   - Scanner: ${fix.scannerType}`);
    this.logs.info(`[AITracker]   - Severity: ${fix.severity}`);
    this.logs.info(`[AITracker]   - File: ${relativePath}`);
    this.logs.info(`[AITracker]   - Package: ${itemName}`);
    this.logs.info(`[AITracker]   - Original Version: ${fix.originalValue}`);
    this.logs.info(`[AITracker]   - MCP Suggested Version: ${mcpSuggestedVersion}`);
    this.logs.info(`[AITracker]   - Actual Version in File: ${actualVersion || '(removed/fixed)'}`);
    this.logs.info(`[AITracker]   - Version Adopted: ${versionAdopted || 'N/A'}`);
    this.logs.info(`[AITracker]   - Time to Fix: ${timeToFixMs}ms (${(timeToFixMs / 1000).toFixed(1)}s)`);
    this.logs.info(`[AITracker]   - Check Count: ${fix.checkCount}`);
    this.logs.info(`[AITracker]   - Duplicate Requests: ${fix.requestCount - 1}`);
    this.logs.info(`[AITracker] Sending telemetry event: ${eventName}`);

    const telemetryData: FixOutcomeTelemetry = {
      mcpSuggestedVersion,
      actualVersion: actualVersion || null,
      status,
      scannerType: fix.scannerType,
      severity: fix.severity,
      filePath: relativePath,
      packageName: itemName,
      originalVersion: fix.originalValue,
      versionAdopted,
      duplicateRequests: fix.requestCount - 1
    };

    await this.sendTelemetry(eventName, telemetryData);

    // Remove from pending
    this.pendingFixes.delete(fix.vulnerabilityKey);
    this.logs.info(`[AITracker] Removed from pending. Remaining pending fixes: ${this.pendingFixes.size}`);
    this.logs.info(`[AITracker] ========== FIX FINALIZED ==========`);
  }

  // Get relative path from absolute path (clean, no escaped backslashes)
  private getRelativePath(absolutePath: string): string {
    // First normalize the path - replace all backslashes with forward slashes
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

    // Not in workspace, return just the filename
    return normalizedPath.split('/').pop() || normalizedPath;
  }


  // Get the package/item name from the fix data

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
      const mcpSuggestedVersion = dataObj.mcpSuggestedVersion as string | undefined;
      const actualVersion = dataObj.actualVersion as string | null | undefined;

      this.logs.info(`[AITracker] Sending telemetry: ${eventName}`);
      this.logs.info(`[AITracker]   - scannerType: ${scannerType}`);
      this.logs.info(`[AITracker]   - severity: ${severity}`);
      this.logs.info(`[AITracker]   - mcpSuggestedVersion: ${mcpSuggestedVersion || 'N/A'}`);
      this.logs.info(`[AITracker]   - actualVersion: ${actualVersion || 'N/A'}`);

      await cx.sendAIFixOutcomeTelemetry(
        eventName,
        scannerType,
        severity,
        mcpSuggestedVersion,
        actualVersion || undefined,
        undefined,
        JSON.stringify(data)
      );

      this.logs.info(`[AITracker] Telemetry sent successfully: ${eventName}`);
    } catch (error) {
      this.logs.warn(`[AITracker] Failed to send telemetry: ${error}`);
    }
  }


  //Get number of pending fixes being tracked
  getPendingCount(): number {
    return this.pendingFixes.size;
  }

  /**
   * Get pending fix by vulnerability key
   */
  getPendingFix(vulnKey: string): PendingAIFix | undefined {
    return this.pendingFixes.get(vulnKey);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.logs.info("[AITracker] Disposing tracker...");

    // Clear all fix timers
    for (const fix of this.pendingFixes.values()) {
      if (fix.timerId) {
        clearTimeout(fix.timerId);
      }
    }
    this.logs.info(`[AITracker] Cleared ${this.pendingFixes.size} pending fix timers`);
    this.pendingFixes.clear();

    // Clear all debounce timers
    for (const timer of this.changeDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.logs.info(`[AITracker] Cleared ${this.changeDebounceTimers.size} debounce timers`);
    this.changeDebounceTimers.clear();

    // Clear pending confirmations
    this.logs.info(`[AITracker] Cleared ${this.pendingConfirmation.size} pending confirmations`);
    this.pendingConfirmation.clear();

    // Dispose save listener
    if (this.saveListener) {
      this.saveListener.dispose();
      this.logs.info("[AITracker] Save listener disposed");
    }

    // Dispose change listener
    if (this.changeListener) {
      this.changeListener.dispose();
      this.logs.info("[AITracker] Change listener disposed");
    }

    this.logs.info("[AITracker] Tracker disposed successfully");
  }
}

