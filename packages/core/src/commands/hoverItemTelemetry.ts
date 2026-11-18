import { constants } from "../utils/common/constants";
import { isAscaHoverData, isContainersHoverData, isIacHoverData, isSecretsHoverData } from "../utils/utils";
import { AscaHoverData, ContainersHoverData, HoverData, IacHoverData, SecretsHoverData } from "../realtimeScanners/common/types";
import { REMEDIATION_MODE_DEV_ASSIST, TELEMETRY_TYPE } from "../models/telemetryEvent";
import { emitTelemetry, sanitizeTelemetryText } from "../services/telemetryService";
import { getIdeInfo } from "../utils/ideInfo";
import { getRepositoryRemoteUrl } from "../utils/gitRemote";

/**
 * Telemetry for the hover / code action commands on realtime findings
 * ("Fix with AI", "View details", "Ignore", "Ignore all").
 */

export type HoverItem = HoverData | SecretsHoverData | AscaHoverData | ContainersHoverData | IacHoverData;

export function getEngine(item: HoverItem): string {
  if (isSecretsHoverData(item)) {
    return constants.secretsScannerEngineName;
  }
  if (isIacHoverData(item)) {
    return constants.iacRealtimeScannerEngineName;
  }
  if (isAscaHoverData(item)) {
    return constants.ascaRealtimeScannerEngineName;
  }
  if (isContainersHoverData(item)) {
    return constants.containersRealtimeScannerEngineName;
  }
  return constants.ossRealtimeScannerEngineName;
}

/** Severity for Secrets, ASCA and IaC; status (Critical, Malicious, ...) for OSS and Containers. */
export function getSeverity(item: HoverItem): string {
  if (isSecretsHoverData(item) || isAscaHoverData(item) || isIacHoverData(item)) {
    return item.severity ?? "";
  }
  return (item as HoverData | ContainersHoverData).status ?? "";
}

/**
 * Identifier of the finding that is being remediated:
 * ASCA rule id, IaC similarity id, Secrets title, Containers image:tag, OSS package@version.
 */
export function getVulnerabilityId(item: HoverItem): string {
  if (isAscaHoverData(item)) {
    return item.ruleId !== undefined && item.ruleId !== null ? String(item.ruleId) : (item.ruleName ?? "");
  }
  if (isIacHoverData(item)) {
    return item.similarityId ?? "";
  }
  if (isSecretsHoverData(item)) {
    return item.title ?? "";
  }
  if (isContainersHoverData(item)) {
    return item.imageTag ? `${item.imageName}:${item.imageTag}` : (item.imageName ?? "");
  }
  const pkg = item as HoverData;
  return pkg.version ? `${pkg.packageName}@${pkg.version}` : (pkg.packageName ?? "");
}

function getFilePath(item: HoverItem): string | undefined {
  const iacItem = item as IacHoverData;
  return iacItem.originalFilePath ?? (item as { filePath?: string }).filePath;
}

/**
 * "Fix with AI" remediation event. Sent after the prompt was handed to the assistant,
 * so aiProvider is the assistant that was actually used.
 */
export function emitRemediationEvent(item: HoverItem, aiProvider: string | null, failureReason?: string): void {
  const failed = failureReason !== undefined || !aiProvider;
  emitTelemetry({
    type: TELEMETRY_TYPE.click,
    subType: constants.openAIChat,
    engine: getEngine(item),
    problemSeverity: getSeverity(item),
    aiProvider: aiProvider ?? "",
    status: failed ? "Failure" : "Success",
    statusResult: failed
      ? `Remediation failed. Reason: ${sanitizeTelemetryText(failureReason ?? "No AI assistant available")}, Error Code: N/A`
      : "Remediation completed successfully.",
    repoUrl: getRepositoryRemoteUrl(getFilePath(item)),
    eventAttributes: {
      vulnerabilityId: getVulnerabilityId(item),
      remediationMode: REMEDIATION_MODE_DEV_ASSIST,
    },
  });
}

/**
 * Other click events (viewDetails, ignorePackage, ignoreAll). Sent before the action runs,
 * as before. aiProvider keeps its previous value (the IDE's assistant, or "VS Code").
 */
export function emitHoverClickEvent(subType: string, item: HoverItem): void {
  emitTelemetry({
    type: TELEMETRY_TYPE.click,
    subType,
    engine: getEngine(item),
    problemSeverity: getSeverity(item),
    aiProvider: getIdeInfo().nativeAiProvider ?? constants.vsCodeAgent,
    status: "Success",
    repoUrl: getRepositoryRemoteUrl(getFilePath(item)),
  });
}
