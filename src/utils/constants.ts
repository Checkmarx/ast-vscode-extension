export const EXTENSION_NAME: string = "ast-results";
export const SCAN_ID_KEY: string = "ast-results-scan-id";

export const HIGH_FILTER: string = "ast-results-high";
export const MEDIUM_FILTER: string = "ast-results-medium";
export const LOW_FILTER: string = "ast-results-low";
export const INFO_FILTER: string = "ast-results-info";

export const NOT_EXPLOITABLE_FILTER: string = "ast-results-NotExploitable";
export const PROPOSED_FILTER: string = "ast-results-Proposed";
export const CONFIRMED_FILTER: string = "ast-results-Confirmed";
export const TO_VERIFY_FILTER: string = "ast-results-ToVerify";
export const URGENT_FILTER: string = "ast-results-Urgent";
export const NOT_IGNORED_FILTER: string = "ast-results-NotIgnored";
export const IGNORED_FILTER: string = "ast-results-Ignored";

export const PROJECT_ID_KEY: string = "ast-results-project-id";
export const ERROR: string = "ast-results-error";
export const ERROR_MESSAGE: string = "[CxERROR] ";
export const SELECTED_SCAN_KEY: string = "ast-results-scan-name";
export const BRANCH_ID_KEY: string = "ast-results-branch-id";
export const BRANCH_TEMP_ID_KEY: string = "ast-results-temp-branch-id";

export const PROJECT_LABEL: string = "Project: ";
export const PROJECT_PLACEHOLDER: string = "Select project";
export const BRANCH_LABEL: string = "Branch: ";
export const BRANCH_PLACEHOLDER: string = "Select branch";
export const SCAN_LABEL: string = "Scan: ";
export const SCAN_PLACEHOLDER: string = "Select scan";
export const SCAN_PICKER_TITLE: string = "AST Scan selection";

export const PROJECT_ITEM: string = "project-item";
export const BRANCH_ITEM: string = "branch-item";
export const SCAN_ITEM: string = "scan-item";
export const GRAPH_ITEM: string = "graph-item";

export const RESULTS_FILE_NAME: string = "ast-results";
export const RESULTS_FILE_EXTENSION: string = "json";

export const STATUS = [{class:"select-high",value:"HIGH"},{class:"select-medium",value:"MEDIUM"},{class:"select-low",value:"LOW"},{class:"select-info",value:"INFO"}];
export const STATE = [{tag:"NOT_EXPLOITABLE",value:"Not Exploitable"},{tag:"PROPOSED_NOT_EXPLOITABLE",value:"Proposed Not Exploitable"},{tag:"CONFIRMED",value:"Confirmed"},{tag:"TO_VERIFY",value:"To Verify"},{tag:"URGENT",value:"Urgent"},{tag:"NOT_IGNORED",value:"Not Ignored", dependency:true},{tag:"IGNORED",value:"Ignored", dependency:true}];

export const TYPES : {
	[key: string]: string,
   } = {"infrastructure":"kics","dependency":"sca","sast":"sast"};

export enum IssueFilter {
	fileName = "fileName",
	severity = "severity",
	status = "status",
	language = "language",
	state = "state"
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