export const messages = {
  pluginRunning: "Checkmarx plugin is running",
  dataRefreshed: "Data refreshed and synced with Checkmarx One platform",
  filtersInitialized: "Filters initialized",
  groupByInitialized: "Group by initialized",
  scanStartWorkspace: "Initiating scan for workspace Folder: ",
  scanCreated: "Scan created with ID: ",
  scanCancelling: "Canceling the current scan",
  scanCancellingSent: "scan cancel instruction sent for ID: ",
  scanNoFilesFound:
    "No files found in workspace. Please open a workspace or folder.",
  scanFilesMatch: "Files match workspace",
  scanFilesNotMatch: "Files in workspace dont match files in results",
  scanProjectsNotMatch:
    "Project in workspace doesn't match the selected Checkmarx project. Do you want to scan anyway?",
  scanBranchMatch: "Branch match the view branch. Initiating scan...",
  scanProjectMatch: "Project match the view project. Initiating scan...",
  scanBranchNotMatch:
    "Git branch doesn't match the selected Checkmarx branch. Do you want to scan anyway?",
  scanProjectNotMatch:
      "Git project doesn't match the selected Checkmarx project. Do you want to scan anyway?",
  scanCheckStart:
    "Scan initiation started. Checking if scan is eligible to be initiated...",
  scanCompletedLoadResults: (status, scanID) =>
    `Scan finished with status: ${status}. Do you want to load results? Scan Id: ${scanID}`,
  scanCompletedStatus: (status) => `Scan finished with status: ${status}`,
  scaStatusBarConnect: "$(check) Checkmarx sca",
  scaStatusBarDisconnect: "$(debug-disconnect) Checkmarx sca",
  scaScanStart: "Checking if scan can be started...",
  scaNoFilesFound:
    "No files found in workspace. Please open a workspace or folder to be able to start an SCA scan.",
  scaScanning: "Scanning project for vulnerabilities...",
  scaScanningNotComplete: "Scan did not complete : ",
  scaScanCompletedSuccess: (resultsCount) =>
    `Scan completed successfully, ${resultsCount} result(s) loaded into the SCA results tree`,
  scaTreeVulnerabilities: (resultsCount, workspace) =>
    `SCA identified ${resultsCount} vulnerabilities in ${workspace}`,
  scaSucces: "Scan finished successfully",
  scaErrors: "Scan finished with errors",
  scaDependencyErros: "Dependency resolution errors",
  scaVulnerabilities: "Vulnerabilities",
  pickerProjectMissing: "Please select a project first",
  pickerBranchProjectMissing: "Please select a branch and project first",
  filterResults: (activeFilter) => `Filtering ${activeFilter} results`,
  kicsStatusBarConnect: "$(check) Checkmarx kics",
  kicsStatusBarDisconnect: "$(debug-disconnect) Checkmarx kics",
  kicsStatusBarError: "$(error) Checkmarx KICS",
  kicsAutoScan: "Checkmarx kics real-time scan",
  kicsAutoScanRunning:
    "$(sync~spin) Checkmarx KICS: Running KICS Real-time Scan",
  kicsRunning: "Checkmarx KICS is running",
  kicsFixRunning: "$(sync~spin) Checkmarx KICS: Running KICS Fix",
  commandRunning: "Checkmarx command is running",
  clearLoadedInfo: "Clear all loaded information",
  resultFileNotFound: (filePath) => `File ${filePath} not found in workspace`,
  generalTab: "General",
  descriptionTab: "Description",
  noDescriptionTab: "No description",
  triageTab: "Triage",
  remediationExamplesTab: "Remediation Examples",
  noRemediationExamplesTab: "No remediation examples",
  projectNotFound: "Project not found",
  projectIdUndefined: "Project ID is undefined.",
  scanIdNotFound: "ScanId not found",
  scanIdIncorrectFormat: "Invalid scan id format.",
  scanIdUndefined: "Scan ID is undefined.",
  cancelLoading: "Canceled loading",
  loadingBranches: "Loading branches",
  loadingProjects: "Loading projects",
  loadingProject: "Loading project",
  loadingScans: "Loading scans",
  loadingScan: "Loading scan",
  loadingResults: "Loading results",
  triageNotAvailableSca: "Triage not available for SCA.",
  triageSubmitedSuccess: "Feedback submited successfully! Results refreshed.",
  triageError: (error) => `Triage ${error}`,
  triageNoChange: "Make a change before submiting",
  triageUpdateState: (state) => `Updating state to ${state}`,
  triageUpdateSeverity: (severity) => `Updating severity to ${severity}`,
  fileNotFound: "File not found",
  bflNoLocation: "No best fix location available for the current results",
  bflFetchResults: "Fetching results best fix location",
  initilizeGroupBy: "Initializing group by selections",
  groupingBy: (type) => `"Grouping by" ${type}`,
  initilizeSeverities: "Initializing severity filters",
  fetchCodebashing: "Getting codebashing link",
  failedCodebashing: "Failed getting codebashing link",
  codebashing: "Codebashing",
  cancelCodebashingLoad: "Canceled loading",
  codeBashingUrl: "https://free.codebashing.com",
  noScanIDResults: "Scan ID is not defined while trying to get results",
  noScanIDScan: "Scan ID is not defined while trying to get scan",
  noProjectIDScan: "Project ID is not defined while trying to get project",
  noProjectIDBranches: "Project ID is not defined while trying to get branches",
  codebashingMissingParams:
    "Missing mandatory parameters, cweId, language or queryName ",
  bflMissingParams:
    "Missing mandatory parameters, scanId, queryId or resultNodes ",
  kicsMissingParams: "Missing mandatory parameters, fileSources",
  kicsScanError: "Error running kics scan",
  kicsRemediationNoResultsFile: "Missing mandatory parameters, resultsFile",
  kicsRemediationNoKicsFile: "Missing mandatory parameters, kicsFile",
  kicsRemediationError: "Error running kics remediation",
  kicsUpdatingResults: "File saved updating KICS results",
  kicsSupportedFile: "Opened a supported file by KICS. Starting KICS scan",
  initializeState: "Initializing state filters",
  openSettings: "workbench.action.openSettings",
  splitEditorRight: "workbench.action.splitEditorRight",
  closeEditorGroup: "workbench.action.closeEditorsInGroup",
  scaNoUpgrade: "No available upgrade for package ",
  scaUpgrading: (packages, version) =>
    `Upgrading ${packages} to version ${version}`,
  scaUpgradingSuccess: (packages, version) =>
    `Package ${packages} successfully upgraded to version ${version}`,
  scaStartScan: "Click the play button to scan with Checkmarx SCA",
  scaNoFolder:
    "No folder is opened. Please open the folder for the current project.",
  gitOpenRepo: "GIT API - Open repository",
  gitExtensionMissing:
    "Git Extension - Could not find active git extension in workspace.",
  gitExtensionBranch: "Git Extension - Add branch.",
  gitExtensionNotInstalled:
    "Git extension - Could not find vscode.git installed.",
  gptMissinApiKey: `No GPT apikey is configured. Please go to the extension 
  <a id="gpt-settings" href="#" onClick="(function(){
    vscode.postMessage({
      command: 'openSettings',
    });
  })();">
    settings
  </a>
  `,
};
