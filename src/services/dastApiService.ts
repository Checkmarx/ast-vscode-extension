import * as vscode from "vscode";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { ProxyHelper } from "../utils/proxy/proxy";

interface DecodedJwt {
  iss: string;
}

// ==================== API Response Types ====================

/**
 * Risk level counts by severity
 */
export interface RiskLevel {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
}

/**
 * Environment with full status - matches EnvWithStatus from Go
 */
export interface DastEnvironment {
  environmentId: string;
  tunnelId: string;
  created: string;  // ISO date string
  domain: string;
  url: string;
  scanType: string;  // "DAST" | "DASTAPI"
  projectIds: string[];
  tags: string[];
  groups: string[];
  applications: { applicationId: string; isPrimary: boolean }[];
  riskLevel: RiskLevel;
  riskRating: string;  // "Critical risk" | "High risk" | "Medium risk" | "Low risk" | "No risk"
  alertRiskLevel: RiskLevel;
  lastScanID: string;
  lastScanTime: string;  // ISO date string
  lastStatus: string;  // "New" | "Running" | "Completed" | "Failed" | "Cancelled"
  authSuccess: boolean;
  isPublic: boolean;
  authMethod: string;
  lastAuthUUID: string;
  lastAuthSuccess: boolean;
  hasReport: boolean;
  hasAuth: boolean;
  tunnelState: string;  // "connected" | "disconnected" | "no_tunnel"
}

/**
 * Response from GET /api/dast/scans/environments
 */
export interface EnvironmentsResponse {
  environments: DastEnvironment[] | null;
  totalItems: number;
  misconfiguredCount: number;
  zrokHost: string;
}

/**
 * Scan with full status - matches ScanWithStatus from Go
 */
export interface DastScan {
  scanId: string;
  environmentId: string;
  initiator: string;
  scanType: string;
  created: string;
  projectId: string;
  tags: string[];
  groups: string[];
  riskLevel: RiskLevel;
  riskRating: string;
  alertRiskLevel: RiskLevel;
  startTime: string;
  updateTime: string;
  scanDuration: number;
  lastStatus: string;
  statistics: string;
  hasResults: boolean;
  scannedPathsCount: number;
  hasLog: boolean;
}

/**
 * Response from GET /api/dast/scans (for environment)
 */
export interface ScansResponse {
  scans: DastScan[] | null;
  totalScans: number;
}

// ==================== Alert Level Results ====================

/**
 * Alert level result - represents a vulnerability type with multiple instances
 */
export interface AlertLevelResult {
  alertSimilarityId: string;  // JSON: alert_similarity_id
  state: string;
  severity: string;
  name: string;
  numInstances: number;       // JSON: num_instances
  status: string;
  owasp: string[];
  numNotes: number;           // JSON: num_notes
}

/**
 * Response from alert level results API
 */
export interface AlertLevelResultList {
  results: AlertLevelResult[];
  total: number;
  pagesNumber: number;        // JSON: pages_number
}

// Legacy interface - keeping for potential future use
export interface DastResult {
  id: string;
  scanId: string;
  endpoint: string;
  httpMethod: string;
  vulnerableParameter: string;
  vulnerabilityType: string;
  severity: string;
  description: string;
  request?: string;
  response?: string;
  evidence?: string;
}

export class DastApiService {
  private static instance: DastApiService;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public static getInstance(context: vscode.ExtensionContext): DastApiService {
    if (!DastApiService.instance) {
      DastApiService.instance = new DastApiService(context);
    }
    return DastApiService.instance;
  }

  /**
   * Get the base URL from stored configuration
   * Uses the URL that was saved during authentication
   */
  private async getBaseUrl(): Promise<string> {
    // Try to get from stored recent URLs (saved during auth)
    const recentURLsAndTenant = this.context.globalState.get<{ [key: string]: string[] }>("recentURLsAndTenant");
    
    if (recentURLsAndTenant) {
      const urls = Object.keys(recentURLsAndTenant);
      if (urls.length > 0) {
        // Use the most recently used URL (last in the object)
        // Remove trailing slash to avoid double slashes in API calls
        const baseUrl = urls[urls.length - 1].replace(/\/+$/, "");
        console.log(`Using base URL from stored config: ${baseUrl}`);
        return baseUrl;
      }
    }

    // Fallback: Try to derive from JWT token
    const apiKey = await this.context.secrets.get("authCredential");
    if (!apiKey) {
      throw new Error("Not authenticated. Please log in first.");
    }

    try {
      const decoded = jwtDecode<DecodedJwt>(apiKey);
      const issuer = decoded.iss;
      
      if (!issuer) {
        throw new Error("API key is missing 'iss' field.");
      }

      // Extract base URL from issuer
      // Issuer format: https://iam.checkmarx.net/auth/realms/tenant
      // or: https://iam-region.checkmarx.net/auth/realms/tenant
      const issuerUrl = new URL(issuer);
      const hostname = issuerUrl.hostname;
      
      // For production: iam.checkmarx.net -> ast.checkmarx.net
      // For dev/staging: keep the original pattern
      let baseUrl: string;
      if (hostname.includes("iam.checkmarx")) {
        baseUrl = `https://${hostname.replace("iam", "ast")}`;
      } else {
        // For dev environments, try to use the issuer's base
        // e.g., https://iam-dev.dev.cxast.net -> need to use ast-master-components.dev.cxast.net
        // This is tricky, so warn the user
        console.warn(`Could not determine base URL from issuer: ${issuer}`);
        console.warn("Please ensure you're logged in with the correct server URL.");
        throw new Error("Could not determine API base URL. Please re-authenticate.");
      }

      console.log(`Derived base URL from JWT: ${baseUrl}`);
      return baseUrl;
    } catch (error) {
      console.error("Failed to get base URL:", error);
      throw new Error("Failed to determine API base URL. Please re-authenticate.");
    }
  }

  /**
   * Get the refresh token from storage
   */
  private async getRefreshToken(): Promise<string> {
    const refreshToken = await this.context.secrets.get("authCredential");
    if (!refreshToken) {
      throw new Error("Not authenticated. Please log in first.");
    }
    return refreshToken;
  }

  /**
   * Exchange refresh token for an access token (JWT)
   */
  private async getAccessToken(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    const baseUrl = await this.getBaseUrl();
    
    // Get tenant from stored config
    const recentURLsAndTenant = this.context.globalState.get<{ [key: string]: string[] }>("recentURLsAndTenant");
    let tenant: string | undefined;
    
    if (recentURLsAndTenant) {
      const urls = Object.keys(recentURLsAndTenant);
      if (urls.length > 0) {
        const storedUrl = urls[urls.length - 1];
        const tenants = recentURLsAndTenant[storedUrl];
        if (tenants && tenants.length > 0) {
          tenant = tenants[tenants.length - 1];
        }
      }
    }

    if (!tenant) {
      throw new Error("Tenant not found. Please re-authenticate.");
    }

    const tokenEndpoint = `${baseUrl}/auth/realms/${tenant}/protocol/openid-connect/token`;
    console.log(`Exchanging refresh token for access token at: ${tokenEndpoint}`);

    const proxyHelper = new ProxyHelper();
    const agent = proxyHelper.createHttpsProxyAgent();

    try {
      const params = new URLSearchParams({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        grant_type: "refresh_token",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        client_id: "ide-integration",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        refresh_token: refreshToken,
      });

      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "Content-Type": "application/x-www-form-urlencoded",
        },
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 30000,
      });

      if (!response.data?.access_token) {
        throw new Error("Response did not include access token");
      }

      console.log("Successfully obtained access token");
      return response.data.access_token;
    } catch (error) {
      console.error("Failed to exchange refresh token:", error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400 || error.response?.status === 401) {
          throw new Error("Session expired. Please re-authenticate.");
        }
        throw new Error(`Token exchange failed: ${error.response?.data?.error_description || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create an axios instance with authentication and proxy support
   */
  private async createAxiosInstance() {
    const baseUrl = await this.getBaseUrl();
    const accessToken = await this.getAccessToken();
    const proxyHelper = new ProxyHelper();
    const agent = proxyHelper.createHttpsProxyAgent();

    return axios.create({
      baseURL: baseUrl,
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Authorization": `Bearer ${accessToken}`,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      httpAgent: agent,
      timeout: 30000,
    });
  }

  /**
   * Fetch DAST environments
   * @param from Starting index for pagination
   * @param to Ending index for pagination
   * @param search Optional search string
   */
  async getEnvironments(from: number = 1, to: number = 50, search?: string): Promise<DastEnvironment[]> {
    try {
      const client = await this.createAxiosInstance();
      
      let url = `/api/dast/scans/environments?from=${from}&to=${to}`;
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const baseUrl = await this.getBaseUrl();
      console.log(`Fetching DAST environments from: ${baseUrl}${url}`);
      const response = await client.get<EnvironmentsResponse>(url);
      
      // Response format: { environments: [...], totalItems: n, misconfiguredCount: n, zrokHost: "..." }
      const data = response.data;
      
      if (data.environments && Array.isArray(data.environments)) {
        console.log(`Found ${data.environments.length} environments (total: ${data.totalItems})`);
        return data.environments;
      }
      
      console.warn("No environments in response or unexpected format:", data);
      return [];
    } catch (error) {
      console.error("Failed to fetch DAST environments:", error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error("Authentication failed. Please re-authenticate.");
        }
        if (error.response?.status === 403) {
          throw new Error("Access denied. DAST feature may not be enabled for your account.");
        }
        if (error.response?.status === 404) {
          throw new Error("DAST API not found. This feature may not be available.");
        }
        throw new Error(`Failed to fetch environments: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch DAST scans for a specific environment
   * @param environmentId The environment ID
   * @param from Starting index for pagination
   * @param to Ending index for pagination
   * @param search Optional search string
   * @param sort Sort order, defaults to "created:desc" for newest first
   */
	async getScans(
		environmentId: string,
		from: number = 1,
		to: number = 10,
		search?: string,
		sort: string = "created:desc"
	): Promise<DastScan[]> {
    try {
      const client = await this.createAxiosInstance();
      
		// Build URL with query parameters
		let url = `/api/dast/scans/scans?environmentId=${environmentId}&from=${from}&to=${to}&sort=${sort}`;
		if (search) {
			url += `&search=${encodeURIComponent(search)}`;
		}
      
      console.log(`Fetching DAST scans: ${url}`);
      const response = await client.get<ScansResponse>(url);
      
      // Response format: { scans: [...], totalScans: n }
      const data = response.data;
      
      if (data.scans && Array.isArray(data.scans)) {
        console.log(`Found ${data.scans.length} scans (total: ${data.totalScans})`);
        return data.scans;
      }
      
      console.warn("No scans in response or unexpected format:", data);
      return [];
    } catch (error) {
      console.error("Failed to fetch DAST scans:", error);
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch scans: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch a single DAST scan by ID
   * @param scanId The scan ID
   */
	async getScan(scanId: string): Promise<DastScan | undefined> {
		try {
			const client = await this.createAxiosInstance();
			const url = `/api/dast/scans/scan/${scanId}`;

			console.log(`Fetching DAST scan: ${url}`);
			const response = await client.get<DastScan>(url);

			if (response.data) {
				console.log(`Found scan: ${response.data.scanId}`);
				return response.data;
			}

			console.warn("No scan data in response");
			return undefined;
		} catch (error) {
			console.error(`Failed to fetch scan ${scanId}:`, error);
			if (axios.isAxiosError(error)) {
				if (error.response?.status === 404) {
					return undefined;
				}
				throw new Error(`Failed to fetch scan: ${error.response?.data?.message || error.message}`);
			}
			return undefined;
		}
	}

  /**
   * Fetch alert-level results for a DAST scan
   * Each alert represents a vulnerability type that may have multiple instances
   * @param environmentId The environment ID
   * @param scanId The scan ID
   * @param page Page number (1-based)
   * @param perPage Results per page
   * @param search Optional search string
   * @param sortBy Sort order, defaults to "severity:desc"
   */
  async getAlerts(
    environmentId: string,
    scanId: string,
    page: number = 1,
    perPage: number = 50,
    search?: string,
    sortBy: string = "severity:desc"
  ): Promise<{ alerts: AlertLevelResult[]; total: number; pagesNumber: number }> {
    try {
      const client = await this.createAxiosInstance();
      
      let url = `/api/dast/mfe-results/results/environment/${environmentId}/${scanId}/alert_level?page=${page}&per_page=${perPage}&sort_by=${encodeURIComponent(sortBy)}`;
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      
      console.log(`Fetching DAST alerts: ${url}`);
      const response = await client.get<AlertLevelResultList>(url);
      
      const data = response.data;
      if (data && Array.isArray(data.results)) {
        console.log(`Found ${data.results.length} alerts (total: ${data.total})`);
        
        // Map snake_case to camelCase
        const alerts = data.results.map(alert => ({
          alertSimilarityId: (alert as any).alert_similarity_id || alert.alertSimilarityId,
          state: alert.state,
          severity: alert.severity,
          name: alert.name,
          numInstances: (alert as any).num_instances ?? alert.numInstances ?? 0,
          status: alert.status,
          owasp: alert.owasp || [],
          numNotes: (alert as any).num_notes ?? alert.numNotes ?? 0
        }));
        
        return {
          alerts,
          total: data.total,
          pagesNumber: (data as any).pages_number ?? data.pagesNumber ?? 1
        };
      }
      
      console.warn("No alerts in response or unexpected format:", data);
      return { alerts: [], total: 0, pagesNumber: 0 };
    } catch (error) {
      console.error("Failed to fetch DAST alerts:", error);
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch alerts: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch DAST results for a specific scan (legacy method)
   * @param scanId The scan ID
   * @param environmentId The environment ID
   */
  async getResults(scanId: string, environmentId: string): Promise<DastResult[]> {
    try {
      const client = await this.createAxiosInstance();
      
      // TODO: Confirm the actual API endpoint for DAST results when we implement this
      const url = `/api/dast/scans/environments/${environmentId}/scans/${scanId}/results`;
      
      console.log(`Fetching DAST results: ${url}`);
      const response = await client.get(url);
      
      // Handle different response formats - will need to update when we know the actual structure
      if (Array.isArray(response.data)) {
        return response.data.map(this.mapResult);
      } else if (response.data?.results) {
        return response.data.results.map(this.mapResult);
      } else if (response.data?.items) {
        return response.data.items.map(this.mapResult);
      }
      
      console.warn("Unexpected response format for results:", response.data);
      return [];
    } catch (error) {
      console.error("Failed to fetch DAST results:", error);
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch results: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get total risk count from a RiskLevel object
   */
  getTotalRiskCount(riskLevel: RiskLevel): number {
    if (!riskLevel) {return 0;}
    return (
      (riskLevel.criticalCount || 0) +
      (riskLevel.highCount || 0) +
      (riskLevel.mediumCount || 0) +
      (riskLevel.lowCount || 0) +
      (riskLevel.infoCount || 0)
    );
  }

  /**
   * Format risk level for display
   */
  formatRiskLevel(riskLevel: RiskLevel): string {
    if (!riskLevel) {
      return "No risks";
    }
    const parts: string[] = [];
    if (riskLevel.criticalCount > 0) {
      parts.push(`${riskLevel.criticalCount} Critical`);
    }
    if (riskLevel.highCount > 0) {
      parts.push(`${riskLevel.highCount} High`);
    }
    if (riskLevel.mediumCount > 0) {
      parts.push(`${riskLevel.mediumCount} Medium`);
    }
    if (riskLevel.lowCount > 0) {
      parts.push(`${riskLevel.lowCount} Low`);
    }
    if (riskLevel.infoCount > 0) {
      parts.push(`${riskLevel.infoCount} Info`);
    }
    return parts.length > 0 ? parts.join(", ") : "No risks";
  }

  // Map API response to DastResult interface (for future use)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapResult(result: any): DastResult {
    return {
      id: result.id || result.resultId || result.ID,
      scanId: result.scanId || result.ScanId,
      endpoint: result.endpoint || result.url || result.path || result.Endpoint,
      httpMethod: result.httpMethod || result.method || result.Method || "GET",
      vulnerableParameter: result.vulnerableParameter || result.parameter || result.Parameter || "",
      vulnerabilityType: result.vulnerabilityType || result.type || result.queryName || result.Type,
      severity: result.severity || result.Severity || "Medium",
      description: result.description || result.Description || "",
      request: result.request || result.httpRequest,
      response: result.response || result.httpResponse,
      evidence: result.evidence || result.proof,
    };
  }
}

