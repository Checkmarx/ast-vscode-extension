import { constants } from "./constants";

export const commands = {
  refreshTree: `${constants.extensionName}.refreshTree`,
  clear: `${constants.extensionName}.clear`,

  showError: `${constants.extensionName}.showError`,

  setings: `${constants.extensionName}.viewSettings`,
  isValidCredentials: `${constants.extensionName}.isValidCredentials`,

  authentication: `${constants.extensionName}.authentication`,
  showAuth: `${constants.extensionName}.showAuth`,

  isScanEnabled: `${constants.extensionName}.isScanEnabled`,
  isScaScanEnabled: `${constants.extensionName}.isSCAScanEnabled`,
  isStandaloneEnabled: `${constants.extensionName}.isStandaloneEnabled`,
  isCxOneAssistEnabled: `${constants.extensionName}.isCxOneAssistEnabled`,
  filterCriticalToggle: `${constants.extensionName}.filterCritical_toggle`,
  filterCriticalUntoggle: `${constants.extensionName}.filterCritical_untoggle`,
  filterCritical: `${constants.extensionName}.filterCritical`,

  filterHighToggle: `${constants.extensionName}.filterHigh_toggle`,
  filterHighUntoggle: `${constants.extensionName}.filterHigh_untoggle`,
  filterHigh: `${constants.extensionName}.filterHigh`,

  filterMediumToggle: `${constants.extensionName}.filterMedium_toggle`,
  filterMediumUntoggle: `${constants.extensionName}.filterMedium_untoggle`,
  filterMedium: `${constants.extensionName}.filterMedium`,

  filterLowToggle: `${constants.extensionName}.filterLow_toggle`,
  filterLowUntoggle: `${constants.extensionName}.filterLow_untoggle`,
  filterLow: `${constants.extensionName}.filterLow`,

  filterInfoToggle: `${constants.extensionName}.filterInfo_toggle`,
  filterInfoUntoggle: `${constants.extensionName}.filterInfo_untoggle`,
  filterInfo: `${constants.extensionName}.filterInfo`,

  filterNotExploitable: `${constants.extensionName}.filterNotExploitable`,
  filterNotExploitableActive: `${constants.extensionName}.filterNotExploitableActive`,
  filterNotExploitableCommand: `${constants.extensionName}.filterNotExploitables`,

  filterProposed: `${constants.extensionName}.filterProposed`,
  filterProposedActive: `${constants.extensionName}.filterProposedActive`,
  filterProposedCommand: `${constants.extensionName}.filterProposeds`,

  filterConfirmed: `${constants.extensionName}.filterConfirmed`,
  filterConfirmedActive: `${constants.extensionName}.filterConfirmedActive`,
  filterConfirmedCommand: `${constants.extensionName}.filterConfirmeds`,

  filterToVerify: `${constants.extensionName}.filterToVerify`,
  filterToVerifyActive: `${constants.extensionName}.filterToVerifyActive`,
  filterToVerifyCommand: `${constants.extensionName}.filterToVerifies`,

  filterUrgent: `${constants.extensionName}.filterUrgent`,
  filterUrgentActive: `${constants.extensionName}.filterUrgentActive`,
  filterUrgentCommand: `${constants.extensionName}.filterUrgents`,

  filterNotIgnored: `${constants.extensionName}.filterNotIgnored`,
  filterNotIgnoredActive: `${constants.extensionName}.filterNotIgnoredActive`,
  filterNotIgnoredCommand: `${constants.extensionName}.filterNotIgnoreds`,

  filterIgnored: `${constants.extensionName}.filterIgnored`,
  filterIgnoredActive: `${constants.extensionName}.filterIgnoredActive`,
  filterIgnoredCommand: `${constants.extensionName}.filterIgnoreds`,

  filterSCAHideDevTest: `${constants.extensionName}.filterSCAHideDevTest`,
  filterSCAHideDevTestActive: `${constants.extensionName}.filterSCAHideDevTestActive`,
  filterSCAHideDevTestCommand: `${constants.extensionName}.filterSCAHideDevTests`,

  filterAllCustomStates: `${constants.extensionName}.filterAllCustomStates`,
  filterAllCustomStatesActive: `${constants.extensionName}.filterAllCustomStatesActive`,
  filterAllCustomStatesCommand: `${constants.extensionName}.filterAllCustomStatess`,

  groupByFile: `${constants.extensionName}.groupByFile`,
  groupByFileActive: `${constants.extensionName}.groupByFileActive`,
  groupByFileCommand: `${constants.extensionName}.groupByFiles`,

  groupByLanguage: `${constants.extensionName}.groupByLanguage`,
  groupByLanguageActive: `${constants.extensionName}.groupByLanguageActive`,
  groupByLanguageCommand: `${constants.extensionName}.groupByLanguages`,

  groupBySeverity: `${constants.extensionName}.groupBySeverity`,
  groupBySeverityActive: `${constants.extensionName}.groupBySeverityActive`,
  groupBySeverityCommand: `${constants.extensionName}.groupBySeverities`,

  groupByStatus: `${constants.extensionName}.groupByStatus`,
  groupByStatusActive: `${constants.extensionName}.groupByStatusActive`,
  groupByStatusCommand: `${constants.extensionName}.groupByStatuses`,

  groupByState: `${constants.extensionName}.groupByState`,
  groupByStateActive: `${constants.extensionName}.groupByStateActive`,
  groupByStateCommand: `${constants.extensionName}.groupByStates`,

  groupByQueryName: `${constants.extensionName}.groupByQueryName`,
  groupByQueryNameActive: `${constants.extensionName}.groupByQueryNameActive`,
  groupByQueryNameCommand: `${constants.extensionName}.groupByQueryNames`,

  groupByDirectDependency: `${constants.extensionName}.groupByDirectDependency`,
  groupByDirectDependencyActive: `${constants.extensionName}.groupByDirectDependencyActive`,
  groupByDirectDependencyCommand: `${constants.extensionName}.groupByDirectDependencies`,

  createScan: `${constants.extensionName}.createScan`,
  cancelScan: `${constants.extensionName}.cancelScan`,
  pollScan: `${constants.extensionName}.pollForScan`,

  kicsRemediation: `${constants.extensionName}.kicsRemediation`,
  kicsRealtime: `${constants.extensionName}.kicsRealtime`,
  kicsSetings: `${constants.extensionName}.viewKicsSaveSettings`,

  generalPick: `${constants.extensionName}.generalPick`,
  projectPick: `${constants.extensionName}.projectPick`,
  branchPick: `${constants.extensionName}.branchPick`,
  scanPick: `${constants.extensionName}.scanPick`,
  scanInput: `${constants.extensionName}.scanInput`,

  createScaScan: `${constants.extensionName}.createSCAScan`,
  refreshScaTree: `${constants.extensionName}.refreshSCATree`,
  clearSca: `${constants.extensionName}.clearSca`,

  newDetails: `${constants.extensionName}.newDetails`,
  gpt: `${constants.extensionName}.gpt`,
  openDetailsFromDiagnostic: `${constants.extensionName}.openDetailsFromDiagnostic`,

  setContext: "setContext",

  openSettings: "workbench.action.openSettings",
  openSettingsArgs: `@ext:checkmarx.${constants.extensionName}`,
  openAIChat: `${constants.extensionName}.${constants.openAIChat}`,
  viewDetails: `${constants.extensionName}.${constants.viewDetails}`,
  ignorePackage: `${constants.extensionName}.${constants.ignorePackage}`,
  ignoreAll: `${constants.extensionName}.${constants.ignoreAll}`,
  openIgnoredView: `${constants.extensionName}.openIgnoredView`,
  refreshIgnoredStatusBar: `${constants.extensionName}.refreshIgnoredStatusBar`,
  refreshScaStatusBar: `${constants.extensionName}.refreshScaStatusBar`,
  refreshKicsStatusBar: `${constants.extensionName}.refreshKicsStatusBar`,
  assistDocumentation: `${constants.extensionName}.assistDocumentation`,
  updateCxOneAssist: `${constants.extensionName}.updateCxOneAssist`,
  astCxOneAssist: "astCxOneAssist",
  astResultsPromo: "astResultsPromo",
  scaAutoScanPromo: "scaAutoScanPromo",
  docAndFeedback: "docAndFeedback",
  refreshRiskManagementView: `${constants.extensionName}.refreshRiskManagementView`,
  clearKicsDiagnostics: `${constants.extensionName}.clearKicsDiagnostics`,

  environmentPick: `${constants.extensionName}.environmentPick`,
  refreshDastTree: `${constants.extensionName}.refreshDastTree`,
  clearDast: `${constants.extensionName}.clearDast`,
};
