import {cx} from "../../cx";

export function logScanResults(scanType: string, fullScanResults: Array<{ severity?: unknown }>): void {
    const LABELS = ['Critical', 'High', 'Medium', 'Low', 'Unknown'] as const;
    type Label = typeof LABELS[number];

    const SEVERITY_LABELS: Record<string, Label> = {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        unknown: 'Unknown',
    };

    const counts: Record<Label, number> = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0,
        Unknown: 0,
    };

    for (const item of fullScanResults) {
        const raw =
            typeof item?.severity === 'string' ? item.severity.toLowerCase() : 'unknown';
        const label = SEVERITY_LABELS[raw] ?? 'Unknown';
        counts[label]++;
    }

    for (const label of LABELS) {
        cx.setUserEventDataForDetectionLogs(scanType, label, counts[label]);
    }
}