# Manual tests: remember scanner status across logout and restart

Branch: `other/remember-scanners-status`

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
10. Open the welcome page on a fresh install with AI/MCP disabled and confirm no scanner setting is changed to OFF.
11. Open the welcome page on a fresh install with AI/MCP enabled and confirm no scanner setting is changed to ON.
12. Change a scanner while signed out and confirm the properties file updates to match.
