import * as vscode from 'vscode';
import {
  HoverData,
  SecretsHoverData,
  AscaHoverData,
  ContainersHoverData,
  IacHoverData
} from '../realtimeScanners/common/types';
import { cx } from '../cx';

/**
 * Agent name for all remediation requests
 */
const AGENT_NAME = 'Checkmarx One Assist';

/**
 * Scanner type enum
 */
export enum ScannerType {
  Oss = 'oss',
  Secrets = 'secrets',
  Asca = 'asca',
  Containers = 'containers',
  Iac = 'iac'
}

/**
 * Unified remediation request that works for all scanner types
 */
export interface UnifiedRemediationRequest {
  scannerType: ScannerType;
  hoverData: HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData;
  vulnerableCode?: string;
  language?: string;
  lineNumber?: number;
}

/**
 * Unified MCP Remediation Service for all realtime scanners
 * Supports: OSS, Secrets, ASCA, Containers, and IaC
 */
export class UnifiedRemediationService {

  /**
   * Get AI-generated remediation code for any scanner type
   */
  async getRemediationCode(request: UnifiedRemediationRequest): Promise<string | null> {
    try {
      // Check if Language Model API is available (VS Code 1.90+)
      if (!vscode.lm) {
        console.log('[UnifiedRemediationService] Language Model API not available');
        return null;
      }

      // Get the best available model
      const model = await this.selectBestModel();
      if (!model) {
        console.log('[UnifiedRemediationService] No suitable model found');
        return null;
      }

      console.log(`[UnifiedRemediationService] 🎯 Using agent: ${AGENT_NAME}`);
      console.log(`[UnifiedRemediationService] 🔍 Scanner type: ${request.scannerType}`);

      // Build scanner-specific prompt
      const prompt = this.buildPrompt(request);

      // Create messages for the chat
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      // Send request
      console.log(`[UnifiedRemediationService] 🤖 Sending request to ${AGENT_NAME} via ${model.vendor === 'checkmarx' ? 'Checkmarx MCP' : 'GitHub Copilot'}...`);
      console.log(`[UnifiedRemediationService] 📋 Prompt includes MCP tool usage instructions: ${prompt.includes('Remediation') || prompt.includes('MCP')}`);

      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      // Collect the response
      let fullResponse = '';
      for await (const chunk of response.text) {
        fullResponse += chunk;
      }

      // Extract code from response
      const suggestedCode = this.extractCodeFromResponse(fullResponse);

      if (suggestedCode) {
        console.log(`[UnifiedRemediationService] ✅ ${AGENT_NAME} generated ${suggestedCode.split('\n').length} lines of code`);
        console.log(`[UnifiedRemediationService] 🔍 Response mentions MCP tool: ${fullResponse.toLowerCase().includes('mcp') || fullResponse.toLowerCase().includes('remediation')}`);
      } else {
        console.log(`[UnifiedRemediationService] ⚠️ ${AGENT_NAME} returned empty response`);
      }

      return suggestedCode;

    } catch (error) {
      console.error(`[UnifiedRemediationService] ❌ Error getting ${AGENT_NAME} suggestion:`, error);
      return null;
    }
  }

  /**
   * Select the best available model (Checkmarx MCP or GitHub Copilot)
   */
  private async selectBestModel(): Promise<vscode.LanguageModelChat | null> {
    try {
      // Try to find Checkmarx MCP models first
      const checkmarxModels = await vscode.lm.selectChatModels({
        vendor: 'checkmarx'
      });

      if (checkmarxModels.length > 0) {
        console.log(`[UnifiedRemediationService] ✅ Found Checkmarx MCP models!`);
        console.log(`[UnifiedRemediationService] ✅ Using model: ${checkmarxModels[0].id} (${checkmarxModels[0].vendor}/${checkmarxModels[0].family})`);
        return checkmarxModels[0];
      }

      // Fallback to GitHub Copilot
      console.log('[UnifiedRemediationService] ⚠️ No Checkmarx MCP models found, falling back to GitHub Copilot');
      const copilotModels = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      });

      if (copilotModels.length > 0) {
        console.log(`[UnifiedRemediationService] ✅ Using GitHub Copilot model: ${copilotModels[0].family} (${copilotModels[0].id})`);
        return copilotModels[0];
      }

      return null;
    } catch (error) {
      console.error('[UnifiedRemediationService] ❌ Error selecting model:', error);
      return null;
    }
  }

  /**
   * Build scanner-specific prompt
   */
  private buildPrompt(request: UnifiedRemediationRequest): string {
    switch (request.scannerType) {
      case ScannerType.Oss:
        return this.buildOssPrompt(request.hoverData as HoverData);
      case ScannerType.Secrets:
        return this.buildSecretsPrompt(request.hoverData as SecretsHoverData, request.vulnerableCode, request.language);
      case ScannerType.Asca:
        return this.buildAscaPrompt(request.hoverData as AscaHoverData, request.vulnerableCode, request.language, request.lineNumber);
      case ScannerType.Containers:
        return this.buildContainersPrompt(request.hoverData as ContainersHoverData);
      case ScannerType.Iac:
        return this.buildIacPrompt(request.hoverData as IacHoverData, request.vulnerableCode, request.lineNumber);
      default:
        throw new Error(`Unknown scanner type: ${request.scannerType}`);
    }
  }

  /**
   * Build OSS (SCA) remediation prompt
   */
  private buildOssPrompt(hoverData: HoverData): string {
    const packageName = hoverData.packageName;
    const packageVersion = hoverData.version;
    const packageManager = hoverData.packageManager;
    const status = hoverData.status;

    return `You are the \`${AGENT_NAME}\`.

A security issue has been detected in \`${packageName}@${packageVersion}\` (package manager: \`${packageManager}\`).
**Severity:** \`${status}\`

**IMPORTANT: Use Checkmarx MCP Tools if Available**

If you have access to the Checkmarx MCP server tools, use the \`packageRemediation\` tool with these parameters:

\`\`\`json
{
  "packageName": "${packageName}",
  "version": "${packageVersion}",
  "packageManager": "${packageManager}",
  "severity": "${status}"
}
\`\`\`

If the MCP tool is available, use its response. Otherwise, provide remediation advice.

---

**Your Task:**
Provide clear remediation steps to fix this vulnerability:

1. **Recommended Version**: Suggest the safest version to upgrade to
2. **Breaking Changes**: List any breaking changes between current and recommended version
3. **Migration Steps**: Provide step-by-step migration instructions
4. **Alternative Packages**: If upgrade is not possible, suggest alternative packages

**Output Format:**
Provide a structured remediation plan with clear, actionable steps.`;
  }

  /**
   * Build Secrets remediation prompt
   */
  private buildSecretsPrompt(hoverData: SecretsHoverData, vulnerableCode?: string, language?: string): string {
    const title = hoverData.title || 'Secret';
    const description = hoverData.description;
    const severity = hoverData.severity;

    return `You are the \`${AGENT_NAME}\`.

A secret has been detected: "${title}"
${description}

**Severity:** \`${severity}\`

**IMPORTANT: Use Checkmarx MCP Tools if Available**

If you have access to the Checkmarx MCP server tools, use the \`codeRemediation\` tool with these parameters:

\`\`\`json
{
  "type": "secret",
  "sub_type": "${title}",
  "language": "${language || 'unknown'}",
  "code": "${vulnerableCode?.replace(/"/g, '\\"').replace(/\n/g, '\\n') || ''}"
}
\`\`\`

If the MCP tool is available, use its response. Otherwise, generate the fix yourself.

---

**Your Task:**
Generate ONLY the fixed/secure version of the code. Replace the secret with environment variable or secure vault reference.

**Critical Requirements:**
1. Output ONLY the corrected code - no explanations, no markdown formatting
2. Maintain the exact same indentation as the original code
3. Replace secret with environment variable (e.g., \`process.env.API_KEY\`, \`os.getenv('API_KEY')\`)
4. Do not add any prefix or suffix text
5. Output should be ready to paste directly into the file

${vulnerableCode ? `**Vulnerable Code:**
\`\`\`${language || ''}
${vulnerableCode}
\`\`\`` : ''}`;
  }

  /**
   * Build ASCA (SAST) remediation prompt
   */
  private buildAscaPrompt(hoverData: AscaHoverData, vulnerableCode?: string, language?: string, lineNumber?: number): string {
    const ruleName = hoverData.ruleName;
    const description = hoverData.description;
    const severity = hoverData.severity;
    const remediationAdvice = hoverData.remediationAdvise;

    return `You are the \`${AGENT_NAME}\`.

A security issue has been detected in the code.

**Rule:** \`${ruleName}\`
**Severity:** \`${severity}\`
**Description:** ${description}
**Remediation Advice:** ${remediationAdvice}
${lineNumber !== undefined ? `**Problematic Line:** ${lineNumber + 1}` : ''}

**IMPORTANT: Use Checkmarx MCP Tools if Available**

If you have access to the Checkmarx MCP server tools, use the \`codeRemediation\` tool with these parameters:

\`\`\`json
{
  "language": "${language || 'unknown'}",
  "metadata": {
    "ruleID": "${ruleName}",
    "description": "${description}",
    "remediationAdvice": "${remediationAdvice}"
  },
  "sub_type": "",
  "type": "sast",
  "code": "${vulnerableCode?.replace(/"/g, '\\"').replace(/\n/g, '\\n') || ''}"
}
\`\`\`

If the MCP tool is available, use its response. Otherwise, generate the fix yourself.

---

**Your Task:**
Generate ONLY the fixed/secure version of the vulnerable code above. Apply the remediation advice exactly.

**Critical Requirements:**
1. Output ONLY the corrected code - no explanations, no markdown formatting, no comments
2. Maintain the exact same indentation as the original code
3. Keep the same variable names and code structure where possible
4. Apply the security fix as described in the remediation advice
5. Do not add any prefix text like "Here's the fix:" or suffix text
6. Do not wrap the code in markdown code blocks
7. Output should be ready to paste directly into the file

${vulnerableCode ? `**Vulnerable Code:**
\`\`\`${language || ''}
${vulnerableCode}
\`\`\`` : ''}`;
  }

  /**
   * Build Containers remediation prompt
   */
  private buildContainersPrompt(hoverData: ContainersHoverData): string {
    const imageName = hoverData.imageName;
    const imageTag = hoverData.imageTag;
    const severity = hoverData.status;
    const fileType = hoverData.fileType;

    return `You are the \`${AGENT_NAME}\`.

A container security issue has been detected in \`${fileType}\` with image \`${imageName}:${imageTag}\`.
**Severity:** \`${severity}\`

**IMPORTANT: Use Checkmarx MCP Tools if Available**

If you have access to the Checkmarx MCP server tools, use the \`imageRemediation\` tool with these parameters:

\`\`\`json
{
  "fileType": "${fileType}",
  "imageName": "${imageName}",
  "imageTag": "${imageTag}",
  "severity": "${severity}"
}
\`\`\`

If the MCP tool is available, use its response. Otherwise, provide remediation advice.

---

**Your Task:**
Provide clear remediation steps to fix this container vulnerability:

1. **Recommended Image Tag**: Suggest the safest image tag to use
2. **Security Best Practices**: List security improvements for the container configuration
3. **Migration Steps**: Provide step-by-step instructions to update the image
4. **Alternative Images**: If upgrade is not possible, suggest alternative base images

**Output Format:**
Provide a structured remediation plan with clear, actionable steps.`;
  }

  /**
   * Build IaC remediation prompt
   */
  private buildIacPrompt(hoverData: IacHoverData, vulnerableCode?: string, lineNumber?: number): string {
    const title = hoverData.title;
    const description = hoverData.description;
    const severity = hoverData.severity;
    const fileType = hoverData.fileType;
    const expectedValue = hoverData.expectedValue;
    const actualValue = hoverData.actualValue;

    return `You are the \`${AGENT_NAME}\`.

An Infrastructure as Code (IaC) security issue has been detected.

**Issue:** \`${title}\`
**Severity:** \`${severity}\`
**File Type:** \`${fileType}\`
**Description:** ${description}
**Expected Value:** ${expectedValue}
**Actual Value:** ${actualValue}
${lineNumber !== undefined ? `**Problematic Line Number:** ${lineNumber + 1}` : ''}

**IMPORTANT: Use Checkmarx MCP Tools if Available**

If you have access to the Checkmarx MCP server tools, use the \`codeRemediation\` tool with these parameters:

\`\`\`json
{
  "type": "iac",
  "sub_type": "${fileType}",
  "language": "${fileType}",
  "metadata": {
    "title": "${title}",
    "description": "${description}",
    "expectedValue": "${expectedValue}",
    "actualValue": "${actualValue}"
  },
  "code": "${vulnerableCode?.replace(/"/g, '\\"').replace(/\n/g, '\\n') || ''}"
}
\`\`\`

If the MCP tool is available, use its response. Otherwise, generate the fix yourself.

---

**Your Task:**
Generate ONLY the fixed/secure version of the IaC configuration. Apply the security best practices.

**Critical Requirements:**
1. Output ONLY the corrected code - no explanations, no markdown formatting
2. Maintain the exact same indentation and structure
3. Change the actual value to match the expected value
4. Apply IaC security best practices
5. Do not add any prefix or suffix text
6. Output should be ready to paste directly into the file

${vulnerableCode ? `**Vulnerable Code:**
\`\`\`${fileType}
${vulnerableCode}
\`\`\`` : ''}`;
  }

  /**
   * Extract code from response (remove markdown code blocks if present)
   */
  private extractCodeFromResponse(response: string): string | null {
    // Remove markdown code blocks if present
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = [...response.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      return matches[0][1].trim();
    }

    // If no code blocks, return the trimmed response
    const trimmed = response.trim();
    return trimmed || null;
  }

  /**
   * Check if Copilot or MCP is available
   */
  async isMcpAvailable(): Promise<boolean> {
    try {
      // First, check if Checkmarx MCP Server is enabled for this tenant
      console.log('[UnifiedRemediationService] 🔍 Checking if Checkmarx MCP Server is enabled for your tenant...');
      const mcpServerEnabled = await cx.isAiMcpServerEnabled();
      console.log(`[UnifiedRemediationService] ${mcpServerEnabled ? '✅' : '❌'} Checkmarx MCP Server enabled for tenant: ${mcpServerEnabled}`);

      // Check if Copilot is available via Language Model API
      if (vscode.lm) {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        if (models.length > 0) {
          console.log('[UnifiedRemediationService] ✅ GitHub Copilot is available');
          return true;
        }
      }

      // Fallback: check if Checkmarx MCP is available
      if (mcpServerEnabled) {
        console.log('[UnifiedRemediationService] ✅ Checkmarx MCP Server is enabled but models not registered with VS Code');
      } else {
        console.log('[UnifiedRemediationService] ❌ Checkmarx MCP Server is not enabled for your tenant');
      }
      return mcpServerEnabled;
    } catch (error) {
      console.error('[UnifiedRemediationService] ❌ Error checking availability:', error);
      return false;
    }
  }
}
