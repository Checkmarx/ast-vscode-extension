import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolves the path to the extension's media folder.
 *
 * This utility handles the case where the core package is used as a dependency
 * in extension packages (checkmarx, cx-dev-assist). It finds the extension's
 * media folder where all media files are located.
 *
 * Search order:
 * 1. Check if we're running from extension package (production/packaged)
 * 2. Check monorepo structure (development)
 * 3. Fallback to current module location
 */
export class MediaPathResolver {
    private static cachedMediaPath: string | undefined;

    /**
     * Get the absolute path to the extension's media folder
     */
    public static getCoreMediaPath(): string {
        if (this.cachedMediaPath) {
            return this.cachedMediaPath;
        }

        // Try multiple resolution strategies
        const candidates = [
            // Strategy 1: We're running from extension package (production/packaged)
            this.resolveFromExtension(),

            // Strategy 2: Monorepo development (relative to extension)
            this.resolveFromMonorepo(),

            // Strategy 3: Fallback to current module
            this.resolveFromCurrentModule(),
        ];

        for (const candidate of candidates) {
            if (candidate && fs.existsSync(candidate)) {
                this.cachedMediaPath = candidate;
                return candidate;
            }
        }

        // Fallback: return a path that will at least not crash
        // (caller should handle missing files gracefully)
        const fallback = path.join(__dirname, '..', '..', '..', '..', 'media');
        this.cachedMediaPath = fallback;
        return fallback;
    }

    /**
     * Strategy 1: Resolve from extension package
     * When running from extension: __dirname is like .../packages/checkmarx/out/node_modules/@checkmarx/vscode-core/out/utils
     * We need: .../packages/checkmarx/media
     */
    private static resolveFromExtension(): string {
        // From packages/checkmarx/out/node_modules/@checkmarx/vscode-core/out/utils
        // Go up to find packages/checkmarx/media
        let current = __dirname;

        // Try going up the directory tree to find media folder
        for (let i = 0; i < 10; i++) {
            const candidate = path.join(current, 'media');
            if (fs.existsSync(candidate)) {
                return path.resolve(candidate);
            }
            current = path.join(current, '..');
        }

        return '';
    }

    /**
     * Strategy 2: Resolve from monorepo structure
     * When running in monorepo development: packages/checkmarx/out -> packages/checkmarx/media
     */
    private static resolveFromMonorepo(): string {
        let current = __dirname;

        // Try going up the directory tree
        for (let i = 0; i < 10; i++) {
            // Check for checkmarx media
            const checkmarxMedia = path.join(current, '..', 'checkmarx', 'media');
            if (fs.existsSync(checkmarxMedia)) {
                return path.resolve(checkmarxMedia);
            }

            const igniteMedia = path.join(current, '..', 'project-ignite', 'media');
            if (fs.existsSync(igniteMedia)) {
                return path.resolve(igniteMedia);
            }

            current = path.join(current, '..');
        }

        return '';
    }

    /**
     * Strategy 3: Resolve from current module location (fallback)
     * When running from core package: __dirname is like .../packages/core/out/utils
     */
    private static resolveFromCurrentModule(): string {
        // __dirname in compiled code: packages/core/out/utils
        // Try: packages/core/media (shouldn't exist after we remove it, but keep as fallback)
        const mediaPath = path.join(__dirname, '..', '..', 'media');
        return mediaPath;
    }

    /**
     * Clear the cached path (useful for testing)
     */
    public static clearCache(): void {
        this.cachedMediaPath = undefined;
    }

    /**
     * Get a full path to a media file
     * @param relativePath - Path relative to media folder, e.g., "icons/kics.png"
     *
     * This method first tries to find the file in the extension's media folder.
     * If not found, it falls back to the core package's media folder.
     */
    public static getMediaFilePath(...pathSegments: string[]): string {
        // First try extension's media folder
        const extensionMediaPath = path.join(this.getCoreMediaPath(), ...pathSegments);
        if (fs.existsSync(extensionMediaPath)) {
            return extensionMediaPath;
        }

        // Fallback to core package's media folder
        const coreMediaPath = path.join(__dirname, '..', '..', 'media', ...pathSegments);
        if (fs.existsSync(coreMediaPath)) {
            return coreMediaPath;
        }

        // Return extension path even if it doesn't exist (for consistency)
        return extensionMediaPath;
    }
}

