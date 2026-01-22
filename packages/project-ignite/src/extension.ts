/**
 * Checkmarx DevConnect Extension
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
import { activateCore, activateProjectIgnite, setExtensionConfig } from '@checkmarx/vscode-core';

export async function activate(context: vscode.ExtensionContext) {
    console.log('[PROJECT-IGNITE] Checkmarx DevConnect extension is now active');

    try {
        // Set extension configuration FIRST before any registrations
        setExtensionConfig({
            extensionId: 'project-ignite',
            commandPrefix: 'project-ignite',
            viewContainerPrefix: 'ignite',
            displayName: 'Checkmarx DevConnect',
            extensionType: 'project-ignite',
        });

        // [SHARED] Initialize core shared functionality
        // This includes: logs, auth, common status bars, proxy config
        const { logs } = await activateCore(context);

        // [PROJECT-IGNITE] Initialize DevConnect specific features
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

        console.log('[PROJECT-IGNITE] DevConnect extension activation complete');
    } catch (error) {
        console.error('[PROJECT-IGNITE] Failed to activate extension:', error);
        vscode.window.showErrorMessage(`Failed to activate DevConnect: ${error}`);
    }
}

export function deactivate() {
    console.log('[PROJECT-IGNITE] Checkmarx DevConnect extension is now deactivated');
}

