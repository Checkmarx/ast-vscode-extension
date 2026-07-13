/**
 * AI Assistant utility for resolving custom assistant display names to extension config.
 */

import * as vscode from 'vscode';
import { constants } from './common/constants';
import { isIDE } from './utils';
import { getExtensionType, EXTENSION_TYPE } from '../config/extensionConfig';

export interface AiAssistantConfig {
  extensionId: string;
}

export type McpTarget = 'vscode-settings' | 'ide-native-json' | 'claude-settings';

/**
 * Returns true if the GitHub Copilot Chat extension is installed.
 */
export function isCopilotInstalled(): boolean {
  return vscode.extensions.getExtension(constants.copilotChatExtensionId) !== undefined;
}

/**
 * Returns true if the Claude Code extension is installed.
 */
export function isClaudeInstalled(): boolean {
  return vscode.extensions.getExtension(constants.claudeChatExtensionId) !== undefined;
}

/**
 * Returns true if any supported AI extension (Copilot, Gemini, or Claude) is installed.
 */
export function hasAnySupportedAiExtension(): boolean {
  return (
    isCopilotInstalled() ||
    vscode.extensions.getExtension(constants.geminiChatExtensionId) !== undefined ||
    isClaudeInstalled()
  );
}

/**
 * Resolves which MCP config targets to write for the current IDE and settings.
 * Drives both the post-login auto-install path and the manual "Install MCP" command.
 */
export function resolveMcpTargets(): McpTarget[] {
  if (isIDE(constants.claudeAgent)) {
    return ['claude-settings'];
  }

  const isVsCode = isIDE(constants.vsCodeAgentOrginalName);
  const isNonVsCodeIde =
    !isVsCode &&
    (isIDE(constants.cursorAgent) ||
      isIDE(constants.windsurfAgent) ||
      isIDE(constants.windsurfNextAgent) ||
      isIDE(constants.devinAgent) ||
      isIDE(constants.devinNextAgent) ||
      isIDE(constants.kiroAgent));

  if (isNonVsCodeIde) {
    const cfg = vscode.workspace.getConfiguration(constants.getAiAssistantConfigSection());
    const preferNative = cfg.get<boolean>('Prefer Native AI Assistant', true);
    const targets: McpTarget[] = [];
    if (preferNative || isCopilotInstalled()) {
      targets.push('ide-native-json');
    }
    if (isClaudeInstalled()) {
      targets.push('claude-settings');
    }
    return targets;
  }

  const targets: McpTarget[] = [];
  if (isCopilotInstalled()) {
    targets.push('vscode-settings');
  }
  if (isClaudeInstalled()) {
    targets.push('claude-settings');
  }
  return targets;
}

/**
 * Returns the config for the given assistant choice (e.g. custom name).
 * Returns undefined if the choice is not a known custom mapping.
 * Copilot, Gemini, and Claude are handled by the caller via constants.
 */
export function getSelectedConfigFor(assistantName: string): AiAssistantConfig | undefined {
  const name = assistantName.trim();
  if (!name) return undefined;
  switch (name) {
    case 'Copilot':
      return { extensionId: constants.copilotChatExtensionId };
    case 'Gemini':
      return { extensionId: constants.geminiChatExtensionId };
    case 'Claude':
      return { extensionId: constants.claudeChatExtensionId };
    default:
      // Custom or unknown assistant name – no built-in extension ID
      return undefined;
  }
}

/**
 * Generates MCP OAuth setup banner message for welcome page.
 * Shows IDE-specific authentication instructions based on MCP targets.
 * Returns null if OAuth was not selected in MCP Authentication setting.
 * Works for both Checkmarx and Project-Ignite extensions.
 */
export function getMcpOAuthSetupMessage(context?: vscode.ExtensionContext): string | null {
  if (!context) return null;

  try {
    // Check the CURRENT MCP Authentication setting for the running extension
    // (Not the flag, which is set AFTER MCP configuration completes)
    const configSection = constants.getAiAssistantConfigSection();
    let mcpAuthSetting = vscode.workspace.getConfiguration(configSection)
      .get<string>('MCP Authentication');

    // Validate authMode - handle stale/invalid values
    // For Checkmarx: valid values are ["OAuth", "Token Based"]
    // For Project-Ignite: valid values are ["Token Based"]
    const extensionType = getExtensionType();
    const validAuthModes = extensionType === EXTENSION_TYPE.DEVELOPER_ASSIST
      ? ['Token Based']
      : ['OAuth', 'Token Based'];

    if (!validAuthModes.includes(mcpAuthSetting)) {
      const defaultAuthMode = extensionType === EXTENSION_TYPE.DEVELOPER_ASSIST ? 'Token Based' : 'OAuth';
      mcpAuthSetting = defaultAuthMode;
    }

    if (mcpAuthSetting !== 'OAuth') return null;

    const targets = resolveMcpTargets();
    if (!Array.isArray(targets) || targets.length === 0) return null;

    // Determine AI Agent name to display
    let aiAgentName: string | null = null;

    const isVsCode = isIDE(constants.vsCodeAgentOrginalName);
    const isNonVsCodeIde =
      isIDE(constants.cursorAgent) ||
      isIDE(constants.devinAgent) ||
      isIDE(constants.devinNextAgent) ||
      isIDE(constants.kiroAgent) ||
      isIDE(constants.windsurfAgent) ||
      isIDE(constants.windsurfNextAgent);

    const cfg = vscode.workspace.getConfiguration(constants.getAiAssistantConfigSection());
    const aiAssistantSelection = cfg.get<string>('AI Assistant');
    const preferNative = cfg.get<boolean>('Prefer Native AI Assistant', true);

    // For VSCode: use AI Assistant dropdown
    if (isVsCode) {
      aiAgentName = aiAssistantSelection === 'Claude' ? 'Claude Code' : aiAssistantSelection;
    }
    // For Non-VSCode IDE
    else if (isNonVsCodeIde) {
      if (preferNative) {
        // Use IDE name
        if (isIDE(constants.devinNextAgent)) {
          aiAgentName = 'Devin - Next';
        } else if (isIDE(constants.devinAgent)) {
          aiAgentName = 'Devin';
        } else if (isIDE(constants.cursorAgent)) {
          aiAgentName = 'Cursor';
        } else if (isIDE(constants.kiroAgent)) {
          aiAgentName = 'Kiro';
        } else if (isIDE(constants.windsurfNextAgent)) {
          aiAgentName = 'Windsurf - Next';
        } else if (isIDE(constants.windsurfAgent)) {
          aiAgentName = 'Windsurf';
        }
      } else {
        // Use AI Assistant dropdown
        aiAgentName = aiAssistantSelection === 'Claude' ? 'Claude Code' : aiAssistantSelection;
      }
    }

    if (!aiAgentName) return null;

    // Create single message line
    const messages: string[] = [];
    messages.push(
      `<div class='welcome-banner-row'>Proceed to MCP Authentication from ${aiAgentName} settings.</div>`
    );

    const contentRows = messages.join('');

    return `
      <div class="welcome-banner welcome-banner-info" role="status">
        <span class="welcome-banner-icon welcome-banner-icon-circle welcome-banner-icon-info">i</span>
        <div class="welcome-banner-body">
          ${contentRows}
        </div>
      </div>`;
  } catch (error) {
    console.error('Error generating MCP setup message:', error);
    return null;
  }
}
