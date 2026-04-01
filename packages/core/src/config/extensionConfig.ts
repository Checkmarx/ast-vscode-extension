/**
 * Extension Configuration
 * Allows dynamic configuration of extension-specific settings
 */

/** Extension type constants */
export const EXTENSION_TYPE = {
    CHECKMARX: 'checkmarx' as const,
    DEVELOPER_ASSIST: 'cx-dev-assist' as const,
} as const;

export type ExtensionType = typeof EXTENSION_TYPE[keyof typeof EXTENSION_TYPE];

export interface ExtensionConfig {
    extensionId: string;

    /** Command prefix for all commands (e.g., 'ast-results', 'cx-dev-assist') */
    commandPrefix: string;

    /** View container ID prefix */
    viewContainerPrefix: string;

    /** Display name of the extension */
    displayName: string;

    /** Extension type */
    extensionType: ExtensionType;
}

let currentConfig: ExtensionConfig | null = null;

/**
 * Set the extension configuration
 * Must be called during extension activation before any command registration
 */
export function setExtensionConfig(config: ExtensionConfig): void {
    if (currentConfig) {
        console.warn('[ExtensionConfig] Configuration already set. Overwriting...');
    }
    currentConfig = config;
    console.log(`[ExtensionConfig] Configuration set for: ${config.displayName} (${config.extensionId})`);
}

/**
 * Get the current extension configuration
 * Throws error if configuration is not set
 */
export function getExtensionConfig(): ExtensionConfig {
    if (!currentConfig) {
        throw new Error(
            '[ExtensionConfig] Extension configuration not set. Call setExtensionConfig() during activation.',
        );
    }
    return currentConfig;
}

/**
 * Get the command prefix
 */
export function getCommandPrefix(): string {
    return getExtensionConfig().commandPrefix;
}

/**
 * Get the extension ID
 */
export function getExtensionId(): string {
    return getExtensionConfig().extensionId;
}

/**
 * Get the extension type
 */
export function getExtensionType(): ExtensionType {
    return getExtensionConfig().extensionType;
}

/**
 * Check if configuration is set
 */
export function isConfigured(): boolean {
    return currentConfig !== null;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetExtensionConfig(): void {
    currentConfig = null;
}

