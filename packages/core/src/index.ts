/**
 * Core shared library for Checkmarx VS Code extensions
 *
 * This package contains all shared functionality between:
 * - Checkmarx One (cloud-based scanning with authentication)
 * - Developer Assist (standalone realtime scanners)
 */

// Export activation functions
export { activateCore, setupCommonStatusBars, registerCommonCommands, getGlobalContext } from './activate/activateCore';
export { activateCxOne } from './activate/activateCxOne';
export { activateProjectIgnite } from './activate/activateProjectIgnite';

// Export configuration
export * from './config/extensionConfig';
export * from './config/extensionMessages';

// Export all shared modules
export * from './models/logs';
export * from './services/authService';
export * from './services/mcpSettingsInjector';
export * from './constants/documentation';
export * from './utils/common/constants';
export * from './utils/common/messages';
export { commands } from './utils/common/commandBuilder';
export * from './utils/common/featureFlags';
export * from './utils/listener/listeners';
export * from './utils/listener/workspaceListener';
export * from './utils/mediaPathResolver';
export { initialize, cx } from './cx';

// Export views
export * from './views/resultsView/astResultsProvider';
export * from './views/resultsView/astResultsPromoProvider';
export * from './views/scaView/scaResultsProvider';
export * from './views/dastView/dastResultsProvider';
export * from './views/cxOneAssistView/cxOneAssistProvider';
export * from './views/docsAndFeedbackView/docAndFeedbackView';
export * from './views/ignoredView/ignoredView';

// Export commands
export * from './commands/scanCommand';
export * from './commands/scanSCACommand';
export * from './commands/kicsRealtimeCommand';
export * from './commands/treeCommand';
export * from './commands/pickerCommand';
export * from './commands/commonCommand';
export * from './commands/groupByCommand';
export * from './commands/filterCommand';
export * from './commands/webViewCommand';
export * from './commands/openAIChatCommand';
export * from './commands/diagnosticCommand';

// Export realtime scanners
export * from './realtimeScanners/scanners/scannerRegistry';
export * from './realtimeScanners/configuration/configurationManager';
export * from './realtimeScanners/scanners/CxCodeActionProvider';
export * from './realtimeScanners/scanners/oss/ossScannerCommand';
export * from './realtimeScanners/scanners/secrets/secretsScannerCommand';
export * from './realtimeScanners/scanners/iac/iacScannerCommand';
export * from './realtimeScanners/scanners/asca/ascaScannerCommand';
export * from './realtimeScanners/scanners/containers/containersScannerCommand';
export * from './realtimeScanners/common/ignoreFileManager';

// Export KICS
export * from './kics/kicsRealtimeProvider';

