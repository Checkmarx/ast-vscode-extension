# Review: remember scanner status across logout and restart

Branch: `other/remember-scanners-status`. This reviews the branch against the goal and summary in [manual-tests-scanner-status.md](manual-tests-scanner-status.md). The review aimed for completeness and no regressions.

**Result:** the onboarding-file fix is correct. The welcome-page fix goes too far and breaks first-time setup for new users. Some comments and two tests still describe the old behavior.

## Regression: new users no longer get scanners turned on

**Files:** `packages/checkmarx/src/welcomePage/welcomeWebview.ts:382` and `packages/project-ignite/src/welcomePage/welcomeWebview.ts:364`

All five scanner settings default to `false` in both extensions' `package.json`. Before this change, the first welcome visit turned every scanner ON when AI/MCP was enabled. That was how new users got scanners at all. With the write removed, a fresh install with AI enabled ends up with every scanner OFF. The welcome page then shows them OFF, and the user has to turn each one on by hand.

Test 11 in the plan ("confirm no scanner setting is changed to ON") actually locks this regression in.

The old code had two separate behaviors, and only one of them was the bug:

- **Forcing scanners ON when AI is enabled:** this is onboarding and should probably stay. The safe way is to write only settings the user has never set. `config.inspect(key)` shows that: no `globalValue`, `workspaceValue` or `workspaceFolderValue`.
- **Forcing scanners OFF when AI is disabled:** this is the real override. Removing it is right.

There's also a second reason the old code misbehaved. Both `authenticationWebview.ts` files (`checkmarx:195`, `project-ignite:117`) set `cxFirstWelcome` to `true` on every login, and nothing ever sets it back to `false`. So "first visit" really meant "every welcome page shown after a login", which is why it kept overwriting choices. Whatever you choose for onboarding, guard it with a flag that is set once, for example a new `cxScannersInitialized` key. Also, the `globalState.update("cxFirstWelcome", true)` this branch keeps on line 382 and line 364 now does nothing and can go.

**Decision needed:** what should a fresh install with AI enabled do? Recommendation: turn scanners ON only where the user has never set them.

## Not covered: comments and tests that describe the old behavior

These still say every scanner is OFF on logout:

- `packages/core/src/services/ideOnboardingProperties.ts:11-13`: the file header
- `packages/core/src/services/selfHealing.ts:841`: the `onSelfHealingLogout` comment
- `packages/core/src/services/authService.ts:616`: the comment above the logout call

These tests still check that scanners are OFF after logout:

- `packages/core/src/unit/services/authService.test.ts:436`
- `packages/core/src/unit/services/selfHealing.test.ts:752` and `:766-783`

They will probably still pass, because the mocked settings return `false` anyway. But they now test the opposite of what we want, so they can't catch the bug coming back. Change their mocks so the scanner settings return `true`, and check for `cx_*_scanner_enabled=true` alongside `cx_self_healing_enabled=false`.

## What looks right

- **The onboarding-file fix** (`getIdeOnboardingValues`): Self-Healing is now only reported ON while signed in. The scanners mirror the settings. Activation, login, logout, sign-in changes from other windows and setting changes all go through `syncIdeOnboardingProperties`, so cases 7, 8, 9 and 12 should hold.
- **The welcome-page toggle handler** (`welcomeWebview.ts:406` / `:388`): it still writes only when the user clicks a toggle, so that's fine.
- **No other overrides:** a search found no other code that writes scanner settings.

## Suggested test-plan changes

- Rewrite case 11 to match the onboarding decision.
- Add a case: on a fresh install, change a scanner yourself, sign out and back in, reopen the welcome page, and confirm the setting doesn't change.
- Add a case: in a VS Code fork, which `isSelfHealingSupportedHost` treats as unsupported, confirm the properties file is never written.

## Not verified

The unit tests were not run. The `packages/core` dependencies need private registry credentials that were not available.
