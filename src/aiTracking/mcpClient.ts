import * as vscode from "vscode";
import { jwtDecode } from "jwt-decode";
import { isIDE } from "../utils/utils";
import { constants } from "../utils/common/constants";
import { AuthService } from "../services/authService";
import {
  McpRecommendationParams,
  McpRecommendation,
  ScannerType,
  McpSuggestedAction
} from "./types";

interface DecodedJwt {
  iss: string;
}

/**
 * MCP Tool request format
 */
interface McpToolRequest {
  jsonrpc: string;
  method: string;
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
  id: number;
}

/**
 * MCP Tool response format
 */
interface McpToolResponse {
  jsonrpc: string;
  result?: {
    content?: Array<{
      type: string;
      text?: string;
    }>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

/**
 * Client for direct communication with Checkmarx MCP server
 * Used to pre-fetch recommendations before sending to AI chat
 */
export class McpClient {
  private static instance: McpClient;
  private context: vscode.ExtensionContext;
  private requestId: number = 0;
  public lastCurlCommand: string = ''; // Store last curl command for logging
  private sessionId: string | null = null; // MCP session ID
  private sessionExpiry: number = 0; // Session expiration timestamp

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get singleton instance
   */
  static getInstance(context?: vscode.ExtensionContext): McpClient {
    if (!McpClient.instance) {
      if (!context) {
        throw new Error("McpClient must be initialized with context first");
      }
      McpClient.instance = new McpClient(context);
    }
    return McpClient.instance;
  }

  /**
   * Initialize the MCP client with extension context
   */
  static initialize(context: vscode.ExtensionContext): McpClient {
    McpClient.instance = new McpClient(context);
    return McpClient.instance;
  }

  /**
   * Get the MCP server base URL from the API key
   */
  private async getMcpBaseUrl(): Promise<string | null> {
    const apiKey = await this.context.secrets.get("authCredential");
    if (!apiKey) {
      return null;
    }

    try {
      const decoded = jwtDecode<DecodedJwt>(apiKey);
      if (!decoded?.iss) {
        return null;
      }

      let baseUrl = "https://ast-master-components.dev.cxast.net";
      const hostname = new URL(decoded.iss).hostname;
      if (hostname.includes("iam.checkmarx")) {
        const astHostname = hostname.replace("iam", "ast");
        baseUrl = `https://${astHostname}`;
      }

      return `${baseUrl}/api/security-mcp/mcp`;
    } catch (error) {
      console.error("Failed to decode JWT for MCP URL:", error);
      return null;
    }
  }

  /**
   * Get the IDE origin for headers
   */
  private getIdeOrigin(): string {
    if (isIDE(constants.windsurfAgent)) {
      return constants.windsurfAgent;
    }
    if (isIDE(constants.cursorAgent)) {
      return constants.cursorAgent;
    }
    if (isIDE(constants.kiroAgent)) {
      return constants.kiroAgent;
    }
    return "VsCode";
  }

  /**
   * Initialize MCP session (required before calling tools)
   */
  private async initializeSession(baseUrl: string, apiKey: string): Promise<string | null> {
    console.log("[MCP] Initializing MCP session...");

    const request = {
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "checkmarx-vscode-extension",
          version: "1.0.0"
        }
      },
      id: ++this.requestId
    };

    console.log("[MCP] Initialize request:", JSON.stringify(request, null, 2));

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": apiKey,
          "cx-origin": this.getIdeOrigin()
        },
        body: JSON.stringify(request)
      });

      console.log("[MCP] Initialize response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[MCP] Initialize failed:", errorText);
        return null;
      }

      // Try to get session ID from headers (try all common header names)
      const sessionIdFromHeader = response.headers.get('Mcp-Session-Id') ||  // Checkmarx uses this!
        response.headers.get('mcp-session-id') ||
        response.headers.get('X-Session-ID') ||
        response.headers.get('x-session-id');

      if (sessionIdFromHeader) {
        console.log("[MCP] ✓ Session ID from header:", sessionIdFromHeader);
        this.sessionId = sessionIdFromHeader;
        this.sessionExpiry = Date.now() + (30 * 60 * 1000); // 30 minutes
        return sessionIdFromHeader;
      }

      // Try to get session ID from cookies
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        const sessionMatch = cookies.match(/mcp-session=([^;]+)/);
        if (sessionMatch) {
          console.log("[MCP] Session ID from cookie:", sessionMatch[1]);
          this.sessionId = sessionMatch[1];
          this.sessionExpiry = Date.now() + (30 * 60 * 1000);
          return sessionMatch[1];
        }
      }

      console.warn("[MCP] No session ID found in response headers or cookies");
      return null;
    } catch (error) {
      console.error("[MCP] Error initializing session:", error);
      return null;
    }
  }

  /**
   * Check if current session is valid
   */
  private isSessionValid(): boolean {
    return this.sessionId !== null && Date.now() < this.sessionExpiry;
  }

  /**
   * Make a direct HTTP call to the MCP server
   */
  private async callMcpTool(
    toolName: string,
    toolArguments: Record<string, unknown>
  ): Promise<McpToolResponse | null> {
    const baseUrl = await this.getMcpBaseUrl();
    if (!baseUrl) {
      console.error("[MCP] ERROR: MCP base URL not available");
      return null;
    }

    // Use AuthService to get and validate token
    const authService = AuthService.getInstance(this.context);
    const apiKey = await authService.getToken();

    if (!apiKey) {
      console.error("[MCP] ERROR: API key not available for MCP call");
      return null;
    }

    // Check if we have a valid session, if not, initialize one
    if (!this.isSessionValid()) {
      console.log("[MCP] No valid session found, initializing...");
      const sessionId = await this.initializeSession(baseUrl, apiKey);

      if (!sessionId) {
        console.error("[MCP] ERROR: Failed to initialize MCP session");
        return null;
      }

      console.log("[MCP] ✓ Session initialized successfully:", sessionId);
    } else {
      console.log("[MCP] ✓ Using existing session:", this.sessionId);
    }

    const request: McpToolRequest = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: toolArguments
      },
      id: ++this.requestId
    };

    // DEBUG: Print the COMPLETE request being sent to MCP
    console.log("[MCP] ========== FULL API REQUEST ==========");
    console.log("[MCP] URL:", baseUrl);
    console.log("[MCP] Method: POST");
    console.log("[MCP] Tool Name:", toolName);
    console.log("[MCP] Tool Arguments:", JSON.stringify(toolArguments, null, 2));
    console.log("[MCP] Complete Request Body:", JSON.stringify(request, null, 2));
    console.log("[MCP] Headers:");
    console.log("  Content-Type:", "application/json");
    console.log("  Authorization:", apiKey); // Print full token for debugging
    console.log("  cx-origin:", this.getIdeOrigin());
    console.log("  Mcp-Session-Id:", this.sessionId); // Include session ID
    console.log("[MCP] ==========================================");

    // DEBUG: Print equivalent curl command for manual testing
    const curlCommand = `curl -X POST "${baseUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: ${apiKey}" \\
  -H "cx-origin: ${this.getIdeOrigin()}" \\
  -H "Mcp-Session-Id: ${this.sessionId || 'SESSION_ID_HERE'}" \\
  -d '${JSON.stringify(request)}'`;

    // Store for external access (e.g., logging)
    this.lastCurlCommand = curlCommand;

    console.log("[MCP] Equivalent curl command:");
    console.log(curlCommand);
    console.log("[MCP] ==========================================");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": apiKey,
        "cx-origin": this.getIdeOrigin()
      };

      // Add session ID if available (use Mcp-Session-Id header)
      if (this.sessionId) {
        headers["Mcp-Session-Id"] = this.sessionId;
      }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(request)
      });

      console.log("[MCP] ========== RESPONSE FROM MCP ==========");
      console.log("[MCP] Status:", response.status, response.statusText);
      console.log("[MCP] Response Headers:");
      response.headers.forEach((value, key) => {
        console.log(`  ${key}:`, value);
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[MCP] ERROR: HTTP call failed");
        console.error("[MCP] Status Code:", response.status);
        console.error("[MCP] Status Text:", response.statusText);
        console.error("[MCP] Response Body:", errorText);
        console.log("[MCP] ==========================================");
        return null;
      }

      const responseText = await response.text();
      console.log("[MCP] Response Body (raw):", responseText);

      const jsonResponse = JSON.parse(responseText) as McpToolResponse;
      console.log("[MCP] Response Body (parsed):", JSON.stringify(jsonResponse, null, 2));
      console.log("[MCP] ==========================================");

      return jsonResponse;
    } catch (error) {
      console.error("[MCP] ERROR: Exception during MCP call:", error);
      console.error("[MCP] Error details:", (error as Error).message);
      return null;
    }
  }

  /**
   * Parse the MCP response text to extract version and action
   */
  private parseRecommendation(responseText: string, scannerType: ScannerType): McpRecommendation {
    const recommendation: McpRecommendation = {
      suggestedAction: 'upgrade',
      fixInstructions: responseText
    };

    // Try to extract version from common patterns in fix_instructions
    // Pattern: "upgrade to version X.Y.Z" or "version: X.Y.Z" or "X.Y.Z"
    const versionPatterns = [
      /upgrade\s+to\s+(?:version\s+)?["']?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)["']?/i,
      /recommended\s+version[:\s]+["']?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)["']?/i,
      /safe\s+version[:\s]+["']?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)["']?/i,
      /version[:\s]+["']?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)["']?/i,
      /"suggestedVersion"[:\s]*"(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)"/i
    ];

    for (const pattern of versionPatterns) {
      const match = responseText.match(pattern);
      if (match && match[1]) {
        recommendation.suggestedVersion = match[1];
        break;
      }
    }

    // Determine action based on content
    const lowerText = responseText.toLowerCase();
    if (lowerText.includes('remove') || lowerText.includes('uninstall')) {
      recommendation.suggestedAction = 'remove';
    } else if (lowerText.includes('replace') || lowerText.includes('alternative')) {
      recommendation.suggestedAction = 'replace';
      // Try to extract alternative package name
      const altPattern = /(?:replace|alternative)[:\s]+["']?([a-z0-9@/_-]+)["']?/i;
      const altMatch = responseText.match(altPattern);
      if (altMatch && altMatch[1]) {
        recommendation.alternativePackage = altMatch[1];
      }
    } else if (lowerText.includes('externalize') || lowerText.includes('environment variable')) {
      recommendation.suggestedAction = 'externalize';
    }

    return recommendation;
  }

  /**
   * Get MCP recommendation for a package vulnerability (OSS)
   */
  async getPackageRemediation(params: {
    packageName: string;
    packageVersion: string;
    packageManager: string;
    issueType: 'CVE' | 'malicious';
  }): Promise<McpRecommendation> {
    console.log('[MCP] Calling packageRemediation with params:', JSON.stringify(params, null, 2));

    const response = await this.callMcpTool("packageRemediation", {
      packageName: params.packageName,
      packageVersion: params.packageVersion,
      packageManager: params.packageManager,
      issueType: params.issueType
    });

    // DEBUG: Print the raw JSON response
    console.log('[MCP] PackageRemediation Response:', JSON.stringify(response, null, 2));

    if (!response || response.error) {
      return {
        suggestedAction: 'upgrade',
        error: response?.error?.message || "MCP call failed"
      };
    }

    // Extract text from response
    const textContent = response.result?.content?.find(c => c.type === 'text');
    if (!textContent?.text) {
      return {
        suggestedAction: 'upgrade',
        error: "No content in MCP response"
      };
    }

    console.log('[MCP] Text content:', textContent.text.substring(0, 200) + '...');

    // Parse the JSON string inside the text field
    try {
      const mcpData = JSON.parse(textContent.text);
      console.log('[MCP] Parsed MCP data:', JSON.stringify(mcpData, null, 2));

      const recommendedVersion = mcpData.recommendation?.recommended_version;
      const action = mcpData.recommendation?.action || 'upgrade';
      const fixInstructions = mcpData.fix_instructions || textContent.text;

      console.log('[MCP] ✓ Extracted recommended_version:', recommendedVersion);
      console.log('[MCP] ✓ Extracted action:', action);

      return {
        suggestedVersion: recommendedVersion,
        suggestedAction: this.mapMcpActionToSuggestedAction(action),
        fixInstructions: fixInstructions
      };
    } catch (parseError) {
      console.error('[MCP] Failed to parse MCP response JSON:', parseError);
      // Fallback to regex parsing
      return this.parseRecommendation(textContent.text, 'Oss');
    }
  }

  /**
   * Map MCP action to our SuggestedAction type
   */
  private mapMcpActionToSuggestedAction(mcpAction: string): McpSuggestedAction {
    switch (mcpAction) {
      case 'use_alternative_version':
      case 'update':
        return 'upgrade';
      case 'remove':
      case 'remove_dependency':
        return 'remove';
      case 'replace':
      case 'use_alternative':
        return 'replace';
      default:
        return 'upgrade';
    }
  }

  /**
   * Get MCP recommendation for code issues (Secrets, ASCA, IaC)
   */
  async getCodeRemediation(params: {
    type: string;
    subType: string;
    language?: string;
  }): Promise<McpRecommendation> {
    const response = await this.callMcpTool("codeRemediation", {
      type: params.type,
      sub_type: params.subType,
      language: params.language || ""
    });

    if (!response || response.error) {
      return {
        suggestedAction: 'externalize',
        error: response?.error?.message || "MCP call failed"
      };
    }

    // Extract text from response
    const textContent = response.result?.content?.find(c => c.type === 'text');
    if (!textContent?.text) {
      return {
        suggestedAction: 'externalize',
        error: "No content in MCP response"
      };
    }

    const scannerType: ScannerType = params.type === 'secret' ? 'Secrets' :
      params.type === 'asca' ? 'Asca' : 'IaC';
    return this.parseRecommendation(textContent.text, scannerType);
  }

  /**
   * Get MCP recommendation for container image vulnerabilities
   */
  async getImageRemediation(params: {
    imageName: string;
    imageTag: string;
  }): Promise<McpRecommendation> {
    const response = await this.callMcpTool("imageRemediation", {
      imageName: params.imageName,
      imageTag: params.imageTag
    });

    if (!response || response.error) {
      return {
        suggestedAction: 'upgrade',
        error: response?.error?.message || "MCP call failed"
      };
    }

    // Extract text from response
    const textContent = response.result?.content?.find(c => c.type === 'text');
    if (!textContent?.text) {
      return {
        suggestedAction: 'upgrade',
        error: "No content in MCP response"
      };
    }

    return this.parseRecommendation(textContent.text, 'Containers');
  }

  /**
   * Get MCP recommendation based on vulnerability type
   * Unified entry point for all scanner types
   */
  async getRecommendation(params: McpRecommendationParams): Promise<McpRecommendation> {
    switch (params.scannerType) {
      case 'Oss':
        if (!params.packageName || !params.packageVersion || !params.packageManager) {
          return { suggestedAction: 'upgrade', error: "Missing package information" };
        }
        return this.getPackageRemediation({
          packageName: params.packageName,
          packageVersion: params.packageVersion,
          packageManager: params.packageManager,
          issueType: params.issueType || 'CVE'
        });

      case 'Secrets':
        return this.getCodeRemediation({
          type: 'secret',
          subType: params.secretType || 'generic'
        });

      case 'Asca':
        return this.getCodeRemediation({
          type: 'asca',
          subType: params.ruleName || 'generic'
        });

      case 'IaC':
        return this.getCodeRemediation({
          type: 'iac',
          subType: params.ruleName || 'generic'
        });

      case 'Containers':
        if (!params.imageName || !params.imageTag) {
          return { suggestedAction: 'upgrade', error: "Missing container image information" };
        }
        return this.getImageRemediation({
          imageName: params.imageName,
          imageTag: params.imageTag
        });

      default:
        return { suggestedAction: 'upgrade', error: `Unknown scanner type: ${params.scannerType}` };
    }
  }
}

