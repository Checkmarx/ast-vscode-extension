export const constants = {
  extensionName: "ast-results",
  extensionFullName: "Checkmarx",
  scanIdKey: "ast-results-scan-id",
  scanCreateIdKey: "ast-results-scan-create-id",
  scanCreatePrepKey: "ast-results-scan-prep-id",
  highFilter: "ast-results-high",
  mediumFilter: "ast-results-medium",
  lowFilter: "ast-results-low",
  infoFilter: "ast-results-info",
  notExploitableFilter: "ast-results-NotExploitable",
  proposedFilter: "ast-results-Proposed",
  confirmedFilter: "ast-results-Confirmed",
  toVerifyFilter: "ast-results-ToVerify",
  urgentFilter: "ast-results-Urgent",
  notIgnoredFilter: "ast-results-NotIgnored",
  ignoredFilter: "ast-results-Ignored",
  queryNameGroup: "ast-results-groupByQueryName",
  languageGroup: "ast-results-groupByLanguage",
  severityGroup: "ast-results-groupBySeverity",
  statusGroup: "ast-results-groupByStatus",
  stateGroup: "ast-results-groupByState",
  fileGroup: "ast-results-groupByFile",
  dependencyGroup: "ast-results-groupByDirectDependency",
  projectIdKey: "ast-results-project-id",
  error: "ast-results-error",
  errorMessage: "[CxERROR] ",
  branchIdKey: "ast-results-branch-id",
  branchName: "ast-results-branch-name",
  branchTempIdKey: "ast-results-temp-branch-id",
  kicsRealtime: "ast-results.kicsRealtime",
  projectLabel: "Project: ",
  projectPlaceholder: "Select project",
  branchLabel: "Branch: ",
  branchPlaceholder: "Select branch",
  scanLabel: "Scan: ",
  scanDateLabel: "Scan Date: ",
  scanPlaceholder: "Select scan",
  scanPickerTitle: "Checkmarx One Scan selection",
  projectItem: "project-item",
  branchItem: "branch-item",
  scanItem: "scan-item",
  graphItem: "graph-item",
  statusItem: "status-item",
  bookItem: "book-item",
  requestChangesItem: "requestChanges-item",
  mailItem: "mail-item",
  calendarItem: "calendar-item",
  resultsFileName: "ast-results",
  resultsFileExtension: "json",
  status: [
    { class: "select-high", value: "HIGH" },
    { class: "select-medium", value: "MEDIUM" },
    { class: "select-low", value: "LOW" },
    { class: "select-info", value: "INFO" },
  ],
  state: [
    { tag: "NOT_EXPLOITABLE", value: "Not Exploitable" },
    { tag: "PROPOSED_NOT_EXPLOITABLE", value: "Proposed Not Exploitable" },
    { tag: "CONFIRMED", value: "Confirmed" },
    { tag: "TO_VERIFY", value: "To Verify" },
    { tag: "URGENT", value: "Urgent" },
    { tag: "NOT_IGNORED", value: "Not Ignored", dependency: true },
    { tag: "IGNORED", value: "Ignored", dependency: true },
  ],
  sast: "sast",
  kics: "kics",
  sca: "sca",

  errorRegex: /Error: [0-9]{4}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} /i,

  astErrorCodeBashingNoLicense: 3,
  astErrorCodeBashingNoLesson: 4,

  kicsRealtimeFile: "CURRENT_KICS_FILE",
  processObject: "PROCESS_OBJECT",
  processObjectKey: "cli-process",

  kicsQueries: "queries",
  kicsResults: "results",
  kicsTotalCounter: "total_counter",
  kicsCount: "count",
  kicsResultsFile: "kics-results.json",

  refreshingTree: "$(sync~spin) Refreshing tree",

  // SCAN FROM IDE
  scanCreate: "$(sync~spin) Scan initializing...",
  scanCreateVerifyBranch:
    "$(sync~spin) Checking matching branches",
  scanCreateVerifyFiles: "$(sync~spin) Checking matching files",
  scanCreatePreparing: "$(sync~spin) Preparing files for scan",
  scanWaiting: "$(sync~spin) Scan running",
  scanCancel: "$(sync~spin) Canceling Scan",
  scanPollTimeout: 15000, // MILLISECONDS

  // SCA AUTO SCAN
  scaNoVulnerabilities: "Checkmarx found no vulnerabilities",
  scaStartScan:
    "Click the play button to scan with Checkmarx SCA",
  clearSca: "Clear all sca scan information",
  scaScanWaiting: "$(sync~spin) Checkmarx sca scan running",
  scaScanRunningLog: "SCA auto scanning command is running",

  // USER INPUT BUTTONS
  yes: "Yes",
  no: "No",

  // SCAN STATUS
  scanStatusComplete: "completed",
  scanStatusQueued: "queued",
  scanStatusPartial: "partial",
  scanStatusRunning: "running",

  // CREATE SCAN ADDITIONAL ARGUMENTS
  scanCreateAdditionalParameters:
    "--async --sast-incremental --resubmit",

  treeName: "astResults",
  scaTreeName: "scaAutoScan",
  realtime: "realtime",

  cxKics: "CheckmarxKICS",
  cxKicsAutoScan: "Activate KICS Real-time Scanning",

  projectLimit: "limit=10000",
  vsCodeAgent: "VS Code",
  cxOne: "checkmarxOne",
  additionalParams: "additionalParams",
  apiKey: "apiKey",
  cxKicsLong: "Checkmarx KICS",
  webviewName: "newDetails",
  gptWebviewName: "gpt",
  aiSecurityChampion: "AI Security Champion",
  gptSettings: `Checkmarx AI Security Champion: OpenAI Key`,
  gptCommandName: "CheckmarxSecurityChampion",
  gptSettingsKey: "key",
  gptEngineKey: "model",
  // Documentation & Feedback
  feedback: "Send us enhancement request or report a bug",
  documentation: "Documentation",
  // Vorpal engine
  errorInstallation: "Failed to run vorpal engine",
  errorScanVorpal: "failed to handle vorpal scan",
  vorpalStart: "Vorpal engine started",
  vorpalDisabled: "Vorpal Real-time Scanning is disabled now.",
  vorpalEngineName: "Vorpal",
  ActivateVorpalAutoScanning:"Activate Vorpal Real-time Scanning",
  CheckmarxVorpal:"CheckmarxVorpal",
};

export enum GroupBy {
  fileName = "fileName",
  severity = "severity",
  status = "status",
  language = "language",
  state = "state",
  typeLabel = "typeLabel",
  queryName = "queryName",
  packageIdentifier = "scaNode.packageIdentifier",
  directDependency = "scaNode.scaPackageData.typeOfDependency",
  scaType = "scaType"
}

export enum SeverityLevel {
  high = "HIGH",
  medium = "MEDIUM",
  low = "LOW",
  info = "INFO",
  empty = "",
}

export enum StateLevel {
  urgent = "Urgent",
  toVerify = "ToVerify",
  confirmed = "Confirmed",
  proposed = "Proposed",
  notExploitable = "NotExploitable",
  notIgnored = "NotIgnored",
  ignored = "Ignored"
}
