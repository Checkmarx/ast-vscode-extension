import { HoverData, AscaHoverData, ContainersHoverData, IacHoverData, SecretsHoverData } from "../realtimeScanners/common/types";

export const AI_FIX_EVENTS = {
    requested: 'aiFixRequested',
    duplicate: 'aiFixDuplicate',
    changesAccepted: 'aiChangesAccepted',
    changesRejected: 'aiChangesRejected'
} as const;

export type ScannerType = 'Oss' | 'Secrets' | 'Asca' | 'Containers' | 'IaC';

export type FixOutcomeStatus =
    | 'changes_accepted'
    | 'changes_rejected';

export interface PendingAIFix {
    id: string;

    vulnerabilityKey: string;

    filePath: string;

    line: number;

    scannerType: ScannerType;

    severity: string;

    validatorState: unknown;

    requestedAt: number;

    requestCount: number;

    originalItem?: HoverData | AscaHoverData | ContainersHoverData | IacHoverData | SecretsHoverData;
}

export interface FixOutcome {

    status: FixOutcomeStatus;

    scannerType: ScannerType;

    severity: string;

    vulnerabilityKey: string;

    duplicateRequests: number;

    validatorMetadata?: Record<string, unknown>;
}

export interface FixOutcomeTelemetry {

    status: FixOutcomeStatus;

    scannerType: ScannerType;

    severity: string;

    filePath: string;

    packageName: string;

    duplicateRequests: number;

    initialFileHash: string;

    finalFileHash: string;

    hashesMatch: boolean;
}

export interface TrackerConfig {

    checkOnSave: boolean;

    ghostTextTimeoutMs: number;
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
    checkOnSave: true,
    ghostTextTimeoutMs: 5000
};