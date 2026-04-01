/**
 * Core Activation Logic
 * [SHARED] Used by both Checkmarx One and Checkmarx Developer Assist extensions
 */

import * as vscode from 'vscode';
import { Logs } from '../models/logs';
import { AuthService } from '../services/authService';
import { initialize } from '../cx';
import { constants } from '../utils/common/constants';
import { messages } from '../utils/common/messages';
import { registerMcpSettingsInjector } from '../services/mcpSettingsInjector';

// Global context for the extension
let globalContext: vscode.ExtensionContext;

/**
 * Get the global extension context
 */
export function getGlobalContext(): vscode.ExtensionContext {
    return globalContext;
}

/**
 * Activate core functionality shared by all extensions
 * This includes:
 * - Logging service
 * - Authentication service
 * - Common status bars
 * - Proxy configuration
 * - Common utilities
 */
export async function activateCore(context: vscode.ExtensionContext) {
    console.log('[CORE] Activating core functionality...');

    // [SHARED] Store global context
    globalContext = context;

    // [SHARED] Initialize cx first
    initialize(context);

    // [SHARED] Create logs channel and make it visible
    const output = vscode.window.createOutputChannel(constants.extensionFullName);
    const logs = new Logs(output);
    logs.info(messages.pluginRunning);

    // [SHARED] Integrity check on startup
    const authService = AuthService.getInstance(context, logs);
    await authService.validateAndUpdateState();

    // [SHARED] Register MCP settings injector
    registerMcpSettingsInjector(context);

    console.log('[CORE] Core activation complete');

    return { logs, authService };
}

/**
 * Setup common status bars used by both extensions
 * [SHARED]
 */
export async function setupCommonStatusBars(context: vscode.ExtensionContext, logs: Logs) {
    // [SHARED] Status bar items that both extensions might use
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    const ignoredStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);

    return { statusBarItem, ignoredStatusBarItem };
}

/**
 * Register common commands shared by both extensions
 * [SHARED]
 */
export function registerCommonCommands(context: vscode.ExtensionContext, logs: Logs) {
    // [SHARED] Common hover provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            { scheme: "file" },
            {
                provideHover() {
                    return undefined;
                }
            }
        )
    );
}

