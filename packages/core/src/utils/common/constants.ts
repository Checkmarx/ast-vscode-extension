import { getExtensionType } from '../../config/extensionConfig';
import { getMessages } from '../../config/extensionMessages';

export const constants = {
  extensionName: "ast-results",
  extensionFullName: "Checkmarx",
  getStandaloneEnabledGlobalState: (): string => {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx' ? 'standaloneEnabled' : 'standaloneEnabledDevAssist';
  },
  getCxOneAssistEnabledGlobalState: (): string => {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx' ? 'cxOneAssistEnabled' : 'cxOneAssistEnabledDevAssist';
  },
  getAuthCredentialSecretKey: (): string => {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx' ? 'authCredential' : 'authCredentialDevAssist';
  },
  scanIdKey: "ast-results-scan-id",
  scanCreateIdKey: "ast-results-scan-create-id",
  scanCreatePrepKey: "ast-results-scan-prep-id",
  criticalFilter: "ast-results-critical",
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
  scaHideDevTestFilter: "ast-results-SCAHideDevTest",
  allCustomStatesFilter: "ast-results-AllCustomStates",
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
  localBranch: "scan my local branch",
  projectLabel: "Project: ",
  projectPlaceholder: "Select project",
  branchLabel: "Branch: ",
  branchPlaceholder: "Select branch",
  scanLabel: "Scan: ",
  scanDateLabel: "Scan Date: ",
  scanPlaceholder: "Select scan",
  scanPickerTitle: "Checkmarx One Scan selection",
  projectPickerTitle: "Checkmarx One Project selection",
  branchPickerTitle: "Checkmarx One Branch selection",
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
    { class: "select-critical", value: "CRITICAL" },
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
    // { tag: "NOT_IGNORED", value: "Not Ignored", dependency: true },
    // { tag: "IGNORED", value: "Ignored", dependency: true },
  ],
  sast: "sast",
  kics: "kics",
  sca: "sca",
  secretDetection: "secret detection",
  scsSecretDetection: "sscs-secret-detection",

  errorRegex:
    /Error: [0-9]{4}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} /i,

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
  scanCreateVerifyBranch: "$(sync~spin) Checking matching branches",
  scanCreateVerifyFiles: "$(sync~spin) Checking matching files",
  scanCreatePreparing: "$(sync~spin) Preparing files for scan",
  scanWaiting: "$(sync~spin) Scan running",
  scanCancel: "$(sync~spin) Canceling Scan",
  scanPollTimeout: 15000, // MILLISECONDS

  // SCA AUTO SCAN
  scaNoVulnerabilities: "Checkmarx found no vulnerabilities",
  scaStartScan: "Click the play button to scan with Checkmarx SCA",
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
  scanCreateAdditionalParameters: "--async --sast-incremental --resubmit",

  treeName: "astResults",
  dastTreeName: "dastResults",
  scaTreeName: "scaAutoScan",
  realtime: "realtime",

  cxKics: "CheckmarxKICS",
  cxKicsAutoScan: "Activate KICS Real-time Scanning",

  projectLimit: "limit=10000",
  vsCodeAgent: "VS Code",
  vsCodeAgentOrginalName: "Visual Studio Code",
  cursorAgent: "Cursor",
  windsurfAgent: "Windsurf",
  kiroAgent: "Kiro",
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
  gptCustomModelKey: "customModel",
  systemNotFindPathError: "The system cannot find the path specified.",
  systemNotFindLineError: "out of range",
  gptFileNotInWorkspaceError: "AI Security Champion can't advise you about this vulnerability because the file where the vulnerability was identified isn't open in your VS Code workspace.",
  gptFileChangedError: "The local file has changed since the previous scan. You need to run a new scan before using AI Security Champion.",
  // Documentation & Feedback
  feedback: "Send us enhancement request or report a bug",
  documentation: "Documentation",

  // TRIAGE
  triageUpdate: "ast-result-triage",
  customStates: "cxStates",

  // ASCA Realtime Scanner
  activateAscaRealtimeScanner: "Activate ASCA Realtime",
  getAscaRealtimeScanner: (): string => {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx'
      ? "Checkmarx AI Secure Coding Assistant (ASCA) Realtime Scanner"
      : "Checkmarx Developer Assist AI Secure Coding Assistant (ASCA) Realtime Scanner";
  },
  ascaRealtimeScannerStart: "ASCA Realtime Scanner Engine started",
  ascaRealtimeScannerDisabled: "ASCA Realtime Scanner Engine disabled",
  ascaRealtimeScannerEngineName: "Asca",
  ascaRealtimeScannerDirectory: "Cx-asca-realtime-scanner",
  errorAscaInstallation: "Failed to run ASCA engine",
  errorAscaScanRealtime: "Failed to handle ASCA Realtime scan",

  // Secrets Scanner
  activateSecretsScanner: "Activate Secret Detection Realtime",
  getSecretsScanner: (): string => {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx'
      ? "Checkmarx Secret Detection Realtime Scanner"
      : "Checkmarx Developer Assist Secret Detection Realtime Scanner";
  },
  secretsScannerStart: "Secret Detection Scanner Engine started",
  secretsScannerDisabled: "Secret Detection Scanner Engine disabled",
  secretsScannerEngineName: "Secrets",
  secretsScannerDirectory: "Cx-secret-realtime-scanner",
  errorSecretsScanRealtime: "Failed to handle Secret Detection scan",

  // OSS Scanner
  activateOssRealtimeScanner: "Activate OSS-Realtime",
  getOssRealtimeScanner: (): string => {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx'
      ? "Checkmarx Open Source Realtime Scanner (OSS-Realtime)"
      : "Checkmarx Developer Assist Open Source Realtime Scanner (OSS-Realtime)";
  },
  ossRealtimeScannerStart: "Realtime OSS Scanner Engine started",
  ossRealtimeScannerDisabled: "Realtime OSS Scanner Engine disabled",
  ossRealtimeScannerEngineName: "Oss",
  ossRealtimeScannerDirectory: "Cx-oss-realtime-scanner",
  errorOssScanRealtime: "Failed to handle OSS Realtime scan",

  // Containers Scanner
  activateContainersRealtimeScanner: "Activate Containers Realtime",
  getContainersRealtimeScanner: (): string => {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx'
      ? "Checkmarx Containers Realtime Scanner"
      : "Checkmarx Developer Assist Containers Realtime Scanner";
  },
  containersRealtimeScannerStart: "Containers Realtime Scanner Engine started",
  containersRealtimeScannerDisabled: "Containers Realtime Scanner Engine disabled",
  containersRealtimeScannerEngineName: "Containers",
  containersRealtimeScannerDirectory: "Cx-containers-realtime-scanner",
  errorContainersScanRealtime: "Failed to handle Containers Realtime scan",

  // IaC Scanner
  activateIacRealtimeScanner: "Activate IAC Realtime",
  getIacRealtimeScanner: (): string => {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx'
      ? "Checkmarx IAC Realtime Scanner"
      : "Checkmarx Developer Assist IAC Realtime Scanner";
  },
  iacRealtimeScannerStart: "IaC Realtime Scanner Engine started",
  iacRealtimeScannerDisabled: "IaC Realtime Scanner Engine disabled",
  iacRealtimeScannerEngineName: "IaC",
  iacRealtimeScannerDirectory: "Cx-iac-realtime-scanner",
  errorIacScanRealtime: "Failed to handle IaC Realtime scan",

  supportedManifestFilePatterns: [
    "**/Directory.Packages.props",
    "**/packages.config",
    "**/pom.xml",
    "**/package.json",
    "**/requirements.txt",
    "**/go.mod",
    "**/*.csproj"
  ],
  ossIcons: {
    critical: "critical_severity.png",
    high: "high_severity.png",
    medium: "medium_severity.png",
    low: "low_severity.png",
  },

  ascaSupportedExtensions: [
    ".java",
    ".cs",
    ".go",
    ".py",
    ".js",
    ".jsx"
  ],

  containersSupportedPatterns: [
    "**/dockerfile",
    "**/dockerfile-*",
    "**/dockerfile.*",
    "**/docker-compose.yml",
    "**/docker-compose.yaml",
    "**/docker-compose-*.yml",
    "**/docker-compose-*.yaml"
  ],

  containersHelmExtensions: [
    ".yml",
    ".yaml"
  ],

  containersHelmExcludedFiles: [
    "chart.yaml",
    "chart.yml"
  ],

  iacSupportedExtensions: [
    ".tf",
    ".yaml",
    ".yml",
    ".json",
    ".proto",
    ".dockerfile"
  ],

  iacSupportedPatterns: [
    "**/Dockerfile",
    "**/*.auto.tfvars",
    "**/*.terraform.tfvars",
  ],

  getCxAi: (): string => {
    return getMessages().productName;
  },

  criticalSeverity: "CRITICAL",
  highSeverity: "HIGH",
  mediumSeverity: "MEDIUM",
  lowSeverity: "LOW",
  infoSeverity: "INFO",

  copilotChatExtensionId: "GitHub.copilot-chat",
  copilotNewChatOpen: "workbench.action.chat.newChat",
  copilotChatOpenWithQueryCommand: "workbench.action.chat.openAgent",
  newCopilotChatOpenWithQueryCommand: "workbench.action.chat.openagent",

  openAIChat: "fixWithAIChat",
  viewDetails: "viewDetails",
  ignoreAll: "ignoreAll",
  ignorePackage: "ignorePackage",
  emptyResultsScanId: "3"
};

export enum Platform {
  WINDOWS = 'win32',
  MAC = 'darwin',
}

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
  scaType = "scaType",
}

export enum SeverityLevel {
  critical = "CRITICAL",
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
  ignored = "Ignored",
  customStates = "CustomStates",
}
export enum QuickPickPaginationButtons {
  nextPage = "Next Page",
  previousPage = "Previous Page",
}
