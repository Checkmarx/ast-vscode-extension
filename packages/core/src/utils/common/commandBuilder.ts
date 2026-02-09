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
    astCxDevAssist: 'astCxDevAssist',
    assistDocumentation: 'assistDocumentation',

    // Ignored View
    openIgnoredView: 'openIgnoredView',
    refreshIgnoredStatusBar: 'refreshIgnoredStatusBar',

    // AI Chat / Copilot
    fixWithAIChat: 'fixWithAIChat',
    viewDetails: 'viewDetails',
    openAIChat: 'openAIChat',
    ignorePackage: 'ignorePackage',
    ignoreAll: 'ignoreAll',

    // MCP
    installMCP: 'installMCP',

    // Settings
    viewSettings: 'viewSettings',

    // Errors
    showError: 'showError',

    // KICS
    clearKicsDiagnostics: 'clearKicsDiagnostics',
    kicsRealtime: 'kicsRealtime',
    kicsRemediation: 'kicsRemediation',
    kicsSetings: 'kicsSetings',

    // Scan Commands
    createScan: 'createScan',
    createSCAScan: 'createSCAScan',
    cancelScan: 'cancelScan',
    pollScan: 'pollScan',

    // Tree Commands
    refreshTree: 'refreshTree',
    clearTree: 'clearTree',
    refreshScaTree: 'refreshScaTree',
    clearScaTree: 'clearScaTree',
    refreshDastTree: 'refreshDastTree',
    clearDastTree: 'clearDastTree',
    clear: 'clear',
    clearSca: 'clearSca',
    clearDast: 'clearDast',

    // Details
    newDetails: 'newDetails',
    gpt: 'gpt',
    openDetailsFromDiagnostic: 'openDetailsFromDiagnostic',

    // Filters
    filterBySeverity: 'filterBySeverity',
    filterByState: 'filterByState',
    filterCriticalToggle: 'filterCriticalToggle',
    filterCriticalUntoggle: 'filterCriticalUntoggle',
    filterCritical: 'filterCritical',
    filterHighToggle: 'filterHighToggle',
    filterHighUntoggle: 'filterHighUntoggle',
    filterHigh: 'filterHigh',
    filterMediumToggle: 'filterMediumToggle',
    filterMediumUntoggle: 'filterMediumUntoggle',
    filterMedium: 'filterMedium',
    filterLowToggle: 'filterLowToggle',
    filterLowUntoggle: 'filterLowUntoggle',
    filterLow: 'filterLow',
    filterInfoToggle: 'filterInfoToggle',
    filterInfoUntoggle: 'filterInfoUntoggle',
    filterInfo: 'filterInfo',
    filterNotExploitable: 'filterNotExploitable',
    filterNotExploitableActive: 'filterNotExploitableActive',
    filterNotExploitableCommand: 'filterNotExploitableCommand',
    filterProposed: 'filterProposed',
    filterProposedActive: 'filterProposedActive',
    filterProposedCommand: 'filterProposedCommand',
    filterConfirmed: 'filterConfirmed',
    filterConfirmedActive: 'filterConfirmedActive',
    filterConfirmedCommand: 'filterConfirmedCommand',
    filterToVerify: 'filterToVerify',
    filterToVerifyActive: 'filterToVerifyActive',
    filterToVerifyCommand: 'filterToVerifyCommand',
    filterUrgent: 'filterUrgent',
    filterUrgentActive: 'filterUrgentActive',
    filterUrgentCommand: 'filterUrgentCommand',
    filterNotIgnored: 'filterNotIgnored',
    filterNotIgnoredActive: 'filterNotIgnoredActive',
    filterNotIgnoredCommand: 'filterNotIgnoredCommand',
    filterIgnored: 'filterIgnored',
    filterIgnoredActive: 'filterIgnoredActive',
    filterIgnoredCommand: 'filterIgnoredCommand',
    filterSCAHideDevTest: 'filterSCAHideDevTest',
    filterSCAHideDevTestActive: 'filterSCAHideDevTestActive',
    filterSCAHideDevTestCommand: 'filterSCAHideDevTestCommand',
    filterAllCustomStates: 'filterAllCustomStates',
    filterAllCustomStatesActive: 'filterAllCustomStatesActive',
    filterAllCustomStatesCommand: 'filterAllCustomStatesCommand',

    // Group By
    groupBy: 'groupBy',
    groupByFile: 'groupByFile',
    groupByFileActive: 'groupByFileActive',
    groupByFileCommand: 'groupByFileCommand',
    groupByLanguage: 'groupByLanguage',
    groupByLanguageActive: 'groupByLanguageActive',
    groupByLanguageCommand: 'groupByLanguageCommand',
    groupBySeverity: 'groupBySeverity',
    groupBySeverityActive: 'groupBySeverityActive',
    groupBySeverityCommand: 'groupBySeverityCommand',
    groupByStatus: 'groupByStatus',
    groupByStatusActive: 'groupByStatusActive',
    groupByStatusCommand: 'groupByStatusCommand',
    groupByState: 'groupByState',
    groupByStateActive: 'groupByStateActive',
    groupByStateCommand: 'groupByStateCommand',
    groupByQueryName: 'groupByQueryName',
    groupByQueryNameActive: 'groupByQueryNameActive',
    groupByQueryNameCommand: 'groupByQueryNameCommand',
    groupByDirectDependency: 'groupByDirectDependency',
    groupByDirectDependencyActive: 'groupByDirectDependencyActive',
    groupByDirectDependencyCommand: 'groupByDirectDependencyCommand',

    // Picker
    showPicker: 'showPicker',
    generalPick: 'generalPick',
    projectPick: 'projectPick',
    branchPick: 'branchPick',
    scanPick: 'scanPick',
    scanInput: 'scanInput',
    environmentPick: 'environmentPick',

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
    isCxDevAssistEnabled: 'isCxDevAssistEnabled',
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
        // View ID (not a command) - must match package.json view ID
        const prefix = getCommandPrefix();
        return `${prefix}.cxOneAssist`;
    }

    get astCxDevAssist(): string {
        // View ID (not a command) - must match package.json view ID
        const prefix = getCommandPrefix();
        return `${prefix}.cxDevAssist`;
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

    get ignorePackage(): string {
        return this.buildCommand(COMMAND_NAMES.ignorePackage);
    }

    get ignoreAll(): string {
        return this.buildCommand(COMMAND_NAMES.ignoreAll);
    }

    // MCP
    get installMCP(): string {
        return this.buildCommand(COMMAND_NAMES.installMCP);
    }

    // Settings
    get viewSettings(): string {
        return this.buildCommand(COMMAND_NAMES.viewSettings);
    }

    get setings(): string {
        return this.buildCommand(COMMAND_NAMES.viewSettings);
    }

    get openSettings(): string {
        return 'workbench.action.openSettings'; // VSCode built-in command
    }

    get openSettingsArgs(): string {
        return `@ext:checkmarx.${getCommandPrefix()}`;
    }

    // Errors
    get showError(): string {
        return this.buildCommand(COMMAND_NAMES.showError);
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

    get kicsSetings(): string {
        return this.buildCommand(COMMAND_NAMES.kicsSetings);
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

    get pollScan(): string {
        return this.buildCommand(COMMAND_NAMES.pollScan);
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

    get clear(): string {
        return this.buildCommand(COMMAND_NAMES.clear);
    }

    get clearSca(): string {
        return this.buildCommand(COMMAND_NAMES.clearSca);
    }

    get clearDast(): string {
        return this.buildCommand(COMMAND_NAMES.clearDast);
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

    get filterCriticalToggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterCriticalToggle);
    }

    get filterCriticalUntoggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterCriticalUntoggle);
    }

    get filterCritical(): string {
        return this.buildCommand(COMMAND_NAMES.filterCritical);
    }

    get filterHighToggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterHighToggle);
    }

    get filterHighUntoggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterHighUntoggle);
    }

    get filterHigh(): string {
        return this.buildCommand(COMMAND_NAMES.filterHigh);
    }

    get filterMediumToggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterMediumToggle);
    }

    get filterMediumUntoggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterMediumUntoggle);
    }

    get filterMedium(): string {
        return this.buildCommand(COMMAND_NAMES.filterMedium);
    }

    get filterLowToggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterLowToggle);
    }

    get filterLowUntoggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterLowUntoggle);
    }

    get filterLow(): string {
        return this.buildCommand(COMMAND_NAMES.filterLow);
    }

    get filterInfoToggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterInfoToggle);
    }

    get filterInfoUntoggle(): string {
        return this.buildCommand(COMMAND_NAMES.filterInfoUntoggle);
    }

    get filterInfo(): string {
        return this.buildCommand(COMMAND_NAMES.filterInfo);
    }

    get filterNotExploitable(): string {
        return this.buildCommand(COMMAND_NAMES.filterNotExploitable);
    }

    get filterNotExploitableActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterNotExploitableActive);
    }

    get filterNotExploitableCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterNotExploitableCommand);
    }

    get filterProposed(): string {
        return this.buildCommand(COMMAND_NAMES.filterProposed);
    }

    get filterProposedActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterProposedActive);
    }

    get filterProposedCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterProposedCommand);
    }

    get filterConfirmed(): string {
        return this.buildCommand(COMMAND_NAMES.filterConfirmed);
    }

    get filterConfirmedActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterConfirmedActive);
    }

    get filterConfirmedCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterConfirmedCommand);
    }

    get filterToVerify(): string {
        return this.buildCommand(COMMAND_NAMES.filterToVerify);
    }

    get filterToVerifyActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterToVerifyActive);
    }

    get filterToVerifyCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterToVerifyCommand);
    }

    get filterUrgent(): string {
        return this.buildCommand(COMMAND_NAMES.filterUrgent);
    }

    get filterUrgentActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterUrgentActive);
    }

    get filterUrgentCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterUrgentCommand);
    }

    get filterNotIgnored(): string {
        return this.buildCommand(COMMAND_NAMES.filterNotIgnored);
    }

    get filterNotIgnoredActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterNotIgnoredActive);
    }

    get filterNotIgnoredCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterNotIgnoredCommand);
    }

    get filterIgnored(): string {
        return this.buildCommand(COMMAND_NAMES.filterIgnored);
    }

    get filterIgnoredActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterIgnoredActive);
    }

    get filterIgnoredCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterIgnoredCommand);
    }

    get filterSCAHideDevTest(): string {
        return this.buildCommand(COMMAND_NAMES.filterSCAHideDevTest);
    }

    get filterSCAHideDevTestActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterSCAHideDevTestActive);
    }

    get filterSCAHideDevTestCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterSCAHideDevTestCommand);
    }

    get filterAllCustomStates(): string {
        return this.buildCommand(COMMAND_NAMES.filterAllCustomStates);
    }

    get filterAllCustomStatesActive(): string {
        return this.buildCommand(COMMAND_NAMES.filterAllCustomStatesActive);
    }

    get filterAllCustomStatesCommand(): string {
        return this.buildCommand(COMMAND_NAMES.filterAllCustomStatesCommand);
    }

    // Group By
    get groupBy(): string {
        return this.buildCommand(COMMAND_NAMES.groupBy);
    }

    get groupByFile(): string {
        return this.buildCommand(COMMAND_NAMES.groupByFile);
    }

    get groupByFileActive(): string {
        return this.buildCommand(COMMAND_NAMES.groupByFileActive);
    }

    get groupByFileCommand(): string {
        return this.buildCommand(COMMAND_NAMES.groupByFileCommand);
    }

    get groupByLanguage(): string {
        return this.buildCommand(COMMAND_NAMES.groupByLanguage);
    }

    get groupByLanguageActive(): string {
        return this.buildCommand(COMMAND_NAMES.groupByLanguageActive);
    }

    get groupByLanguageCommand(): string {
        return this.buildCommand(COMMAND_NAMES.groupByLanguageCommand);
    }

    get groupBySeverity(): string {
        return this.buildCommand(COMMAND_NAMES.groupBySeverity);
    }

    get groupBySeverityActive(): string {
        return this.buildCommand(COMMAND_NAMES.groupBySeverityActive);
    }

    get groupBySeverityCommand(): string {
        return this.buildCommand(COMMAND_NAMES.groupBySeverityCommand);
    }

    get groupByStatus(): string {
        return this.buildCommand(COMMAND_NAMES.groupByStatus);
    }

    get groupByStatusActive(): string {
        return this.buildCommand(COMMAND_NAMES.groupByStatusActive);
    }

    get groupByStatusCommand(): string {
        return this.buildCommand(COMMAND_NAMES.groupByStatusCommand);
    }

    get groupByState(): string {
        return this.buildCommand(COMMAND_NAMES.groupByState);
    }

    get groupByStateActive(): string {
        return this.buildCommand(COMMAND_NAMES.groupByStateActive);
    }

    get groupByStateCommand(): string {
        return this.buildCommand(COMMAND_NAMES.groupByStateCommand);
    }

    get groupByQueryName(): string {
        return this.buildCommand(COMMAND_NAMES.groupByQueryName);
    }

    get groupByQueryNameActive(): string {
        return this.buildCommand(COMMAND_NAMES.groupByQueryNameActive);
    }

    get groupByQueryNameCommand(): string {
        return this.buildCommand(COMMAND_NAMES.groupByQueryNameCommand);
    }

    get groupByDirectDependency(): string {
        return this.buildCommand(COMMAND_NAMES.groupByDirectDependency);
    }

    get groupByDirectDependencyActive(): string {
        return this.buildCommand(COMMAND_NAMES.groupByDirectDependencyActive);
    }

    get groupByDirectDependencyCommand(): string {
        return this.buildCommand(COMMAND_NAMES.groupByDirectDependencyCommand);
    }

    // Picker
    get showPicker(): string {
        return this.buildCommand(COMMAND_NAMES.showPicker);
    }

    get generalPick(): string {
        return this.buildCommand(COMMAND_NAMES.generalPick);
    }

    get projectPick(): string {
        return this.buildCommand(COMMAND_NAMES.projectPick);
    }

    get branchPick(): string {
        return this.buildCommand(COMMAND_NAMES.branchPick);
    }

    get scanPick(): string {
        return this.buildCommand(COMMAND_NAMES.scanPick);
    }

    get scanInput(): string {
        return this.buildCommand(COMMAND_NAMES.scanInput);
    }

    get environmentPick(): string {
        return this.buildCommand(COMMAND_NAMES.environmentPick);
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

    get isCxDevAssistEnabled(): string {
        return this.buildCommand(COMMAND_NAMES.isCxDevAssistEnabled);
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

