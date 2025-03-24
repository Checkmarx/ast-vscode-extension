import * as vscode from 'vscode';
import { cx } from '../../cx/index';

export class RisksManagementService {
    private static instance: RisksManagementService;
    private context: vscode.ExtensionContext;
    private constructor(extensionContext: vscode.ExtensionContext) {
        this.context = extensionContext;
    }

    public static getInstance(extensionContext: vscode.ExtensionContext): RisksManagementService {
        if (!this.instance) {
            this.instance = new RisksManagementService(extensionContext);
        }
        return this.instance;
    }

    public getRiskManagementResults(projectId: string): Promise<object> {
        return cx.getRiskManagementResults(projectId);
    }

    public async checkIfLatestScan(projectId: string, scanId: string): Promise<boolean> {
        try {
            const scans = await cx.getScans(projectId, undefined, 1, "Completed");
            return scanId === scans[0]?.id;
        } catch (e) {
            throw new Error(e);
        }
    }


}