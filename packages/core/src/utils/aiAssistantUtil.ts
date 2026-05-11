/**
 * AI Assistant utility for resolving custom assistant display names to extension config.
 */

import * as vscode from 'vscode';
import { constants } from './common/constants';
import { isIDE } from './utils';

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
