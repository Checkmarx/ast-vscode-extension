import * as vscode from 'vscode';
import { cx } from '../cx';

const AGENT_NAME = 'Checkmarx One Assist';

interface McpRemediationRequest {
  language: string;
  filePath: string;
  lineNumber: number;
  ruleName: string;
  severity: string;
  description: string;
  remediationAdvice: string;
  vulnerableCode: string;
}

/**
 * Service to get AI-generated code remediation suggestions using GitHub Copilot
 */
export class McpRemediationService {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get AI-generated remediation code using GitHub Copilot Language Model API
   */
  async getRemediationCode(request: McpRemediationRequest): Promise<string | null> {
    try {
      // Check if Language Model API is available (VS Code 1.90+)
      if (!vscode.lm) {
        console.log('Language Model API not available');
        return null;
      }

      // DEBUG: Check all available models
      const allModels = await vscode.lm.selectChatModels();
      console.log('[McpRemediationService] 🔍 All available models:',
        allModels.map(m => `${m.vendor}/${m.family} (${m.id})`).join(', '));

      // Try to find Checkmarx MCP models first
      const checkmarxModels = await vscode.lm.selectChatModels({
        vendor: 'checkmarx'
      });

      let models: vscode.LanguageModelChat[];
      if (checkmarxModels.length > 0) {
        console.log('[McpRemediationService] ✅ Found Checkmarx MCP models!');
        models = checkmarxModels;
      } else {
        console.log('[McpRemediationService] ⚠️ No Checkmarx MCP models found, falling back to GitHub Copilot');
        // Fallback to Copilot
        models = await vscode.lm.selectChatModels({
          vendor: 'copilot',
          family: 'gpt-4o'
        });
      }

      if (models.length === 0) {
        console.log('[McpRemediationService] ❌ No AI models available (neither Checkmarx MCP nor Copilot)');
        return null;
      }

      const model = models[0];
      console.log(`[McpRemediationService] ✅ Using GitHub Copilot model: ${model.id} (${model.vendor}/${model.family})`);
      console.log(`[McpRemediationService] 🎯 Using agent: ${AGENT_NAME}`);

      // Build the prompt for code remediation
      const prompt = this.buildRemediationPrompt(request);

      // Create messages for the chat
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      // Send request to Copilot with Checkmarx agent
      console.log(`[McpRemediationService] 🤖 Sending request to ${AGENT_NAME} via GitHub Copilot for ${request.ruleName}...`);
      console.log(`[McpRemediationService] 📋 Prompt includes MCP tool usage instructions: ${prompt.includes('codeRemediation')}`);
      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      // Collect the response
      let fullResponse = '';
      for await (const chunk of response.text) {
        fullResponse += chunk;
      }

      // Extract code from response
      const suggestedCode = this.extractCodeFromResponse(fullResponse);

      if (suggestedCode) {
        console.log(`[McpRemediationService] ✅ ${AGENT_NAME} generated ${suggestedCode.split('\n').length} lines of code`);
        console.log(`[McpRemediationService] 🔍 Response mentions MCP tool: ${fullResponse.toLowerCase().includes('mcp') || fullResponse.toLowerCase().includes('coderemediation')}`);
      } else {
        console.log(`[McpRemediationService] ⚠️ ${AGENT_NAME} returned empty response`);
      }

      return suggestedCode;

    } catch (error) {
      console.error(`[McpRemediationService] ❌ Error getting ${AGENT_NAME} suggestion via GitHub Copilot:`, error);
      return null;
    }
  }

  /**
   * Build prompt for Copilot to generate remediation code using Checkmarx agent
   */
  private buildRemediationPrompt(request: McpRemediationRequest): string {
    return `You are the \`${AGENT_NAME}\`.

A security issue has been detected in the code.

**Rule:** \`${request.ruleName}\`
**Severity:** \`${request.severity}\`
**Description:** ${request.description}
**Remediation Advice:** ${request.remediationAdvice}
**Problematic Line:** ${request.lineNumber}

**Vulnerable Code:**
\`\`\`${request.language}
${request.vulnerableCode}
\`\`\`

---

**IMPORTANT: Use Checkmarx MCP Tools if Available**

If you have access to the Checkmarx MCP server tools, use the \`codeRemediation\` tool with these parameters:

\`\`\`json
{
  "language": "${request.language}",
  "metadata": {
    "ruleID": "${request.ruleName}",
    "description": "${request.description}",
    "remediationAdvice": "${request.remediationAdvice}"
  },
  "sub_type": "",
  "type": "sast",
  "code": "${request.vulnerableCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
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

**Example:**
If the vulnerable code is:
\`\`\`python
password = "hardcoded-secret"
\`\`\`

And the advice is "Use environment variables", output ONLY:
password = os.getenv('PASSWORD')

Nothing else. Just the fixed code.`;
  }

  /**
   * Extract code from Copilot response
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
      console.log('[McpRemediationService] 🔍 Checking if Checkmarx MCP Server is enabled for your tenant...');
      const mcpServerEnabled = await cx.isAiMcpServerEnabled();
      console.log(`[McpRemediationService] ${mcpServerEnabled ? '✅' : '❌'} Checkmarx MCP Server enabled for tenant: ${mcpServerEnabled}`);

      // Check if Copilot is available via Language Model API
      if (vscode.lm) {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        if (models.length > 0) {
          console.log('[McpRemediationService] ✅ GitHub Copilot is available');
          return true;
        }
      }

      // Fallback: check if Checkmarx MCP is available
      if (mcpServerEnabled) {
        console.log('[McpRemediationService] ✅ Checkmarx MCP Server is enabled but models not registered with VS Code');
      } else {
        console.log('[McpRemediationService] ❌ Checkmarx MCP Server is not enabled for your tenant');
      }
      return mcpServerEnabled;
    } catch (error) {
      console.error('[McpRemediationService] ❌ Error checking availability:', error);
      return false;
    }
  }
}

