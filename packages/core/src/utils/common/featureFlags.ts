/**
 * Feature flags utility for development-only features.
 * 
 * Features are controlled via the CX_FEATURE_FLAGS environment variable,
 * which should be set in .vscode/launch.json for local development.
 * 
 * Usage:
 *   import { isFeatureEnabled } from './utils/common/featureFlags';
 *   
 *   if (isFeatureEnabled('CX_MY_FEATURE')) {
 *     // Show the feature
 *   }
 */

const FEATURE_FLAGS_ENV_VAR = 'CX_FEATURE_FLAGS';

export const DAST_ENABLED = 'CX_DAST_ENABLED';

let cachedFlags: Set<string> | null = null;

function getFeatureFlags(): Set<string> {
  if (cachedFlags === null) {
    const flagsString = process.env[FEATURE_FLAGS_ENV_VAR] || '';
    cachedFlags = new Set(
      flagsString
        .split(',')
        .map(flag => flag.trim())
        .filter(flag => flag.length > 0)
    );
  }
  return cachedFlags;
}

/**
 * Check if a feature flag is enabled.
 * @param featureName - The name of the feature to check
 * @returns true if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(featureName: string): boolean {
  return getFeatureFlags().has(featureName);
}

/**
 * Get all enabled feature flags.
 * @returns Array of enabled feature flag names
 */
export function getEnabledFeatures(): string[] {
  return Array.from(getFeatureFlags());
}

