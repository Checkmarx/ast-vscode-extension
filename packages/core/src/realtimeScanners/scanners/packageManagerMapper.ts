/**
 * Package Manager Mapper
 *
 * Maps new package manager names to legacy names supported by Checkmarx remediation tools.
 *
 * This mapper handles the conversion of package manager names returned by ast-cli
 * (gradle, sbt, cocoapods, carthage) to the legacy names expected by the
 * Checkmarx remediation API (mvn, swift).
 */

/**
 * Maps new package manager names to legacy names supported by remediation tools.
 *
 * Mapping rules:
 * - gradle → mvn
 * - sbt → mvn
 * - cocoapods → swift
 * - carthage → swift
 * - all others → unchanged
 *
 * @param packageManager the package manager name (e.g., "gradle", "npm", "cocoapods")
 * @returns the mapped package manager name, or the original if no mapping exists
 */
export function mapPackageManagerToRemediationFormat(packageManager: string | undefined): string | undefined {
    if (!packageManager) {
        return packageManager;
    }

    const lowerCase = packageManager.toLowerCase();

    switch (lowerCase) {
        case "gradle":
        case "sbt":
            return "mvn";
        case "cocoapods":
        case "carthage":
            return "swift";
        default:
            return packageManager;
    }
}
