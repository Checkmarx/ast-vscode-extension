import * as vscode from "vscode";
import axios, { AxiosRequestConfig } from "axios";
import { jwtDecode } from "jwt-decode";
import { AuthService } from "./authService";
import { ProxyHelper } from "../utils/proxy/proxy";
import { Logs } from "../models/logs";
import { constants } from "../utils/common/constants";
import {
  AiTriageAcceptedResponse,
  AiTriageEngine,
  AiTriageInfo,
  AiTriagePhase,
  AiTriageRequest,
  AiTriageRunParams,
  NormalizedTriageResult,
  normalizeTriageInfo,
} from "../models/aiTriage";

/** Categories of failure surfaced to the user with a meaningful message. */
export enum AiTriageErrorKind {
  authentication = "authentication",
  permission = "permission",
  network = "network",
  timeout = "timeout",
  api = "api",
  unsupported = "unsupported",
  malformed = "malformed",
  cancelled = "cancelled",
}

/** Typed error so the command layer can render an appropriate notification. */
export class AiTriageError extends Error {
  constructor(public readonly kind: AiTriageErrorKind, message: string) {
    super(message);
    this.name = "AiTriageError";
  }
}

const DEFAULT_PLATFORM_BASE_URL = "https://ast-master-components.dev.cxast.net";
const HTTP_TIMEOUT_MS = 30_000;
const DEFAULT_MONITOR_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 3_000;

/**
 * Derive the Checkmarx One platform API base URL from the stored auth token by
 * decoding its `iss` (issuer) claim. Mirrors the logic already used by the MCP
 * settings injector so both paths resolve the same host.
 */
export function derivePlatformBaseUrl(token: string): string {
  try {
    const decoded = jwtDecode<{ iss?: string }>(token);
    const issuer = decoded?.iss;
    if (!issuer) {
      return DEFAULT_PLATFORM_BASE_URL;
    }
    const hostname = new URL(issuer).hostname;
    // Multi-tenant: iam.checkmarx.* -> ast.checkmarx.* ; single-tenant: host is the API base.
    return hostname.includes("iam.checkmarx")
      ? `https://${hostname.replace("iam", "ast")}`
      : `https://${hostname}`;
  } catch {
    return DEFAULT_PLATFORM_BASE_URL;
  }
}

/** Build the documented POST /api/ai-triage/triage request body for one result. */
export function buildTriageRequest(
  scanId: string,
  engine: AiTriageEngine,
  resultId: string
): AiTriageRequest {
  return {
    scanID: scanId,
    buckets: [{ scannerType: engine, resultIDs: [resultId] }],
  };
}

/**
 * Extract the current phase from an SSE text chunk. The stream reports
 * `"currentPhase":"RUNNING"` transitioning to `"currentPhase":"COMPLETED"`.
 * Returns the last phase seen in the chunk, or undefined if none.
 */
export function parseSsePhase(chunk: string): AiTriagePhase | undefined {
  if (!chunk) {
    return undefined;
  }
  const matches = [...chunk.matchAll(/"currentPhase"\s*:\s*"([^"]+)"/gi)];
  if (matches.length === 0) {
    return undefined;
  }
  const last = matches[matches.length - 1][1].toUpperCase();
  if (last === AiTriagePhase.completed) {
    return AiTriagePhase.completed;
  }
  if (last === AiTriagePhase.failed) {
    return AiTriagePhase.failed;
  }
  if (last === AiTriagePhase.running) {
    return AiTriagePhase.running;
  }
  return undefined;
}

/** Origin header value identifying this client to the platform. */
function getOriginHeader(): string {
  return constants.extensionFullName;
}

/**
 * Client for the platform AI Triage API. Reuses the extension's existing
 * authentication (SecretStorage token), proxy configuration and logging.
 * All platform I/O for AI Triage flows through this single service.
 */
export class AiTriageService {
  private static instance: AiTriageService | undefined;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logs?: Logs
  ) { }

  public static getInstance(context: vscode.ExtensionContext, logs?: Logs): AiTriageService {
    if (!AiTriageService.instance) {
      AiTriageService.instance = new AiTriageService(context, logs);
    }
    return AiTriageService.instance;
  }

  /** Reset the singleton (used by tests). */
  public static reset(): void {
    AiTriageService.instance = undefined;
  }

  private accessTokenCache?: { token: string; expiresAt: number; credential: string };

  /** Resolve the bearer access token and base URL (setting override, else derived). */
  private async getApiContext(): Promise<{ baseUrl: string; token: string }> {
    const credential = await AuthService.getInstance(this.context, this.logs).getToken();
    if (!credential) {
      throw new AiTriageError(
        AiTriageErrorKind.authentication,
        "You must be authenticated to Checkmarx One to use AI Triage."
      );
    }
    const override = vscode.workspace
      .getConfiguration(constants.cxOne)
      .get<string>("aiTriageApiBaseUrl");
    const baseUrl = override && override.trim().length > 0
      ? override.trim().replace(/\/+$/, "")
      : derivePlatformBaseUrl(credential);
    this.logs?.debug(`[AI Triage] base URL: ${baseUrl}`);

    // The stored credential is a Keycloak refresh/offline token — exchange it for
    // a short-lived access token to use as the Bearer on the API calls.
    const token = await this.getAccessToken(credential);
    return { baseUrl, token };
  }

  /** Exchange the stored refresh/offline token for an access token (cached). */
  private async getAccessToken(credential: string): Promise<string> {
    const cached = this.accessTokenCache;
    if (cached && cached.credential === credential && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    let decoded: { iss?: string; azp?: string } = {};
    try {
      decoded = jwtDecode<{ iss?: string; azp?: string }>(credential);
    } catch {
      // fall through to the missing-issuer error below
    }
    if (!decoded.iss) {
      throw new AiTriageError(
        AiTriageErrorKind.authentication,
        "Could not read the Checkmarx One token issuer to obtain an access token. Please re-authenticate."
      );
    }

    const tokenEndpoint = `${decoded.iss.replace(/\/+$/, "")}/protocol/openid-connect/token`;
    const clientId = decoded.azp || "ast-app";
    const agent = new ProxyHelper().createHttpsProxyAgent();
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: credential,
    });

    let response;
    try {
      response = await axios.post(tokenEndpoint, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        httpsAgent: agent,
        httpAgent: agent,
        proxy: false,
        timeout: HTTP_TIMEOUT_MS,
        validateStatus: () => true,
      });
    } catch (error) {
      throw this.wrapTransportError(error, "token");
    }

    if (response.status < 200 || response.status >= 300 || !response.data?.access_token) {
      throw new AiTriageError(
        AiTriageErrorKind.authentication,
        `Failed to obtain a Checkmarx One access token (status ${response.status}). Please re-authenticate.`
      );
    }

    const expiresIn = Number(response.data.expires_in) || 300;
    this.accessTokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + Math.max(30, expiresIn - 30) * 1000,
      credential,
    };
    return response.data.access_token;
  }

  private baseConfig(token: string, extra?: AxiosRequestConfig): AxiosRequestConfig {
    const agent = new ProxyHelper().createHttpsProxyAgent();
    return {
      timeout: HTTP_TIMEOUT_MS,
      httpsAgent: agent,
      httpAgent: agent,
      // Let the proxy agent handle proxying; disable axios' own env proxy handling.
      proxy: false,
      validateStatus: () => true,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "cx-origin": getOriginHeader(),
      },
      ...extra,
    };
  }

  /** Safely stringify a response body for diagnostic logging (truncated). */
  private bodyText(data: unknown): string {
    try {
      const s = typeof data === "string" ? data : JSON.stringify(data);
      return (s ?? "").slice(0, 500);
    } catch {
      return "<unserializable body>";
    }
  }

  /** Translate an HTTP status code into a typed AI Triage error. */
  private errorForStatus(status: number, context: string, url?: string): AiTriageError {
    if (status === 401) {
      return new AiTriageError(
        AiTriageErrorKind.authentication,
        "Authentication to Checkmarx One failed or expired. Please re-authenticate."
      );
    }
    if (status === 403) {
      return new AiTriageError(
        AiTriageErrorKind.permission,
        "AI Triage is not enabled for your tenant, or you lack the required permission."
      );
    }
    if (status === 404) {
      return new AiTriageError(
        AiTriageErrorKind.api,
        `AI Triage endpoint not found (404) for your environment. ` +
        `Set "checkmarxOne.aiTriageApiBaseUrl" to the correct host if it differs. URL: ${url ?? "?"}`
      );
    }
    if (status >= 500) {
      return new AiTriageError(
        AiTriageErrorKind.api,
        `AI Triage service error (${status}) — this is a platform-side error. ` +
        `The scan may still be processing or the service is temporarily unavailable; please retry shortly.`
      );
    }
    return new AiTriageError(
      AiTriageErrorKind.api,
      `AI Triage request failed (${context}) with status ${status}. URL: ${url ?? "?"}`
    );
  }

  private wrapTransportError(error: unknown, context: string): AiTriageError {
    if (error instanceof AiTriageError) {
      return error;
    }
    const err = error as { code?: string; message?: string };
    if (err?.code === "ERR_CANCELED" || err?.code === "ABORT_ERR") {
      return new AiTriageError(AiTriageErrorKind.cancelled, "AI Triage was cancelled.");
    }
    if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
      return new AiTriageError(AiTriageErrorKind.timeout, `AI Triage timed out (${context}).`);
    }
    return new AiTriageError(
      AiTriageErrorKind.network,
      `Could not reach Checkmarx One for AI Triage (${context}): ${err?.message ?? "network error"}.`
    );
  }

  /**
   * Submit an AI Triage request for a single result.
   * POST /api/ai-triage/triage -> 202 Accepted.
   */
  public async submitTriage(
    scanId: string,
    engine: AiTriageEngine,
    resultId: string,
    signal?: AbortSignal
  ): Promise<AiTriageAcceptedResponse> {
    const { baseUrl, token } = await this.getApiContext();
    const url = `${baseUrl}/api/ai-triage/triage`;
    const body = buildTriageRequest(scanId, engine, resultId);
    this.logs?.debug(
      `[AI Triage] POST ${url} scanID=${scanId} engine=${engine} resultID=${resultId}`
    );
    try {
      const response = await axios.post(url, body, this.baseConfig(token, { signal }));
      this.logs?.debug(`[AI Triage] submit status ${response.status}: ${this.bodyText(response.data)}`);
      if (response.status < 200 || response.status >= 300) {
        throw this.errorForStatus(response.status, "submit", url);
      }
      const data = response.data as Partial<AiTriageAcceptedResponse>;
      if (!data || typeof data.status !== "string") {
        throw new AiTriageError(
          AiTriageErrorKind.malformed,
          "AI Triage returned an unexpected response."
        );
      }
      return {
        scanID: data.scanID ?? scanId,
        status: data.status,
        triageID: data.triageID ?? "",
        published: Boolean(data.published),
        existingTriageState: data.existingTriageState ?? null,
      };
    } catch (error) {
      throw this.wrapTransportError(error, "submit");
    }
  }

  /**
   * Submit an AI Remediation request for a single result.
   * POST /api/remediation/remediate -> 202 Accepted. Processing is asynchronous;
   * the platform generates a fix / auto-PR when configured.
   */
  public async submitRemediation(
    scanId: string,
    projectId: string,
    engine: AiTriageEngine,
    resultId: string,
    signal?: AbortSignal
  ): Promise<AiTriageAcceptedResponse> {
    const { baseUrl, token } = await this.getApiContext();
    const url = `${baseUrl}/api/remediation/remediate`;
    const body = {
      scanID: scanId,
      projectID: projectId,
      buckets: [{ scannerType: engine, resultIDs: [resultId] }],
    };
    this.logs?.debug(`[AI Remediation] POST ${url} scanID=${scanId} engine=${engine}`);
    try {
      const response = await axios.post(url, body, this.baseConfig(token, { signal }));
      this.logs?.debug(
        `[AI Remediation] submit status ${response.status}: ${this.bodyText(response.data)}`
      );
      if (response.status < 200 || response.status >= 300) {
        throw this.errorForStatus(response.status, "remediate", url);
      }
      const data = response.data as Partial<AiTriageAcceptedResponse>;
      return {
        scanID: data?.scanID ?? scanId,
        status: data?.status ?? "accepted",
        triageID: data?.triageID ?? "",
        published: Boolean(data?.published),
        existingTriageState: data?.existingTriageState ?? null,
      };
    } catch (error) {
      throw this.wrapTransportError(error, "remediate");
    }
  }

  /**
   * Fetch the project's risks (bulk). Each risk carries `stateChangedBy`
   * ("AI" | "manual" | "unchanged") which tells us how each finding was triaged.
   * GET /api/risks?projectId=&limit=&offset=[&severity=]. Best-effort: returns []
   * on any error so the caller can degrade gracefully.
   */
  public async getRisks(
    projectId: string,
    severity?: string,
    signal?: AbortSignal
  ): Promise<Array<Record<string, unknown>>> {
    const { baseUrl, token } = await this.getApiContext();
    const limit = 200;
    const all: Array<Record<string, unknown>> = [];

    // Page through offsets until a short page is returned (or a safety cap).
    for (let page = 0, offset = 0; page < 25; page++, offset += limit) {
      const params = new URLSearchParams({
        projectId,
        limit: String(limit),
        offset: String(offset),
      });
      if (severity) {
        params.set("severity", severity);
      }
      const url = `${baseUrl}/api/risks?${params.toString()}`;

      let response;
      try {
        response = await axios.get(url, this.baseConfig(token, { signal }));
      } catch (error) {
        this.logs?.debug(`[AI Triage] risks fetch failed: ${(error as Error)?.message}`);
        break;
      }
      if (response.status < 200 || response.status >= 300) {
        this.logs?.debug(`[AI Triage] risks status ${response.status}: ${this.bodyText(response.data)}`);
        break;
      }
      const data = response.data as
        | Array<Record<string, unknown>>
        | { items?: unknown; risks?: unknown; results?: unknown; totalCount?: unknown }
        | undefined;
      const items = Array.isArray(data)
        ? data
        : (data?.items ?? data?.risks ?? data?.results ?? []);
      const arr = Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
      all.push(...arr);
      if (arr.length < limit) {
        break; // last page
      }
    }
    return all;
  }

  /**
   * Read the current AI Triage information for a result.
   * GET /api/aitriage/triage/{projectId}/{similarityId}. Returns undefined on 404.
   */
  public async getTriageInfo(
    projectId: string,
    similarityId: string,
    signal?: AbortSignal
  ): Promise<AiTriageInfo | undefined> {
    const { baseUrl, token } = await this.getApiContext();
    const url = `${baseUrl}/api/aitriage/triage/${encodeURIComponent(
      projectId
    )}/${encodeURIComponent(similarityId)}`;
    try {
      const response = await axios.get(url, this.baseConfig(token, { signal }));
      // 404/400 => the AI Triage decision is not available yet (still processing).
      // Treat as "not ready" so the poller keeps waiting rather than hard-failing.
      if (response.status === 404 || response.status === 400) {
        this.logs?.debug(
          `[AI Triage] info not ready (status ${response.status}): ${this.bodyText(response.data)}`
        );
        return undefined;
      }
      if (response.status < 200 || response.status >= 300) {
        this.logs?.debug(`[AI Triage] info error body: ${this.bodyText(response.data)}`);
        throw this.errorForStatus(response.status, "info", url);
      }
      if (response.data && typeof response.data === "object") {
        return response.data as AiTriageInfo;
      }
      if (typeof response.data === "string" && response.data.trim().length > 0) {
        return { state: response.data };
      }
      return undefined;
    } catch (error) {
      throw this.wrapTransportError(error, "info");
    }
  }

  /**
   * Monitor triage progress via the server-sent-events gateway until the phase
   * becomes COMPLETED (or fails/times out). Requires a groupId; when one is not
   * available callers should fall back to {@link pollUntilResolved}.
   */
  public async monitorViaSse(
    engine: AiTriageEngine,
    groupId: string,
    projectId: string,
    options?: { signal?: AbortSignal; timeoutMs?: number; onPhase?: (p: AiTriagePhase) => void }
  ): Promise<AiTriagePhase> {
    const { baseUrl, token } = await this.getApiContext();
    const url =
      `${baseUrl}/api/ssegateway/triage-status?engine=${encodeURIComponent(engine)}` +
      `&groupId=${encodeURIComponent(groupId)}&projectId=${encodeURIComponent(projectId)}`;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_MONITOR_TIMEOUT_MS;

    const response = await axios.get(
      url,
      this.baseConfig(token, {
        signal: options?.signal,
        responseType: "stream",
        timeout: 0,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
          "cx-origin": getOriginHeader(),
        },
      })
    );

    if (response.status < 200 || response.status >= 300) {
      throw this.errorForStatus(response.status, "monitor", url);
    }

    const stream = response.data as NodeJS.ReadableStream;
    return new Promise<AiTriagePhase>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        try {
          (stream as unknown as { destroy?: () => void }).destroy?.();
        } catch {
          /* best effort */
        }
        fn();
      };
      const timer = setTimeout(
        () =>
          finish(() =>
            reject(new AiTriageError(AiTriageErrorKind.timeout, "AI Triage monitoring timed out."))
          ),
        timeoutMs
      );
      stream.on("data", (buf: Buffer) => {
        const phase = parseSsePhase(buf.toString("utf8"));
        if (phase) {
          options?.onPhase?.(phase);
          if (phase === AiTriagePhase.completed) {
            finish(() => resolve(AiTriagePhase.completed));
          } else if (phase === AiTriagePhase.failed) {
            finish(() =>
              reject(new AiTriageError(AiTriageErrorKind.api, "AI Triage processing failed."))
            );
          }
        }
      });
      stream.on("error", (err: unknown) =>
        finish(() => reject(this.wrapTransportError(err, "monitor")))
      );
      stream.on("end", () =>
        finish(() =>
          reject(new AiTriageError(AiTriageErrorKind.api, "AI Triage stream ended before completion."))
        )
      );
    });
  }

  /**
   * Poll the AI Triage Info API until a decision is available (differs from any
   * previous state) or the timeout elapses. Used as the primary monitor when a
   * groupId for the SSE stream is not derivable, and as an SSE fallback.
   */
  public async pollUntilResolved(
    projectId: string,
    similarityId: string,
    options?: { signal?: AbortSignal; timeoutMs?: number; intervalMs?: number; previousState?: string }
  ): Promise<AiTriageInfo | undefined> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_MONITOR_TIMEOUT_MS;
    const intervalMs = options?.intervalMs ?? POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;
    const previous = (options?.previousState ?? "").trim().toLowerCase();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (options?.signal?.aborted) {
        throw new AiTriageError(AiTriageErrorKind.cancelled, "AI Triage was cancelled.");
      }
      const info = await this.getTriageInfo(projectId, similarityId, options?.signal);
      const state = (info?.state ?? "").trim().toLowerCase();
      if (state && state !== previous) {
        return info;
      }
      if (Date.now() >= deadline) {
        throw new AiTriageError(
          AiTriageErrorKind.timeout,
          "Timed out waiting for the AI Triage decision."
        );
      }
      await this.delay(Math.min(intervalMs, Math.max(0, deadline - Date.now())), options?.signal);
    }
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new AiTriageError(AiTriageErrorKind.cancelled, "AI Triage was cancelled."));
        },
        { once: true }
      );
    });
  }

  /**
   * End-to-end AI Triage for a single result: submit, wait for completion, then
   * read back the resulting decision. Prefers the SSE monitor when a groupId is
   * available and transparently falls back to polling the Info API.
   */
  public async runTriage(
    params: AiTriageRunParams,
    options?: {
      signal?: AbortSignal;
      monitorTimeoutMs?: number;
      onPhase?: (p: AiTriagePhase) => void;
    }
  ): Promise<NormalizedTriageResult> {
    const accepted = await this.submitTriage(
      params.scanId,
      params.engine,
      params.resultId,
      options?.signal
    );
    const previousState = accepted.existingTriageState ?? undefined;

    if (params.groupId) {
      try {
        await this.monitorViaSse(params.engine, params.groupId, params.projectId, {
          signal: options?.signal,
          timeoutMs: options?.monitorTimeoutMs,
          onPhase: options?.onPhase,
        });
      } catch (error) {
        if (error instanceof AiTriageError && error.kind === AiTriageErrorKind.cancelled) {
          throw error;
        }
        this.logs?.warn(
          `[AI Triage] SSE monitoring unavailable, falling back to polling: ${(error as Error)?.message
          }`
        );
      }
    }

    const info = await this.pollUntilResolved(params.projectId, params.similarityId, {
      signal: options?.signal,
      timeoutMs: options?.monitorTimeoutMs,
      previousState,
    });

    const normalized = normalizeTriageInfo(info);
    if (!normalized) {
      throw new AiTriageError(
        AiTriageErrorKind.malformed,
        "AI Triage completed but no decision was returned for this result."
      );
    }
    return normalized;
  }
}
