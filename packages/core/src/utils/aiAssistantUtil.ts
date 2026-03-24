/**
 * AI Assistant utility for resolving custom assistant display names to extension config.
 */

import * as vscode from 'vscode';
import { constants } from './common/constants';

export interface AiAssistantConfig {
  extensionId: string;
}

/**
 * Returns true if any supported AI extension (Copilot, Gemini, or Claude) is installed.
 */
export function hasAnySupportedAiExtension(): boolean {
  return (
    vscode.extensions.getExtension(constants.copilotChatExtensionId) !== undefined ||
    vscode.extensions.getExtension(constants.geminiChatExtensionId) !== undefined ||
    vscode.extensions.getExtension(constants.claudeChatExtensionId) !== undefined
  );
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
