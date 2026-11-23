# Manual tests: remember scanner status across logout and restart

Branch: `other/remember-scanners-status`

## Summary of code change

Problem: the scanner on/off settings were kept in VS Code settings, but three places overrode them.

1. **IDE onboarding file** (`packages/core/src/services/ideOnboardingProperties.ts`): `getIdeOnboardingValues()` reported every scanner as OFF while signed out. That file is read by ast-cli and the Dev Assist plugin, and it is rewritten on every activation, so a logout or IDE restart overrode the user's choices.
   - **Fix:** the five scanner flags now always mirror the VS Code settings, signed in or not. Self-Healing still reports OFF while signed out.
   - **Tests:** `packages/core/src/unit/services/ideOnboardingProperties.test.ts` expects the scanner settings to be kept while signed out.
2. **Welcome page, first visit** (`packages/checkmarx/src/welcomePage/welcomeWebview.ts` and `packages/project-ignite/src/welcomePage/welcomeWebview.ts`): on the first visit, the page wrote all six scanner settings to Global, forcing them ON or OFF from the AI/MCP state and ignoring the user's choices.
   - **Fix:** `applyDefaultScannerSettingsOnce()` (`packages/core/src/utils/scannerDefaults.ts`) runs once per install, guarded by the `cxScannersInitialized` flag. When AI/MCP is enabled, it turns ON only the scanners the user has never set (checked with `config.inspect`). It never turns a scanner OFF and never changes one the user set. After that the page only reports the settings as they are.
   - **Tests:** `packages/core/src/unit/utils/scannerDefaults.test.ts`. The logout tests in `authService.test.ts` and `selfHealing.test.ts` now expect the scanners to stay ON.

Not changed: the first-visit AI Assistant write in the Checkmarx welcome page, which is a non-scanner setting.

Status: none of the changes have been run against the unit tests. The `packages/core` dependencies need private registry credentials that were not available.

## Regression (existing behavior must still work)

1. Logged in, toggle a scanner OFF in settings, restart IDE, and confirm it stays OFF in the IDE and in `~/.checkmarx/cx-onboarding-ide.properties`.
2. Sign in and confirm Self-Healing and the scanners still start from the saved settings, with no change after sign-in.
3. Sign in fresh, run the welcome page, and confirm it shows the real scanner toggles without changing any of them.
4. Scan a file with ASCA, OSS, Secrets, IaC and Containers enabled and confirm each one still reports findings.
5. Turn a scanner ON, save a file, and confirm the diagnostics appear without a restart.
6. Log in with the API key and with OAuth, and confirm MCP setup still runs and the welcome page still opens.

## Progression (new behavior works)

7. Sign out with scanners ON and confirm the properties file keeps them `true` while `cx_self_healing_enabled=false`.
8. Restart the IDE while signed out with scanners ON and confirm the file and the IDE both keep them ON.
9. Sign out and back in with a mix of scanners ON and OFF and confirm each one keeps its own value.
10. Open the welcome page on a fresh install with AI/MCP disabled and confirm no scanner setting is changed.
11. Open the welcome page on a fresh install with AI/MCP enabled and confirm every scanner turns ON. Any scanner you set beforehand keeps your value.
12. Change a scanner while signed out and confirm the properties file updates to match.
13. After the first welcome visit, turn a scanner OFF, sign out and back in, reopen the welcome page, and confirm it stays OFF.
