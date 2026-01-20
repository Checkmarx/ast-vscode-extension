/**
 * Checkmarx One Extension
 *
 * Cloud-based security scanning with full Checkmarx One account integration
 *
 * [CHECKMARX-ONE] Features:
 * - AST Results Provider (cloud-based scanning results)
 * - Project/Branch/Scan Pickers (select from cloud projects)
 * - Triage Functionality (manage vulnerability states)
 * - SCA Scanning (Software Composition Analysis - cloud)
 * - Risk Management (vulnerability risk assessment)
 *
 * Requires: Authentication with API Key or login credentials
 */

import * as vscode from 'vscode';
import { activateCore, activateCxOne } from '@checkmarx/vscode-core';

export async function activate(context: vscode.ExtensionContext) {
    console.log('[CHECKMARX-ONE] Checkmarx One extension is now active');

    try {
        // [SHARED] Initialize core shared functionality
        // This includes: logs, auth, common status bars, proxy config
        const { logs } = await activateCore(context);

        // [CHECKMARX-ONE] Initialize Checkmarx One specific features
        // This includes:
        // - AST Results Provider
        // - SCA Results Provider
        // - Project/Branch/Scan pickers
        // - Triage commands
        // - Group by / Filter commands
        // - Risk Management
        await activateCxOne(context, logs);

        console.log('[CHECKMARX-ONE] Checkmarx One extension activation complete');
    } catch (error) {
        console.error('[CHECKMARX-ONE] Failed to activate extension:', error);
        vscode.window.showErrorMessage(`Failed to activate Checkmarx One: ${error}`);
    }
}

export function deactivate() {
    console.log('[CHECKMARX-ONE] Checkmarx One extension is now deactivated');
}

