/**
 * Dynamic Command Builder
 * Generates command names based on extension configuration
 */

import { getCommandPrefix } from '../../config/extensionConfig';

/**
 * Command name definitions (without prefix)
 */
const COMMAND_NAMES = {
    // Authentication
    showAuth: 'showAuth',
    authentication: 'authentication',

    // Checkmarx One Assist
    updateCxOneAssist: 'updateCxOneAssist',
    astCxOneAssist: 'astCxOneAssist',
    assistDocumentation: 'assistDocumentation',

    // Ignored View
    openIgnoredView: 'openIgnoredView',
    refreshIgnoredStatusBar: 'refreshIgnoredStatusBar',

    // AI Chat / Copilot
    fixWithAIChat: 'fixWithAIChat',
    viewDetails: 'viewDetails',
    openAIChat: 'openAIChat',

    // MCP
    installMCP: 'installMCP',

    // Settings
    viewSettings: 'viewSettings',

    // KICS
    clearKicsDiagnostics: 'clearKicsDiagnostics',
    kicsRealtime: 'kicsRealtime',
    kicsRemediation: 'kicsRemediation',

    // Scan Commands
    createScan: 'createScan',
    createSCAScan: 'createSCAScan',
    cancelScan: 'cancelScan',

    // Tree Commands
    refreshTree: 'refreshTree',
    clearTree: 'clearTree',
    refreshScaTree: 'refreshScaTree',
    clearScaTree: 'clearScaTree',
    refreshDastTree: 'refreshDastTree',
    clearDastTree: 'clearDastTree',

    // Details
    newDetails: 'newDetails',
    gpt: 'gpt',
    openDetailsFromDiagnostic: 'openDetailsFromDiagnostic',

    // Filters
    filterBySeverity: 'filterBySeverity',
    filterByState: 'filterByState',

    // Group By
    groupBy: 'groupBy',

    // Picker
    showPicker: 'showPicker',

    // Views
    docAndFeedback: 'docAndFeedback',
    dastResults: 'dastResults',
    astResultsPromo: 'astResultsPromo',
    scaAutoScanPromo: 'scaAutoScanPromo',

    // Status Bar
    refreshKicsStatusBar: 'refreshKicsStatusBar',
    refreshScaStatusBar: 'refreshScaStatusBar',
    refreshRiskManagementView: 'refreshRiskManagementView',

    // Context
    setContext: 'setContext',
    isDastEnabled: 'isDastEnabled',
    isValidCredentials: 'isValidCredentials',
    isCxOneAssistEnabled: 'isCxOneAssistEnabled',
    isStandaloneEnabled: 'isStandaloneEnabled',
    isScanEnabled: 'isScanEnabled',
    isScaScanEnabled: 'isScaScanEnabled',

    // Development/Testing
    mockTokenTest: 'mockTokenTest',
} as const;

/**
 * Dynamic command builder
 * Automatically prefixes commands with the extension's command prefix
 */
class CommandBuilder {
    /**
     * Build a command name with the current extension prefix
     */
    private buildCommand(commandName: string): string {
        const prefix = getCommandPrefix();
        return `${prefix}.${commandName}`;
    }

    // Authentication
    get showAuth(): string {
        return this.buildCommand(COMMAND_NAMES.showAuth);
    }

    get authentication(): string {
        return this.buildCommand(COMMAND_NAMES.authentication);
    }

    // Checkmarx One Assist
    get updateCxOneAssist(): string {
        return this.buildCommand(COMMAND_NAMES.updateCxOneAssist);
    }

    get astCxOneAssist(): string {
        return this.buildCommand(COMMAND_NAMES.astCxOneAssist);
    }

    get assistDocumentation(): string {
        return this.buildCommand(COMMAND_NAMES.assistDocumentation);
    }

    // Ignored View
    get openIgnoredView(): string {
        return this.buildCommand(COMMAND_NAMES.openIgnoredView);
    }

    get refreshIgnoredStatusBar(): string {
        return this.buildCommand(COMMAND_NAMES.refreshIgnoredStatusBar);
    }

    // AI Chat / Copilot
    get fixWithAIChat(): string {
        return this.buildCommand(COMMAND_NAMES.fixWithAIChat);
    }

    get viewDetails(): string {
        return this.buildCommand(COMMAND_NAMES.viewDetails);
    }

    get openAIChat(): string {
        return this.buildCommand(COMMAND_NAMES.openAIChat);
    }

    // MCP
    get installMCP(): string {
        return this.buildCommand(COMMAND_NAMES.installMCP);
    }

    // Settings
    get viewSettings(): string {
        return this.buildCommand(COMMAND_NAMES.viewSettings);
    }

    // KICS
    get clearKicsDiagnostics(): string {
        return this.buildCommand(COMMAND_NAMES.clearKicsDiagnostics);
    }

    get kicsRealtime(): string {
        return this.buildCommand(COMMAND_NAMES.kicsRealtime);
    }

    get kicsRemediation(): string {
        return this.buildCommand(COMMAND_NAMES.kicsRemediation);
    }

    // Scan Commands
    get createScan(): string {
        return this.buildCommand(COMMAND_NAMES.createScan);
    }

    get createSCAScan(): string {
        return this.buildCommand(COMMAND_NAMES.createSCAScan);
    }

    get cancelScan(): string {
        return this.buildCommand(COMMAND_NAMES.cancelScan);
    }

    // Tree Commands
    get refreshTree(): string {
        return this.buildCommand(COMMAND_NAMES.refreshTree);
    }

    get clearTree(): string {
        return this.buildCommand(COMMAND_NAMES.clearTree);
    }

    get refreshScaTree(): string {
        return this.buildCommand(COMMAND_NAMES.refreshScaTree);
    }

    get clearScaTree(): string {
        return this.buildCommand(COMMAND_NAMES.clearScaTree);
    }

    get refreshDastTree(): string {
        return this.buildCommand(COMMAND_NAMES.refreshDastTree);
    }

    get clearDastTree(): string {
        return this.buildCommand(COMMAND_NAMES.clearDastTree);
    }

    // Details
    get newDetails(): string {
        return this.buildCommand(COMMAND_NAMES.newDetails);
    }

    get gpt(): string {
        return this.buildCommand(COMMAND_NAMES.gpt);
    }

    get openDetailsFromDiagnostic(): string {
        return this.buildCommand(COMMAND_NAMES.openDetailsFromDiagnostic);
    }

    // Filters
    get filterBySeverity(): string {
        return this.buildCommand(COMMAND_NAMES.filterBySeverity);
    }

    get filterByState(): string {
        return this.buildCommand(COMMAND_NAMES.filterByState);
    }

    // Group By
    get groupBy(): string {
        return this.buildCommand(COMMAND_NAMES.groupBy);
    }

    // Picker
    get showPicker(): string {
        return this.buildCommand(COMMAND_NAMES.showPicker);
    }

    // Views
    get docAndFeedback(): string {
        return COMMAND_NAMES.docAndFeedback; // View ID, no prefix
    }

    get dastResults(): string {
        return this.buildCommand(COMMAND_NAMES.dastResults);
    }

    get astResultsPromo(): string {
        return COMMAND_NAMES.astResultsPromo; // View ID, no prefix
    }

    get scaAutoScanPromo(): string {
        return COMMAND_NAMES.scaAutoScanPromo; // View ID, no prefix
    }

    // Status Bar
    get refreshKicsStatusBar(): string {
        return this.buildCommand(COMMAND_NAMES.refreshKicsStatusBar);
    }

    get refreshScaStatusBar(): string {
        return this.buildCommand(COMMAND_NAMES.refreshScaStatusBar);
    }

    get refreshRiskManagementView(): string {
        return this.buildCommand(COMMAND_NAMES.refreshRiskManagementView);
    }

    // Context
    get setContext(): string {
        return 'setContext'; // VSCode built-in command, no prefix
    }

    get isDastEnabled(): string {
        return this.buildCommand(COMMAND_NAMES.isDastEnabled);
    }

    get isValidCredentials(): string {
        return this.buildCommand(COMMAND_NAMES.isValidCredentials);
    }

    get isCxOneAssistEnabled(): string {
        return this.buildCommand(COMMAND_NAMES.isCxOneAssistEnabled);
    }

    get isStandaloneEnabled(): string {
        return this.buildCommand(COMMAND_NAMES.isStandaloneEnabled);
    }

    get isScanEnabled(): string {
        return this.buildCommand(COMMAND_NAMES.isScanEnabled);
    }

    get isScaScanEnabled(): string {
        return this.buildCommand(COMMAND_NAMES.isScaScanEnabled);
    }

    // Development/Testing
    get mockTokenTest(): string {
        return this.buildCommand(COMMAND_NAMES.mockTokenTest);
    }
}

/**
 * Export singleton instance
 */
export const commands = new CommandBuilder();

