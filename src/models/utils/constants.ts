export enum StateLevel {
  NOT_EXPLOITABLE = "NOT_EXPLOITABLE",
  PROPOSED_NOT_EXPLOITABLE = "PROPOSED_NOT_EXPLOITABLE",
  CONFIRMED = "CONFIRMED",
  TO_VERIFY = "TO_VERIFY",
  URGENT = "URGENT",
  NOT_IGNORED = "NOT_IGNORED",
  IGNORED = "IGNORED",
}

export enum SeverityLevel {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
  INFO = "info",
  EMPTY = "empty",
}

export const constants = {
  criticalSeverity: "critical",
  highSeverity: "high",
  mediumSeverity: "medium",
  lowSeverity: "low",
  infoSeverity: "info",

  sca: "sca",
  sast: "sast",
  kics: "kics",
  scsSecretDetection: "scs",

  secretDetection: "Secret Detection",
};
