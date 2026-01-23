/**
 * Checkmarx Developer Assist Extension
 *
 * Standalone realtime security scanners that work without cloud authentication
 *
 * [CHECKMARX-DEVELOPER-ASSIST] Features:
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
import { activateCore, activateProjectIgnite, setExtensionConfig, EXTENSION_TYPE } from '@checkmarx/vscode-core';

export async function activate(context: vscode.ExtensionContext) {
    console.log('[CHECKMARX-DEVELOPER-ASSIST] Checkmarx Developer Assist extension is now active');

    try {
        // Set extension configuration FIRST before any registrations
        setExtensionConfig({
            extensionId: 'cx-dev-assist',
            commandPrefix: 'cx-dev-assist',
            viewContainerPrefix: 'ignite',
            displayName: 'Checkmarx Developer Assist',
            extensionType: EXTENSION_TYPE.DEVELOPER_ASSIST,
        });

        // [SHARED] Initialize core shared functionality
        // This includes: logs, auth, common status bars, proxy config
        const { logs } = await activateCore(context);

        // [CHECKMARX-DEVELOPER-ASSIST] Initialize Checkmarx Developer Assist specific features
        // This includes:
        // - ASCA Scanner (AI Secure Coding)
        // - OSS Realtime Scanner
        // - Secrets Scanner
        // - IaC Scanner
        // - Containers Scanner
        // - Ignore file management
        // - Assist view
        await activateProjectIgnite(context, logs);

        console.log('[CHECKMARX-DEVELOPER-ASSIST] Checkmarx Developer Assist extension activation complete');
    } catch (error) {
        console.error('[CHECKMARX-DEVELOPER-ASSIST] Failed to activate extension:', error);
        vscode.window.showErrorMessage(`Failed to activate Checkmarx Developer Assist: ${error}`);
    }
}

export function deactivate() {
    console.log('[CHECKMARX-DEVELOPER-ASSIST] Checkmarx Developer Assist extension is now deactivated');
}

