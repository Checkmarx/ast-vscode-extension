export const MAX_TIMEOUT = 1000000;
export const FIFTY_SECONDS = 50000;
export const THIRTY_SECONDS = 30000;
export const FIVE_SECONDS = 5000;
export const TEN_SECONDS = 10000;
export const THREE_SECONDS = 3000;
export const TWO_SECONDS = 2000;

export const CX_API_KEY = "Api Key";
export const CX_KICS_VALUE = "kics";

export const VS_CLOSE_EDITOR = "Close Editor";
export const VS_CLOSE_GROUP_EDITOR = "Close All Editors in Group";
export const VS_OPEN_FOLDER = "File: Open Folder...";

export const CX_NAME = "Checkmarx One";
export const CX_KICS = "Checkmarx KICS";
export const CX_KICS_NAME = "Activate KICS Real-time Scanning";

export const CX_SELECT_ALL = "ast-results: Select Different Results";
export const CX_SELECT_PROJECT = "ast-results: Select Project";
export const CX_SELECT_BRANCH = "ast-results: Select Branch";
export const CX_SELECT_SCAN = "ast-results: Select Scan";
export const CX_LOOK_SCAN = "ast-results: Look for Scan";

export const CX_FILTER_INFO = "ast-results: Filter severity: Info";
export const CX_FILTER_LOW = "ast-results: Filter severity: Low";
export const CX_FILTER_MEDIUM = "ast-results: Filter severity: Medium";
export const CX_FILTER_HIGH = "ast-results: Filter severity: High";

export const CX_FILTER_NOT_EXPLOITABLE = "ast-results:Filter: Not Exploitable";
export const CX_FILTER_PROPOSED_NOT_EXPLOITABLE =
  "ast-results:Filter: Proposed Not Exploitable";
export const CX_FILTER_CONFIRMED = "ast-results:Filter: Confirmed";
export const CX_FILTER_TO_VERIFY = "ast-results:Filter: To Verify";
export const CX_FILTER_URGENT = "ast-results:Filter: Urgent";
export const CX_FILTER_NOT_IGNORED = "ast-results:Filter: Not Ignored";

export const CX_CLEAR = "ast-results: Clear";
export const CX_SCA_CLEAR = "ast-results: Clear SCA results tree";
export const CX_SCA_SCAN = "ast-results: Run SCA Realtime Scan";

export const CX_GROUP_FILE = "ast-results: Group by: File";
export const CX_GROUP_SEVERITY = "ast-results: Group by: Severity";
export const CX_GROUP_LANGUAGE = "ast-results: Group by: Language";
export const CX_GROUP_STATUS = "ast-results: Group by: Status";
export const CX_GROUP_STATE = "ast-results: Group by: State";
export const CX_GROUP_QUERY_NAME = "ast-results: Group by: Vulnerability Type";

export const CX_CATETORY = "Checkmarx One";
export const CX_API_KEY_SETTINGS = "Api Key";

export const UUID_REGEX_VALIDATION =
  /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/gi;

export const STEP_1 = "Checkmarx One Scan selection (1/3)";
export const STEP_2 = "Checkmarx One Scan selection (2/3)";
export const STEP_3 = "Checkmarx One Scan selection (3/3)";

export const PROJECT_KEY_TREE = "Project:  ";
export const SCAN_KEY_TREE = "Scan:  ";
export const SCAN_KEY_TREE_LABEL = "Scan";
export const BRANCH_KEY_TREE = "Branch:  ";

export const SAST_TYPE = "sast";
export const SCS_SECRET_DETECTION_Type = "secret detection";

export const WEBVIEW_TITLE = "cx_title";
export const CODEBASHING_HEADER = "cx_header_codebashing";
export const COMMENT_BOX = "comment_box";
export const LEARN_MORE_LABEL = "learn-label";
export const CHANGES_LABEL = "changes-label";
export const CHANGES_CONTAINER = "history-container";
export const UPDATE_BUTTON = "submit";
export const GENERAL_LABEL = "general-label";

// Constants from @checkmarx/vscode-core (copied to avoid loading the entire module in tests)
export const ASCA_REALTIME_SCANNER_CONSTANTS = {
  activateAscaRealtimeScanner: "Activate ASCA Realtime",
  ascaRealtimeScanner: "Checkmarx AI Secure Coding Assistant (ASCA) Realtime Scanner",
};

export const LOCAL_BRANCH_CONSTANT = "scan my local branch";

export const MESSAGES = {
  scanProjectNotMatch: "Git project doesn't match the selected Checkmarx project. Do you want to scan anyway?",
};

export enum QuickPickPaginationButtons {
  nextPage = "Next Page",
  previousPage = "Previous Page",
}
