import {
  CustomTreeSection,
  EditorView,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  focusPanelAndCollapseOthers,
  initialize,
  loginWithMockToken,
  logoutIfVisible,
  retryTest,
  sleep,
} from "./utils/utils";
import {
  CX_CLEAR,
  CX_LOOK_SCAN,
  CX_SELECT_BRANCH,
  CX_SELECT_PROJECT,
  SCAN_KEY_TREE_LABEL,
} from "./utils/constants";
import { SCAN_ID } from "./utils/envs";

// TC20: Group By selection persists when loading results for a different project.
// TC19: Group By and Filter selections survive a VS Code reload (Reload Window).
// Uses CxMock backend - no real scan. "Another project" is test-proj-3 (distinct branch list).

const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";
const RELOAD_WINDOW_COMMAND = "workbench.action.reloadWindow";

// test-proj-3 has its own branch set; select "develop" by name to skip "scan my local branch"
const OTHER_PROJECT_NAME = "test-proj-3";
const OTHER_PROJECT_BRANCH = "develop";

// the options we toggle in these tests
const GROUP_BY_LANGUAGE = "Group by: Language";
const STATE_FILTER_NOT_EXPLOITABLE = "Filter: Not Exploitable";

const SUITE_SETUP_TIMEOUT_MS = 120000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 240000;

const COMMAND_RETRY_DELAY_MS = 2000;
const INPUT_READY_DELAY_MS = 1000;
const SCAN_LOAD_DELAY_MS = 5000;
const SCAN_POLL_DELAY_MS = 500;
const SCAN_POLL_MAX_ATTEMPTS = 30;
const POST_SELECTION_DELAY_MS = 2500;
const RELOAD_SETTLE_MS = 5000;
const MENU_REFRESH_DELAY_MS = 1000;
const MENU_TOGGLE_TIMEOUT_MS = 8000;

type MenuStatus = { label: string; isActive: boolean };

describe("Group By / filter selection persistence (TC20, TC19)", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection | undefined;
  let driver: WebDriver;

  // command palette is flaky - retry a few times
  async function runCommandWithRetry(command: string, retries = 3): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await bench.executeCommand(command);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await sleep(COMMAND_RETRY_DELAY_MS);
        }
      }
    }
    throw lastError;
  }

  // loads the mock scan by id
  async function openScanById(scanId: string): Promise<void> {
    await runCommandWithRetry(CX_LOOK_SCAN);
    const input = await InputBox.create();
    await sleep(INPUT_READY_DELAY_MS);
    await input.setText(scanId);
    await input.confirm();
    await sleep(SCAN_LOAD_DELAY_MS);
  }

  // pickers populate async - poll until at least `minCount` items appear
  async function waitForQuickPicks(input: InputBox, minCount = 1, timeoutMs = 15000): Promise<any[]> {
    const deadline = Date.now() + timeoutMs;
    let picks: any[] = [];
    while (Date.now() < deadline) {
      try {
        picks = await input.getQuickPicks();
        if (picks.length >= minCount) {
          return picks;
        }
      } catch {
        // Picker still opening — retry.
      }
      await sleep(INPUT_READY_DELAY_MS);
    }
    return picks;
  }

  // exact label match to skip "scan my local branch" at the top of the Branch picker
  async function selectQuickPickByLabel(command: string, label: string): Promise<boolean> {
    await runCommandWithRetry(command);
    const input = await InputBox.create();
    await sleep(INPUT_READY_DELAY_MS);
    await input.setText(label);
    await sleep(INPUT_READY_DELAY_MS);

    const picks = await waitForQuickPicks(input);
    for (const pick of picks) {
      if ((await pick.getText()).trim() === label) {
        await pick.select();
        await sleep(POST_SELECTION_DELAY_MS);
        return true;
      }
    }
    await input.cancel().catch(() => { /* ignore */ });
    return false;
  }

  // selecting a real branch auto-loads the latest scan (no Scan picker step needed)
  async function loadResultsForProject(projectLabel: string, branchLabel: string): Promise<void> {
    const projectSelected = await selectQuickPickByLabel(CX_SELECT_PROJECT, projectLabel);
    expect(projectSelected, `Project "${projectLabel}" should be selectable`).to.be.true;

    const branchSelected = await selectQuickPickByLabel(CX_SELECT_BRANCH, branchLabel);
    expect(
      branchSelected,
      `Branch "${branchLabel}" should be selectable for project "${projectLabel}"`
    ).to.be.true;
  }

  // polls until the scan root appears
  async function waitForScanRootItem(): Promise<any> {
    treeScans = await initialize();
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

    let attempts = 0;
    while (scan === undefined && attempts < SCAN_POLL_MAX_ATTEMPTS) {
      await sleep(SCAN_POLL_DELAY_MS);
      treeScans = await initialize();
      scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
      attempts++;
    }

    expect(scan, "Scan root node should load").is.not.undefined;
    return scan;
  }

  // focus the panel and select a scan node so the header actions are available
  async function focusResultsPanelAndSelectScan(): Promise<void> {
    await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);
    try {
      treeScans = await initialize();
      const scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
      if (scan) {
        await scan.select();
        await sleep(300);
      }
    } catch {
      // Best-effort — proceed even if selection fails.
    }
  }

  // strips U+00AD padding and reads the "✓ " active marker
  function parseMenuItemLabel(rawLabel: string): MenuStatus {
    const normalizedLabel = rawLabel.replace(/­/g, "").replace(/\s+/g, " ").trim();
    const isActive = normalizedLabel.startsWith("✓ ");
    return {
      label: isActive ? normalizedLabel.slice(2).trim() : normalizedLabel,
      isActive,
    };
  }

  // ----- Group By (More Actions overflow menu) helpers ---------------------

  async function openMoreActionsMenu(): Promise<any | undefined> {
    await focusResultsPanelAndSelectScan();
    const section = await initialize();
    if (!section) {
      return undefined;
    }
    try {
      return await section.moreActions();
    } catch {
      return undefined;
    }
  }

  async function readGroupByStatuses(): Promise<MenuStatus[]> {
    const menu = await openMoreActionsMenu();
    if (!menu) {
      return [];
    }
    try {
      const items = await menu.getItems();
      const statuses: MenuStatus[] = [];
      for (const item of items) {
        const parsed = parseMenuItemLabel(await item.getLabel());
        if (parsed.label.startsWith("Group by:")) {
          statuses.push(parsed);
        }
      }
      return statuses;
    } catch {
      return [];
    } finally {
      await menu.close().catch(() => { /* menu may auto-close */ });
    }
  }

  async function isGroupByActive(menuLabel: string): Promise<boolean> {
    const statuses = await readGroupByStatuses();
    const entry = statuses.find((status) => status.label === menuLabel);
    expect(entry, `"${menuLabel}" should exist in the More Actions menu`).to.not.be.undefined;
    return entry!.isActive;
  }

  async function toggleGroupByOption(menuLabel: string): Promise<boolean> {
    const initial = await readGroupByStatuses();
    const initialEntry = initial.find((status) => status.label === menuLabel);
    if (!initialEntry) {
      return false;
    }
    const desiredState = !initialEntry.isActive;

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) {
        const mid = await readGroupByStatuses();
        const midEntry = mid.find((status) => status.label === menuLabel);
        if (midEntry && midEntry.isActive === desiredState) {
          return true;
        }
      }

      const menu = await openMoreActionsMenu();
      if (!menu) {
        return false;
      }
      try {
        const items = await menu.getItems();
        let target: any;
        for (const item of items) {
          const parsed = parseMenuItemLabel(await item.getLabel());
          if (parsed.label === menuLabel) {
            target = item;
            break;
          }
        }
        if (!target) {
          return false;
        }
        await target.select();
      } catch {
        return false;
      } finally {
        await menu.close().catch(() => { /* menu may auto-close */ });
      }

      const giveUpAt = Date.now() + MENU_TOGGLE_TIMEOUT_MS;
      while (Date.now() < giveUpAt) {
        await sleep(MENU_REFRESH_DELAY_MS);
        const latest = await readGroupByStatuses();
        const latestEntry = latest.find((status) => status.label === menuLabel);
        if (latestEntry && latestEntry.isActive === desiredState) {
          return true;
        }
      }
    }
    return false;
  }

  // ----- State filter (Filter icon dropdown) helpers -----------------------

  async function openFilterDropdownFromHeader(): Promise<any | undefined> {
    await focusResultsPanelAndSelectScan();
    const section = await initialize();
    if (!section) {
      return undefined;
    }

    let filterAction: any = await (section as any).getAction("Filter");
    if (!filterAction && typeof (section as any).getActions === "function") {
      const actions = await (section as any).getActions();
      for (const action of actions) {
        const actionLabel = `${await action.getLabel()}`.trim();
        if (/filter/i.test(actionLabel)) {
          filterAction = action;
          break;
        }
      }
    }
    if (!filterAction || typeof filterAction.open !== "function") {
      return undefined;
    }
    try {
      return await filterAction.open();
    } catch {
      return undefined;
    }
  }

  async function readStateFilterStatuses(): Promise<MenuStatus[]> {
    const filterMenu = await openFilterDropdownFromHeader();
    if (!filterMenu) {
      return [];
    }
    try {
      const items = await filterMenu.getItems();
      const statuses: MenuStatus[] = [];
      for (const item of items) {
        statuses.push(parseMenuItemLabel(await item.getLabel()));
      }
      return statuses;
    } catch {
      return [];
    } finally {
      await filterMenu.close().catch(() => { /* menu may auto-close */ });
    }
  }

  async function isStateFilterActive(filterLabel: string): Promise<boolean> {
    const statuses = await readStateFilterStatuses();
    const entry = statuses.find((status) => status.label === filterLabel);
    expect(entry, `"${filterLabel}" should exist in the Filter dropdown`).to.not.be.undefined;
    return entry!.isActive;
  }

  async function toggleStateFilter(filterLabel: string): Promise<boolean> {
    const initial = await readStateFilterStatuses();
    const initialEntry = initial.find((status) => status.label === filterLabel);
    if (!initialEntry) {
      return false;
    }
    const desiredState = !initialEntry.isActive;

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) {
        const mid = await readStateFilterStatuses();
        const midEntry = mid.find((status) => status.label === filterLabel);
        if (midEntry && midEntry.isActive === desiredState) {
          return true;
        }
      }

      const filterMenu = await openFilterDropdownFromHeader();
      if (!filterMenu) {
        return false;
      }
      try {
        const items = await filterMenu.getItems();
        let target: any;
        for (const item of items) {
          const parsed = parseMenuItemLabel(await item.getLabel());
          if (parsed.label === filterLabel) {
            target = item;
            break;
          }
        }
        if (!target) {
          return false;
        }
        await target.select();
      } catch {
        return false;
      } finally {
        await filterMenu.close().catch(() => { /* menu may auto-close */ });
      }

      const giveUpAt = Date.now() + MENU_TOGGLE_TIMEOUT_MS;
      while (Date.now() < giveUpAt) {
        await sleep(MENU_REFRESH_DELAY_MS);
        const latest = await readStateFilterStatuses();
        const latestEntry = latest.find((status) => status.label === filterLabel);
        if (latestEntry && latestEntry.isActive === desiredState) {
          return true;
        }
      }
    }
    return false;
  }

  // re-auth after reload (mock session is dropped) and reload the scan
  async function reauthenticateAndReloadScan(): Promise<void> {
    await loginWithMockToken(bench, {
      executeCommandWithRetry: runCommandWithRetry,
      waitMs: 3000,
    });
    await openScanById(SCAN_ID);
    await focusResultsPanelAndSelectScan();
  }

  before(async function () {
    this.timeout(SUITE_SETUP_TIMEOUT_MS);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    await initialize();
    await loginWithMockToken(bench, {
      executeCommandWithRetry: runCommandWithRetry,
      waitMs: 3000,
    });
    await runCommandWithRetry(CX_CLEAR);
  });

  after(async function () {
    this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
    try {
      await logoutIfVisible(bench, driver, {
        executeCommandWithRetry: runCommandWithRetry,
      });
    } catch {
      // Keep teardown resilient.
    }
    await runCommandWithRetry(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  // TC20: Group By selection should carry over when switching projects
  it(
    "should retain the Group By selection when fetching another project (TC20)",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      // Load the default project and enable a non-default grouping (Language).
      await openScanById(SCAN_ID);
      await focusResultsPanelAndSelectScan();

      let enabled = false;
      try {
        if (!(await isGroupByActive(GROUP_BY_LANGUAGE))) {
          enabled = await toggleGroupByOption(GROUP_BY_LANGUAGE);
          expect(enabled, `"${GROUP_BY_LANGUAGE}" should be toggleable on`).to.be.true;
        }
        expect(
          await isGroupByActive(GROUP_BY_LANGUAGE),
          `"${GROUP_BY_LANGUAGE}" should be active before switching projects`
        ).to.be.true;

        // Fetch results for a different project.
        await loadResultsForProject(OTHER_PROJECT_NAME, OTHER_PROJECT_BRANCH);
        await waitForScanRootItem();
        await focusResultsPanelAndSelectScan();

        // The grouping selection must have carried over to the new project.
        expect(
          await isGroupByActive(GROUP_BY_LANGUAGE),
          `"${GROUP_BY_LANGUAGE}" should remain selected after fetching another project`
        ).to.be.true;
      } finally {
        // Revert to the default grouping for later tests.
        if (await isGroupByActive(GROUP_BY_LANGUAGE).catch(() => false)) {
          await toggleGroupByOption(GROUP_BY_LANGUAGE).catch(() => { /* best-effort */ });
        }
      }
    })
  );

  // TC19: Group By selection must survive a VS Code reload
  it(
    "should persist the Group By selection after reloading VS Code (TC19)",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await openScanById(SCAN_ID);
      await focusResultsPanelAndSelectScan();

      let enabled = false;
      try {
        if (!(await isGroupByActive(GROUP_BY_LANGUAGE))) {
          enabled = await toggleGroupByOption(GROUP_BY_LANGUAGE);
          expect(enabled, `"${GROUP_BY_LANGUAGE}" should be toggleable on`).to.be.true;
        }
        expect(
          await isGroupByActive(GROUP_BY_LANGUAGE),
          `"${GROUP_BY_LANGUAGE}" should be active before reload`
        ).to.be.true;

        // reload window (restart surrogate), re-auth and reload scan
        await runCommandWithRetry(RELOAD_WINDOW_COMMAND);
        await sleep(RELOAD_SETTLE_MS);
        await reauthenticateAndReloadScan();

        expect(
          await isGroupByActive(GROUP_BY_LANGUAGE),
          `"${GROUP_BY_LANGUAGE}" should still be selected after reloading VS Code`
        ).to.be.true;
      } finally {
        if (await isGroupByActive(GROUP_BY_LANGUAGE).catch(() => false)) {
          await toggleGroupByOption(GROUP_BY_LANGUAGE).catch(() => { /* best-effort */ });
        }
      }
    })
  );

  // TC19: state filter must survive a reload; "Not Exploitable" is off by default so it's easy to verify
  it(
    "should persist a state filter selection after reloading VS Code (TC19)",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await openScanById(SCAN_ID);
      await focusResultsPanelAndSelectScan();

      let enabled = false;
      try {
        if (!(await isStateFilterActive(STATE_FILTER_NOT_EXPLOITABLE))) {
          enabled = await toggleStateFilter(STATE_FILTER_NOT_EXPLOITABLE);
          expect(enabled, `"${STATE_FILTER_NOT_EXPLOITABLE}" should be toggleable on`).to.be.true;
        }
        expect(
          await isStateFilterActive(STATE_FILTER_NOT_EXPLOITABLE),
          `"${STATE_FILTER_NOT_EXPLOITABLE}" should be active before reload`
        ).to.be.true;

        await runCommandWithRetry(RELOAD_WINDOW_COMMAND);
        await sleep(RELOAD_SETTLE_MS);
        await reauthenticateAndReloadScan();

        expect(
          await isStateFilterActive(STATE_FILTER_NOT_EXPLOITABLE),
          `"${STATE_FILTER_NOT_EXPLOITABLE}" should still be selected after reloading VS Code`
        ).to.be.true;
      } finally {
        if (await isStateFilterActive(STATE_FILTER_NOT_EXPLOITABLE).catch(() => false)) {
          await toggleStateFilter(STATE_FILTER_NOT_EXPLOITABLE).catch(() => { /* best-effort */ });
        }
      }
    })
  );
});
