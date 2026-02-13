import * as crypto from "crypto";
import * as fs from "fs";
import { Logs } from "../models/logs";


export interface FixValidator {

    captureInitialState(filePath: string): Promise<unknown>;

    captureFinalState(filePath: string): Promise<unknown>;

    validate(filePath: string, initialState: unknown): Promise<boolean>;

    getMetadata(initialState: unknown, finalState: unknown): Record<string, unknown>;
}

/**
 * Hash-based validator that compares file hashes to detect changes
 */
export class HashValidator implements FixValidator {
    constructor(private logs: Logs) { }

    async captureInitialState(filePath: string): Promise<string> {
        return this.calculateFileHash(filePath);
    }

    async captureFinalState(filePath: string): Promise<string> {
        return this.calculateFileHash(filePath);
    }

    async validate(filePath: string, initialState: unknown): Promise<boolean> {
        const initialHash = initialState as string;
        const finalHash = await this.calculateFileHash(filePath);
        return initialHash !== finalHash;
    }

    getMetadata(initialState: unknown, finalState: unknown): Record<string, unknown> {
        const initialHash = initialState as string;
        const finalHash = finalState as string;
        return {
            initialFileHash: initialHash,
            finalFileHash: finalHash,
            hashesMatch: initialHash === finalHash
        };
    }

    private async calculateFileHash(filePath: string): Promise<string> {
        try {
            const content = await fs.promises.readFile(filePath, "utf8");
            return crypto.createHash("sha256").update(content).digest("hex");
        } catch (error) {
            this.logs.error(`[HashValidator] Failed to calculate hash for ${filePath}: ${error}`);
            throw error;
        }
    }
}