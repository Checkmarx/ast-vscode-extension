export const EXTENSION_NAME: string = "checkmarx-one-results";
export const EXTENSION_FULL_NAME: string = "Checkmarx";
export const SCAN_ID_KEY: string = "checkmarx-one-results-scan-id";
export const SCAN_CREATE_ID_KEY: string = "checkmarx-one-results-scan-create-id";
export const SCAN_CREATE_PREP_KEY: string = "checkmarx-one-results-scan-prep-id";

export const HIGH_FILTER: string = "checkmarx-one-results-high";
export const MEDIUM_FILTER: string = "checkmarx-one-results-medium";
export const LOW_FILTER: string = "checkmarx-one-results-low";
export const INFO_FILTER: string = "checkmarx-one-results-info";

export const NOT_EXPLOITABLE_FILTER: string = "checkmarx-one-results-NotExploitable";
export const PROPOSED_FILTER: string = "checkmarx-one-results-Proposed";
export const CONFIRMED_FILTER: string = "checkmarx-one-results-Confirmed";
export const TO_VERIFY_FILTER: string = "checkmarx-one-results-ToVerify";
export const URGENT_FILTER: string = "checkmarx-one-results-Urgent";
export const NOT_IGNORED_FILTER: string = "checkmarx-one-results-NotIgnored";
export const IGNORED_FILTER: string = "checkmarx-one-results-Ignored";

export const QUERY_NAME_GROUP: string = "checkmarx-one-results-groupByQueryName";
export const LANGUAGE_GROUP: string = "checkmarx-one-results-groupByLanguage";
export const SEVERITY_GROUP: string = "checkmarx-one-results-groupBySeverity";
export const STATUS_GROUP: string = "checkmarx-one-results-groupByStatus";
export const STATE_GROUP: string = "checkmarx-one-results-groupByState";
export const FILE_GROUP: string = "checkmarx-one-results-groupByFile";
export const DEPENDENCY_GROUP: string = "checkmarx-one-results-groupByDirectDependency";

export const PROJECT_ID_KEY: string = "checkmarx-one-results-project-id";
export const ERROR: string = "checkmarx-one-results-error";
export const ERROR_MESSAGE: string = "[CxERROR] ";
export const BRANCH_ID_KEY: string = "checkmarx-one-results-branch-id";
export const BRANCH_NAME: string = "checkmarx-one-results-branch-name";
export const BRANCH_TEMP_ID_KEY: string = "checkmarx-one-results-temp-branch-id";

export const PROJECT_LABEL: string = "Project: ";
export const PROJECT_PLACEHOLDER: string = "Select project";
export const BRANCH_LABEL: string = "Branch: ";
export const BRANCH_PLACEHOLDER: string = "Select branch";
export const SCAN_LABEL: string = "Scan: ";
export const SCAN_PLACEHOLDER: string = "Select scan";
export const SCAN_PICKER_TITLE: string = "Checkmarx One Scan selection";

export const PROJECT_ITEM: string = "project-item";
export const BRANCH_ITEM: string = "branch-item";
export const SCAN_ITEM: string = "scan-item";
export const GRAPH_ITEM: string = "graph-item";

export const RESULTS_FILE_NAME: string = "checkmarx-one-results";
export const RESULTS_FILE_EXTENSION: string = "json";

export const STATUS = [{class:"select-high",value:"HIGH"},{class:"select-medium",value:"MEDIUM"},{class:"select-low",value:"LOW"},{class:"select-info",value:"INFO"}];
export const STATE = [{tag:"NOT_EXPLOITABLE",value:"Not Exploitable"},{tag:"PROPOSED_NOT_EXPLOITABLE",value:"Proposed Not Exploitable"},{tag:"CONFIRMED",value:"Confirmed"},{tag:"TO_VERIFY",value:"To Verify"},{tag:"URGENT",value:"Urgent"},{tag:"NOT_IGNORED",value:"Not Ignored", dependency:true},{tag:"IGNORED",value:"Ignored", dependency:true}];

export const SAST: string = "sast";
export const KICS: string = "kics";
export const SCA: string = "sca";

export enum IssueFilter {
	fileName = "fileName",
	severity = "severity",
	status = "status",
	language = "language",
	state = "state",
	type = "type",
	queryName = "queryName",
	packageIdentifier = "scaNode.packageIdentifier",
	directDependency = "scaNode.scaPackageData.typeOfDependency",
	scaType = "scaType"
  }
  
export enum IssueLevel {
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

export const ERROR_REGEX = /Error: [0-9]{4}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} /i;

export const AST_ERROR_CODEBASHING_NO_LICENSE: number = 3;
export const AST_ERROR_CODEBASHING_NO_LESSON: number = 4;

export const KICS_REALTIME_FILE = "CURRENT_KICS_FILE";
export const PROCESS_OBJECT = "PROCESS_OBJECT";
export const PROCESS_OBJECT_KEY = "cli-process";

export const KICS_QUERIES = "queries";
export const KICS_RESULTS = "results";
export const KICS_TOTAL_COUNTER = "total_counter";
export const KICS_COUNT = "count";
export const KICS_RESULTS_FILE = "kics-results.json";


export const SCAN_CREATE = "$(sync~spin) Scan initializing...";
export const SCAN_CREATE_VERIFY_BRANCH = "$(sync~spin) Checking matching branches";
export const SCAN_CREATE_VERIFY_FILES = "$(sync~spin) Checking matching files";
export const SCAN_CREATE_PREPARING = "$(sync~spin) Preparing files for scan";
export const SCAN_WAITING = "$(sync~spin) Scan running";
export const SCAN_CANCEL = "$(sync~spin) Canceling Scan";
export const SCAN_POLL_TIMEOUT = 15000; // MILLISECONDS

// USER INPUT BUTTONS
export const YES = "Yes";
export const NO = "No";

// SCAN STATUS
export const SCAN_STATUS_COMPLETE = "completed";
export const SCAN_STATUS_QUEUED = "queued";
export const SCAN_STATUS_PARTIAL = "partial";
export const SCAN_STATUS_RUNNING = "running";

// CREATE SCAN ADDITIONAL ARGUMENTS
export const SCAN_CREATE_ADDITIONAL_PARAMETERS = "--async --sast-incremental --resubmit";