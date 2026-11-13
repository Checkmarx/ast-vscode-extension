import {
    SEVERITY_LABELS,
    SeverityLabel,
    TELEMETRY_API_VERSION,
    TELEMETRY_SUB_TYPE,
    TELEMETRY_TYPE,
    createEmptySeverityCounts,
    formatSeverityCounts,
    toSeverityLabel,
} from "../../models/telemetryEvent";
import { emitTelemetry, sanitizeTelemetryText } from "../../services/telemetryService";
import { getRepositoryRemoteUrl } from "../../utils/gitRemote";

/** Scans with no findings are sent too: engagement metrics need every scan. */
export const SEND_ZERO_FINDING_SCANS = true;

/**
 * Sends one scan event per realtime scan (AST-184025).
 *
 * @param engine     engine name as sent in telemetry: Asca, Oss, Secrets, IaC, Containers
 * @param severities severity (or OSS/Containers status) of every finding, ignored ones included
 * @param filePath   scanned file, used to find the repository URL
 */
export function logScanResults(engine: string, severities: unknown[], filePath?: string): void {
    const counts: Record<SeverityLabel, number> = createEmptySeverityCounts();
    for (const severity of severities ?? []) {
        const label = toSeverityLabel(severity);
        if (label) {
            counts[label]++;
        }
    }
    const total = SEVERITY_LABELS.reduce((sum, label) => sum + counts[label], 0);
    if (total === 0 && !SEND_ZERO_FINDING_SCANS) {
        return;
    }

    emitTelemetry({
        type: TELEMETRY_TYPE.scan,
        subType: TELEMETRY_SUB_TYPE.scanTriggered,
        engine,
        // Highest severity found, empty for a clean scan.
        problemSeverity: SEVERITY_LABELS.find((label) => counts[label] > 0) ?? "",
        totalCount: total,
        status: "Success",
        statusResult: formatSeverityCounts(counts),
        repoUrl: getRepositoryRemoteUrl(filePath),
        eventAttributes: { apiVersion: TELEMETRY_API_VERSION },
    });
}

/** Sends a scan event with status Failure when a realtime scan throws or returns an error. */
export function logScanFailure(engine: string, error: unknown, filePath?: string): void {
    emitTelemetry({
        type: TELEMETRY_TYPE.scan,
        subType: TELEMETRY_SUB_TYPE.scanTriggered,
        engine,
        status: "Failure",
        statusResult: `Scan failed. Reason: ${sanitizeTelemetryText(error)}, Error Code: N/A`,
        repoUrl: getRepositoryRemoteUrl(filePath),
        eventAttributes: { apiVersion: TELEMETRY_API_VERSION },
    });
}
