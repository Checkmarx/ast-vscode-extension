import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commandBuilder";
import { constants } from "../utils/common/constants";
import { getFromState, updateState } from "../utils/common/globalState";
import { getMessages } from "../config/extensionMessages";
import { cx } from "../cx";
import {
  AiTriageService,
  AiTriageError,
  AiTriageErrorKind,
} from "../services/aiTriageService";
import {
  AiTriageEngine,
  NormalizedTriageResult,
  isAiTriageSupported,
  toAiTriageEngine,
  toStateDisplay,
  toStateTag,
} from "../models/aiTriage";
import { AstResult } from "../models/results";
import { buildScaVulnerabilityString } from "../utils/triage";

/** Payload posted from the AI Triage webview (or passed by other callers). */
export interface AiTriagePayload {
  /** Result hash / result ID used in the triage request body. */
  resultId: string;
  similarityId: string;
  /** Checkmarx result type ("sast" | "sca"); the engine is derived from it. */
  resultType: string;
  /** Optional explicit engine; falls back to deriving from resultType. */
  engine?: AiTriageEngine;
  /** Current state (display or tag) so the poller can detect a change. */
  currentState?: string;
  severity?: string;
  /** Human-readable label for progress/notification messages. */
  label?: string;
  /** Optional SSE group id when available. */
  groupId?: string;
}

/** Minimal contract the command needs to refresh a results tree after triage. */
export interface RefreshableResultsProvider {
  loadedResults?: Array<{ similarityId?: string; id?: string; state?: string }> | undefined;
  refresh?: () => void;
}

/**
 * Registers and handles the "Triage with AI" command. This is the single entry
 * point for triggering AI Triage from any surface (the AI Triage table view,
 * tree context menu, etc.); it owns progress reporting, cancellation, telemetry,
 * error handling and post-triage refresh.
 */
export class AiTriageCommand {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logs: Logs,
    private readonly resultsProvider?: RefreshableResultsProvider,
    private readonly onTriaged?: (payload: AiTriagePayload, result: NormalizedTriageResult) => void
  ) { }

  public register(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.triageWithAI,
        (payload: AiTriagePayload) => this.triageWithAI(payload)
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.remediateWithAI,
        (payload: AiTriagePayload) => this.remediateWithAI(payload)
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.aiRemediationAnalysis,
        (payload: AiTriagePayload) => this.aiRemediationAnalysis(payload)
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(commands.openAiTriageView, async () => {
        try {
          await vscode.commands.executeCommand(`${commands.aiTriageView}.focus`);
        } catch (error) {
          this.logs.warn(`Failed to focus AI Triage view: ${error}`);
        }
      })
    );
  }

  /**
   * Trigger AI Triage for a single result and return the normalized decision,
   * or undefined when it failed/was cancelled (a notification is shown either way).
   */
  public async triageWithAI(
    payload: AiTriagePayload
  ): Promise<NormalizedTriageResult | undefined> {
    const productName = getMessages().productName;

    const validationError = this.validate(payload);
    if (validationError) {
      vscode.window.showErrorMessage(`${productName}: ${validationError}`);
      return undefined;
    }

    const engine = payload.engine ?? toAiTriageEngine(payload.resultType)!;
    const project = getFromState(this.context, constants.projectIdKey);
    const scan = getFromState(this.context, constants.scanIdKey);

    if (!project?.id || !scan?.id) {
      vscode.window.showErrorMessage(
        `${productName}: Select a project and scan in the Checkmarx One Results view before running AI Triage.`
      );
      return undefined;
    }

    // Telemetry must never break the feature.
    try {
      void cx.setUserEventDataForLogs("click", constants.triageWithAI, engine, payload.severity ?? "");
    } catch (error) {
      this.logs.warn(`AI Triage telemetry skipped: ${error}`);
    }

    const label = payload.label || payload.similarityId;

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `${productName}: AI Triage`,
        cancellable: false,
      },
      async (progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());

        const service = AiTriageService.getInstance(this.context, this.logs);
        try {
          // Baseline the existing triage predicates before submitting, so we can
          // detect the new AI-written predicate once processing completes.
          const baseline = await this.getTriageChanges(project.id, payload);
          const baseCount = baseline.length;

          progress.report({ message: `Submitting AI Triage for "${label}"…` });
          await service.submitTriage(scan.id, engine, payload.resultId, controller.signal);

          // AI Triage runs asynchronously (typically up to ~5 minutes). Poll the
          // triage change-log via the CLI path (avoids the info microservice).
          progress.report({ message: `AI Triage running for "${label}"… (this can take a few minutes)` });
          const state = await this.pollTriageState(
            project.id,
            payload,
            baseCount,
            controller.signal
          );

          if (!state) {
            vscode.window.showWarningMessage(
              `${productName}: AI Triage for "${label}" is still processing. It will appear on the finding once complete; use Refresh to check.`
            );
            return undefined;
          }

          const result: NormalizedTriageResult = {
            stateDisplay: toStateDisplay(state),
            stateTag: toStateTag(state),
          };
          // Mark the view (completed icon + new state) BEFORE the tree refresh
          // re-renders the table, so the update appears without a manual reload.
          this.onTriaged?.(payload, result);
          this.applyRefresh(payload, result);
          vscode.window.showInformationMessage(
            `${productName}: AI Triage set "${label}" to ${result.stateDisplay}.`
          );
          return result;
        } catch (error) {
          this.handleError(error, productName);
          return undefined;
        }
      }
    );
  }

  /**
   * Trigger AI Remediation for a single result. Remediation runs asynchronously
   * on the platform (it generates a fix / auto-PR when configured), so this
   * submits the request and reports the outcome.
   */
  public async remediateWithAI(payload: AiTriagePayload): Promise<boolean> {
    const productName = getMessages().productName;

    const validationError = this.validate(payload);
    if (validationError) {
      vscode.window.showErrorMessage(`${productName}: ${validationError}`);
      return false;
    }

    const engine = payload.engine ?? toAiTriageEngine(payload.resultType)!;
    const project = getFromState(this.context, constants.projectIdKey);
    const scan = getFromState(this.context, constants.scanIdKey);
    if (!project?.id || !scan?.id) {
      vscode.window.showErrorMessage(
        `${productName}: Select a project and scan in the Checkmarx One Results view before running AI Remediation.`
      );
      return false;
    }

    try {
      void cx.setUserEventDataForLogs("click", constants.remediateWithAI, engine, payload.severity ?? "");
    } catch (error) {
      this.logs.warn(`AI Remediation telemetry skipped: ${error}`);
    }

    const label = payload.label || payload.similarityId;
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `${productName}: AI Remediation`,
        cancellable: false,
      },
      async (progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        progress.report({ message: `Requesting AI Remediation for "${label}"…` });
        const service = AiTriageService.getInstance(this.context, this.logs);
        try {
          await service.submitRemediation(
            scan.id,
            project.id,
            engine,
            payload.resultId,
            controller.signal
          );
          vscode.window.showInformationMessage(
            `${productName}: AI Remediation requested for "${label}". The fix is generated on the platform (an auto-PR is created when configured).`
          );
          return true;
        } catch (error) {
          this.handleError(error, productName);
          return false;
        }
      }
    );
  }

  /**
   * Placeholder for "AI Remediation Analysis" — registered the same way as
   * Triage with AI / Remediate with AI (webview menu, Problems-panel quick fix)
   * so it's reachable from every surface, but the analysis itself isn't built yet.
   */
  public async aiRemediationAnalysis(payload: AiTriagePayload): Promise<void> {
    const productName = getMessages().productName;

    const validationError = this.validate(payload);
    if (validationError) {
      vscode.window.showErrorMessage(`${productName}: ${validationError}`);
      return;
    }

    const engine = payload.engine ?? toAiTriageEngine(payload.resultType)!;
    try {
      void cx.setUserEventDataForLogs("click", constants.aiRemediationAnalysis, engine, payload.severity ?? "");
    } catch (error) {
      this.logs.warn(`AI Remediation Analysis telemetry skipped: ${error}`);
    }

    vscode.window.showInformationMessage(`${productName}: AI Remediation Analysis is under development. Coming soon.`);
  }

  /** Read current triage predicates for a result via the CLI wrapper. */
  private async getTriageChanges(
    projectId: string,
    payload: AiTriagePayload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    try {
      if (payload.resultType === constants.sca) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = this.findLoadedResult(payload) as any;
        if (raw) {
          const vulnerabilities = buildScaVulnerabilityString(new AstResult(raw));
          return (await cx.triageSCAShow(projectId, vulnerabilities, constants.sca)) || [];
        }
        return [];
      }
      return (await cx.triageShow(projectId, payload.similarityId, payload.resultType)) || [];
    } catch (error) {
      this.logs.warn(`AI Triage: could not read triage changes: ${error}`);
      return [];
    }
  }

  /** Poll the triage change-log until a new AI predicate appears or it times out. */
  private async pollTriageState(
    projectId: string,
    payload: AiTriagePayload,
    baseCount: number,
    signal: AbortSignal
  ): Promise<string | undefined> {
    const deadline = Date.now() + 6 * 60 * 1000; // ~6 minutes
    const intervalMs = 4000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal.aborted) {
        return undefined;
      }
      const changes = await this.getTriageChanges(projectId, payload);
      if (changes.length > baseCount && changes[0]) {
        return changes[0].State ?? changes[0].state;
      }
      if (Date.now() >= deadline) {
        return undefined;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /** Find the loaded CxResult matching the payload (for SCA vuln-string building). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private findLoadedResult(payload: AiTriagePayload): any | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = this.resultsProvider?.loadedResults as any[] | undefined;
    return list?.find(
      (r) =>
        r?.similarityId === payload.similarityId ||
        r?.id === payload.resultId ||
        r?.data?.resultHash === payload.resultId
    );
  }

  private validate(payload: AiTriagePayload | undefined): string | undefined {
    if (!payload || !payload.resultId || !payload.similarityId) {
      return "This finding cannot be triaged (missing result identifiers).";
    }
    if (!isAiTriageSupported(payload.resultType) && !payload.engine) {
      return "AI Triage is only available for SAST and SCA findings.";
    }
    return undefined;
  }

  /** Update the results tree (state) and notify any listener to refresh its UI. */
  private applyRefresh(payload: AiTriagePayload, result: NormalizedTriageResult): void {
    try {
      const list = this.resultsProvider?.loadedResults;
      let updatedInPlace = false;
      if (list && Array.isArray(list)) {
        const match = list.find(
          (r) => r?.similarityId === payload.similarityId || r?.id === payload.resultId
        );
        if (match) {
          match.state = result.stateDisplay;
          updatedInPlace = true;
        }
      }
      // Signal the tree to rebuild from the (mutated) loaded results rather than
      // re-reading the scan file — same mechanism the manual triage flow uses.
      if (updatedInPlace) {
        updateState(this.context, constants.triageUpdate, {
          id: true,
          name: constants.triageUpdate,
          scanDatetime: "",
          displayScanId: "",
        });
      }
      this.resultsProvider?.refresh?.();
      // Best-effort tree refresh via the shared command (no-op if not registered).
      void vscode.commands.executeCommand(commands.refreshTree);
    } catch (error) {
      this.logs.warn(`AI Triage refresh skipped: ${error}`);
    }
  }

  private handleError(error: unknown, productName: string): void {
    if (error instanceof AiTriageError) {
      if (error.kind === AiTriageErrorKind.cancelled) {
        vscode.window.showInformationMessage(`${productName}: AI Triage cancelled.`);
        return;
      }
      this.logs.error(`[AI Triage] ${error.kind}: ${error.message}`);
      vscode.window.showErrorMessage(`${productName}: ${error.message}`);
      return;
    }
    const message = (error as Error)?.message ?? "Unexpected error.";
    this.logs.error(`[AI Triage] unexpected error: ${message}`);
    vscode.window.showErrorMessage(`${productName}: AI Triage failed. ${message}`);
  }
}
