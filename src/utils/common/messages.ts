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
  scanBranchNotMatch:
    "Git branch doesn't match the selected Checkmarx branch. Do you want to scan anyway?",
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
  pickerProjectMissing: "Please select a project first",
  pickerBranchProjectMissing: "Please select a branch and project first",
};
