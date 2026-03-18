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
  validateRootNodeBool,
  validateSeverities,
} from "./utils/utils";
import {
  CX_CLEAR,
  CX_LOOK_SCAN,
  SCAN_KEY_TREE_LABEL,
} from "./utils/constants";
import { SCAN_ID } from "./utils/envs";

const COMMAND_RETRY_DELAY_MS = 2000;
const INPUT_READY_DELAY_MS = 1000;
const SCAN_POLL_DELAY_MS = 500;
const SCAN_POLL_MAX_ATTEMPTS = 30;
const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";
const FILTER_TOGGLE_REFRESH_DELAY_MS = 6000;

// Tiny sleep helper to make async test steps easier to read.
async function sleepFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("filter and groups actions tests", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection | undefined;
  let driver: WebDriver;

  // UI command execution can occasionally fail in remote/slow CI runs.
  // Retry here so individual tests stay focused on behavior, not timing noise.
  async function runCommandWithRetry(command: string, retries = 3): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await bench.executeCommand(command);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await sleepFor(COMMAND_RETRY_DELAY_MS);
        }
      }
    }

    throw lastError;
  }

  // Opens the "Look for Scan" flow and loads a specific scan id.
  async function openScanById(scanId: string): Promise<void> {
    await runCommandWithRetry(CX_LOOK_SCAN);
    const input = await InputBox.create();
    await sleepFor(INPUT_READY_DELAY_MS);
    await input.setText(scanId);
    await input.confirm();
  }

  // Polls the tree until the scan root node appears, or fails after max attempts.
  async function waitForScanRootItem(): Promise<any> {
    treeScans = await initialize();
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

    let attempts = 0;
    while (scan === undefined && attempts < SCAN_POLL_MAX_ATTEMPTS) {
      await sleepFor(SCAN_POLL_DELAY_MS);
      treeScans = await initialize();
      scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
      attempts++;
    }

    expect(scan).is.not.undefined;
    return scan;
  }

  // Keeps the Checkmarx results panel active and forces tree selection so
  // menu items gated by `view == astResults` are available.
  async function focusResultsPanelAndSelectScan(): Promise<void> {
    await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);
    try {
      treeScans = await initialize();
      const scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
      if (scan) {
        await scan.select();
        await sleepFor(300);
      }
    } catch {
      // Best-effort — proceed even if selection fails.
    }
  }

  /**
   * Opens the "More Actions..." (...) menu on the Checkmarx One Results section
   * and clicks the group-by option whose menu label matches menuLabel exactly,
   */
  async function toggleGroupByOptionFromMoreActions(menuLabel: string): Promise<void> {
    const section = await initialize();
    if (!section) {
      throw new Error("Cannot get Checkmarx One Results section");
    }
    const menu = await section.moreActions();
    if (!menu) {
      throw new Error("Could not open More Actions context menu on Checkmarx One Results");
    }
    const items = await menu.getItems();
    let target: any;
    for (const item of items) {
      // Strip invisible soft-hyphen (U+00AD) characters VS Code uses as indent
      // padding in the inactive group-by titles, then collapse extra whitespace.
      const raw = (await item.getLabel()).trim();
      const label = raw.replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();
      if (label === menuLabel || label === `\u2713 ${menuLabel}`) {
        target = item;
        break;
      }
    }
    if (!target) {
      await menu.close().catch(() => { /* ignore */ });
      throw new Error(`Group-by option "${menuLabel}" not found in More Actions menu`);
    }
    await target.select();
    await sleepFor(1500);  // Give the tree a moment to refresh after the toggle.
  }

  /**
   * Expands the scan's first engine node and returns the sorted labels of its
   * direct children — these are the active grouping nodes (e.g. HIGH, MEDIUM
   * for severity; JavaScript for language, etc.).
   */
  async function readGroupingLabels(maxLabels = 20): Promise<string[]> {
    // Always re-acquire all tree references — never reuse stale DOM objects.
    treeScans = await initialize();
    if (!treeScans) return [];

    const scan = await treeScans.findItem(SCAN_KEY_TREE_LABEL);
    if (!scan) return [];

    // Pre-expand each level manually, then wait before calling getChildren().
    // getChildren() calls expand() internally with NO wait after the click, so
    // pre-expanding + waiting ensures the DOM has rendered before the query runs.
    await scan.expand();
    await sleepFor(600);

    const engines = await scan.getChildren();
    if (!engines || engines.length === 0) return [];
    const firstEngine = engines[0]; // e.g., "sast (14)"

    await firstEngine.expand();
    await sleepFor(600);

    const level3Groups = await firstEngine.getChildren(); // e.g., HIGH, MEDIUM
    if (!level3Groups || level3Groups.length === 0) return [];

    // Expand the first severity group (HIGH) and read its children at level 4.
    // Level 4 is the layer that CHANGES when a non-severity group-by is toggled:
    //   - Toggled OFF: individual findings listed directly under HIGH.
    //   - Toggled ON:  sub-group nodes (e.g., "JavaScript", "New", "To verify").
    // These two sets of labels are always different, giving a reliable assertion.
    const firstL3 = level3Groups[0];
    await firstL3.expand();
    await sleepFor(600);
    const level4Items = await firstL3.getChildren();

    if (level4Items && level4Items.length > 0) {
      const labels: string[] = [];
      for (const item of level4Items.slice(0, maxLabels)) {
        labels.push(((await item.getLabel()) as string).trim());
      }
      return labels.sort();
    }

    // Fallback: level 4 is empty — return level-3 labels for comparison.
    const fallback: string[] = [];
    for (const item of level3Groups.slice(0, maxLabels)) {
      fallback.push(((await item.getLabel()) as string).trim());
    }
    return fallback.sort();
  }

  /**
   * Clicks a severity filter action (INFO/LOW/MEDIUM/HIGH/CRITICAL)
   * from the results panel header.
   */
  async function toggleSeverityFilterFromHeader(severityLabel: string): Promise<void> {
    await focusResultsPanelAndSelectScan();

    const section = await initialize();
    if (!section) {
      throw new Error("Cannot get Checkmarx One Results section");
    }

    let action: any = await (section as any).getAction(severityLabel);

    if (!action && typeof (section as any).getActions === "function") {
      const actions = await (section as any).getActions();
      for (const candidate of actions) {
        const label = `${await candidate.getLabel()}`.trim().toUpperCase();
        if (label === severityLabel.toUpperCase()) {
          action = candidate;
          break;
        }
      }
    }

    if (!action || typeof action.click !== "function") {
      throw new Error(`Severity action \"${severityLabel}\" was not found in the results panel header`);
    }

    await action.click();
    await sleepFor(1200);
  }

  function parseFilterMenuItemLabel(rawLabel: string): {
    bareLabel: string;
    isActive: boolean;
  } {
    // Inactive labels can include invisible soft-hyphens (U+00AD) used as visual padding.
    const normalizedLabel = rawLabel.replace(/\u00AD/g, "").replace(/\s+/g, " ").trim();
    const isActive = normalizedLabel.startsWith("\u2713 ");

    // Return:
    // - bareLabel: menu text without the checkmark prefix
    // - isActive: whether the menu item is currently selected/checked
    return {
      bareLabel: isActive ? normalizedLabel.slice(2).trim() : normalizedLabel,
      isActive,
    };
  }

  /**
   * Opens the dedicated Filter icon menu from the results panel header.
   */
  async function openFilterDropdownFromHeader(): Promise<any> {
    const section = await initialize();
    if (!section) {
      throw new Error("Cannot get Checkmarx One Results section");
    }

    let filterAction: any = await (section as any).getAction("Filter");

    // Some UI builds expose a slightly different action label. Fallback by keyword.
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
      throw new Error("Filter icon action was not found in the results panel header");
    }

    const filterMenu = await filterAction.open();
    if (!filterMenu) {
      throw new Error("Could not open Filter icon menu");
    }

    return filterMenu;
  }

  // Reads all state filter entries in one shot so tests can assert defaults.
  async function readStateFilterStatuses(): Promise<{ label: string; isActive: boolean }[]> {
    const filterMenu = await openFilterDropdownFromHeader();
    const items = await filterMenu.getItems();
    const result: { label: string; isActive: boolean }[] = [];

    for (const item of items) {
      const rawLabel = (await item.getLabel()).trim();
      const { bareLabel, isActive } = parseFilterMenuItemLabel(rawLabel);
      result.push({ label: bareLabel, isActive });
    }

    await filterMenu.close().catch(() => { /* ignore */ });
    return result;
  }

  async function isStateFilterActive(filterLabel: string): Promise<boolean> {
    await focusResultsPanelAndSelectScan();
    const currentStates = await readStateFilterStatuses();
    const entry = currentStates.find((s) => s.label === filterLabel);
    expect(entry, `${filterLabel} should exist in Filter icon menu`).to.not.be.undefined;
    return entry!.isActive;
  }

  // Clicks the named filter, waits until the menu confirms the state flipped,
  // then returns the confirmed new active state.
  // Returning the state lets callers skip a separate menu-read assertion.
  async function toggleStateFilterFromDropdown(filterLabel: string): Promise<boolean> {
    // Read the current state first so we know exactly which direction we're toggling.
    await focusResultsPanelAndSelectScan();
    const initialStates = await readStateFilterStatuses();
    const initialEntry = initialStates.find((s) => s.label === filterLabel);
    if (!initialEntry) {
      throw new Error(`State filter "${filterLabel}" not found in Filter icon menu`);
    }
    const desiredActiveState = !initialEntry.isActive;

    // Two attempts in case the click doesn't register on the first try.
    // Before the second click we check whether the first one just landed late,
    // to avoid accidentally toggling back.
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) {
        await focusResultsPanelAndSelectScan();
        const midStates = await readStateFilterStatuses();
        const midEntry = midStates.find((s) => s.label === filterLabel);
        if (midEntry && midEntry.isActive === desiredActiveState) {
          return desiredActiveState;  // First click landed late — no second click needed.
        }
      }

      // Open the dropdown and click the matching filter item.
      const filterMenu = await openFilterDropdownFromHeader();
      const items = await filterMenu.getItems();
      let targetItem: any;
      for (const item of items) {
        const rawLabel = (await item.getLabel()).trim();
        const { bareLabel } = parseFilterMenuItemLabel(rawLabel);
        if (bareLabel === filterLabel) {
          targetItem = item;
          break;
        }
      }
      if (!targetItem) {
        await filterMenu.close().catch(() => { /* ignore */ });
        throw new Error(`State filter "${filterLabel}" not found in Filter icon menu`);
      }
      await targetItem.select();

      // VS Code updates filter state asynchronously after a click. We re-open the
      // menu every second and check whether the change has appeared yet.
      // No re-focus inside the loop — the panel keeps focus after the click, and
      // removing it here saves ~1 s of overhead per check across all 9 filters.
      const giveUpAt = Date.now() + FILTER_TOGGLE_REFRESH_DELAY_MS;
      while (Date.now() < giveUpAt) {
        await sleepFor(1000);
        const latestFilterStates = await readStateFilterStatuses();
        const targetFilter = latestFilterStates.find((s) => s.label === filterLabel);
        if (targetFilter && targetFilter.isActive === desiredActiveState) {
          return desiredActiveState;  // Change confirmed — done.
        }
      }
      // Full window elapsed with no change — fall through to try clicking once more.
    }

    throw new Error(
      `Filter "${filterLabel}" did not flip to ${desiredActiveState ? "active" : "inactive"} ` +
      `after 2 click attempts.`
    );
  }

  before(async function () {
    this.timeout(100000);
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
    this.timeout(60000);
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

  it("should click on all filter severity", async function () {
    this.timeout(180000);

    await openScanById(SCAN_ID);
    const severityLabels = [
      "INFO",
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ];

    for (const severityLabel of severityLabels) {
      await toggleSeverityFilterFromHeader(severityLabel);
      const scan = await waitForScanRootItem();
      const isValidated = await validateSeverities(scan, severityLabel);

      expect(isValidated).to.equal(true);
      // Reset this severity filter before testing the next one.
      await toggleSeverityFilterFromHeader(severityLabel);
    }
  });

  it("should verify group by feature via More Actions context menu", async function () {
    this.timeout(300000);

    await openScanById(SCAN_ID);
    await focusResultsPanelAndSelectScan();

    // These are the bare menu-item labels as they appear in the ... context menu
    // (without the leading "✓ " which only appears on the currently-active option).
    const groupByMenuLabels = [
      "Group by: Language",
      "Group by: Status",
      "Group by: State",
      "Group by: Vulnerability Type",
      "Group by: File",
    ];

    for (const menuLabel of groupByMenuLabels) {
      await focusResultsPanelAndSelectScan();

      // Capture grouping labels before toggle
      const labelsBeforeToggle = await readGroupingLabels();
      expect(
        labelsBeforeToggle.length,
        `${menuLabel}: should have visible grouping nodes before toggle`
      ).to.be.greaterThan(0);

      // Toggle group-by ON via the ... context menu
      await toggleGroupByOptionFromMoreActions(menuLabel);
      await sleepFor(1000);  // Tree needs time to re-render after the group-by change.

      // Capture grouping labels after toggle — they must have changed
      const labelsAfterToggle = await readGroupingLabels();
      expect(
        labelsAfterToggle.length,
        `${menuLabel}: should have visible grouping nodes after toggle`
      ).to.be.greaterThan(0);
      expect(
        labelsAfterToggle.join("|"),
        `${menuLabel}: grouping nodes should change after enabling group-by`
      ).to.not.equal(labelsBeforeToggle.join("|"));

      // Restore — toggle the same option off
      await toggleGroupByOptionFromMoreActions(menuLabel);
      await sleepFor(1000);
    }

    // Single tree-health check at the end avoids repeated scan polling overhead.
    const scan = await waitForScanRootItem();
    const isValidated = await validateRootNodeBool(scan);
    expect(isValidated, "root node should be valid after group-by toggles").to.equal(true);
  });

  it("should verify default state filter selection from Filter icon menu", async function () {
    this.timeout(90000);

    await openScanById(SCAN_ID);
    await focusResultsPanelAndSelectScan();

    const currentStates = await readStateFilterStatuses();

    const expectedActiveFilters = [
      "Filter: Confirmed",
      "Filter: Ignored",
      "Filter: Not Ignored",
      "Filter: To Verify",
      "Filter: Urgent",
      "Filter: All Custom States",
    ];

    const expectedInactiveFilters = [
      "Filter: Not Exploitable",
      "Filter: Proposed Not Exploitable",
      "Filter: SCA Hide Dev & Test Dependencies",
    ];

    for (const label of expectedActiveFilters) {
      const entry = currentStates.find((s) => s.label === label);
      expect(entry, `${label} should exist in Filter icon menu`).to.not.be.undefined;
      expect(entry!.isActive, `${label} should be selected by default`).to.equal(true);
    }

    for (const label of expectedInactiveFilters) {
      const entry = currentStates.find((s) => s.label === label);
      expect(entry, `${label} should exist in Filter icon menu`).to.not.be.undefined;
      expect(entry!.isActive, `${label} should be unselected by default`).to.equal(false);
    }
  });

  it("should toggle all state filters from Filter icon menu", async function () {
    this.timeout(300000);

    await openScanById(SCAN_ID);
    await focusResultsPanelAndSelectScan();

    const allFilterLabels = [
      "Filter: Confirmed",
      "Filter: Ignored",
      "Filter: Not Exploitable",
      "Filter: Not Ignored",
      "Filter: Proposed Not Exploitable",
      "Filter: SCA Hide Dev & Test Dependencies",
      "Filter: To Verify",
      "Filter: Urgent",
      "Filter: All Custom States",
    ];

    for (const filterLabel of allFilterLabels) {
      const wasActive = await isStateFilterActive(filterLabel);

      // toggleStateFilterFromDropdown waits until the menu confirms the change,
      // then returns the new state — no extra menu read needed to assert the flip.
      const stateAfterFirstToggle = await toggleStateFilterFromDropdown(filterLabel);
      expect(
        stateAfterFirstToggle,
        `${filterLabel} should flip its selected state after toggle`
      ).to.equal(!wasActive);

      const stateAfterSecondToggle = await toggleStateFilterFromDropdown(filterLabel);
      expect(
        stateAfterSecondToggle,
        `${filterLabel} should return to its original selected state`
      ).to.equal(wasActive);
    }

    // Single tree-health check is enough and avoids repeated polling overhead.
    await focusResultsPanelAndSelectScan();
    const scan = await waitForScanRootItem();
    const isValidated = await validateRootNodeBool(scan);
    expect(isValidated, "root node should be valid after all filter toggles").to.equal(true);
  });
});