/**
 * Checkmarx Project Ignite Extension
 *
 * Standalone realtime security scanners that work without cloud authentication
 *
 * [PROJECT-IGNITE] Features:
 * - ASCA (AI Secure Coding Assistant) - AI-powered code analysis
 * - OSS Realtime - Real-time open source scanning
 * - Secrets Detection - Real-time secrets scanning
 * - IaC Scanning - Infrastructure as Code scanning
 * - Containers Scanning - Container security scanning
 * - KICS Realtime - Real-time IaC scanning with KICS
 *
 * Can work standalone or with optional Checkmarx One Assist license
 */

import * as vscode from 'vscode';
import { activateCore, activateProjectIgnite } from '@checkmarx/vscode-core';

export async function activate(context: vscode.ExtensionContext) {
    console.log('[PROJECT-IGNITE] Checkmarx Project Ignite extension is now active');

    try {
        // [SHARED] Initialize core shared functionality
        // This includes: logs, auth, common status bars, proxy config
        const { logs } = await activateCore(context);

        // [PROJECT-IGNITE] Initialize Project Ignite specific features
        // This includes:
        // - ASCA Scanner (AI Secure Coding)
        // - OSS Realtime Scanner
        // - Secrets Scanner
        // - IaC Scanner
        // - Containers Scanner
        // - KICS Realtime
        // - Ignore file management
        // - Assist view
        await activateProjectIgnite(context, logs);

        console.log('[PROJECT-IGNITE] Project Ignite extension activation complete');
    } catch (error) {
        console.error('[PROJECT-IGNITE] Failed to activate extension:', error);
        vscode.window.showErrorMessage(`Failed to activate Project Ignite: ${error}`);
    }
}

export function deactivate() {
    console.log('[PROJECT-IGNITE] Checkmarx Project Ignite extension is now deactivated');
}

