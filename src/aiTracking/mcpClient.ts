import * as vscode from "vscode";
import { jwtDecode } from "jwt-decode";
import { isIDE } from "../utils/utils";
import { constants } from "../utils/common/constants";
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
   * Make a direct HTTP call to the MCP server
   */
  private async callMcpTool(
    toolName: string,
    toolArguments: Record<string, unknown>
  ): Promise<McpToolResponse | null> {
    const baseUrl = await this.getMcpBaseUrl();
    if (!baseUrl) {
      console.error("MCP base URL not available");
      return null;
    }

    const apiKey = await this.context.secrets.get("authCredential");
    if (!apiKey) {
      console.error("API key not available for MCP call");
      return null;
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

      if (!response.ok) {
        console.error(`MCP call failed with status: ${response.status}`);
        return null;
      }

      const jsonResponse = await response.json() as McpToolResponse;
      return jsonResponse;
    } catch (error) {
      console.error("MCP call error:", error);
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
    const response = await this.callMcpTool("PackageRemediation", {
      packageName: params.packageName,
      packageVersion: params.packageVersion,
      packageManager: params.packageManager,
      issueType: params.issueType
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

    return this.parseRecommendation(textContent.text, 'Oss');
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

