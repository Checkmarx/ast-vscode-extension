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
import { activateCore, activateCxOne, setExtensionConfig, EXTENSION_TYPE } from '@checkmarx/vscode-core';

export async function activate(context: vscode.ExtensionContext) {
    try {
        // Set extension configuration FIRST before any registrations
        setExtensionConfig({
            extensionId: 'ast-results',
            commandPrefix: 'ast-results',
            viewContainerPrefix: 'ast',
            displayName: 'Checkmarx',
            extensionType: EXTENSION_TYPE.CHECKMARX,
        });

        // Initialize shared core functionality (logs, auth, MCP, etc.)
        const { logs } = await activateCore(context);

        // Initialize Checkmarx One specific features
        await activateCxOne(context, logs);
    } catch (error) {
        vscode.window.showErrorMessage('Failed to activate Checkmarx One extension. See Checkmarx output for details.');
    }
}

export function deactivate() {
    // No explicit cleanup required at the moment
}

