import {
  By,
  CustomTreeSection,
  EditorView,
  InputBox,
  ViewPanelAction,
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
const SCAN_LOAD_TIMEOUT_MS = 120000;
const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";
const FILTER_TOGGLE_REFRESH_DELAY_MS = 6000;
const GROUP_BY_TOGGLE_CONFIRM_TIMEOUT_MS = 8000;
const GROUP_BY_TOGGLE_POLL_DELAY_MS = 500;
// A group-by change rebuilds the whole tree; on a large real scan that takes several seconds.
const GROUP_BY_TREE_UPDATE_TIMEOUT_MS = 30000;

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
  // Loads the scan and waits until its results are in the tree. Clearing first removes the
  // previous test's Scan node, so the wait cannot be satisfied by the old tree; against a real
  // tenant loading a large scan takes a while and the tree re-renders when it finishes.
  async function openScanById(scanId: string): Promise<void> {
    await runCommandWithRetry(CX_CLEAR);
    await runCommandWithRetry(CX_LOOK_SCAN);
    const input = await InputBox.create();
    await sleepFor(INPUT_READY_DELAY_MS);
    await input.setText(scanId);
    await input.confirm();

    // Collapse the other Checkmarx panels first: with them open the results panel is a few
    // rows tall, the Scan node sits clipped at its bottom edge and expand() is not interactable.
    await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);
    const deadline = Date.now() + SCAN_LOAD_TIMEOUT_MS;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        const section = await initialize();
        const scan = await section?.findItem(SCAN_KEY_TREE_LABEL);
        if (scan) {
          await scan.expand();
          if ((await scan.getChildren()).length > 0) {
            return;
          }
        }
      } catch (err) {
        // tree re-rendered while reading; retry
        lastError = err;
      }
      await sleepFor(1000);
    }
    throw new Error(
      `Scan ${scanId} did not load into the results tree within ${SCAN_LOAD_TIMEOUT_MS} ms` +
        (lastError ? ` (last error: ${lastError})` : "")
    );
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

  // Opens the More Actions menu and reads whether menuLabel is currently
  // active (checkmark-prefixed), returning undefined if it isn't found.
  async function readGroupByOptionActive(menuLabel: string): Promise<boolean | undefined> {
    const section = await initialize();
    if (!section) {
      throw new Error("Cannot get Checkmarx One Results section");
    }
    const menu = await section.moreActions();
    if (!menu) {
      throw new Error("Could not open More Actions context menu on Checkmarx One Results");
    }

    try {
      const items = await menu.getItems();
      for (const item of items) {
        // Strip invisible soft-hyphen (U+00AD) characters VS Code uses as indent
        // padding in the inactive group-by titles, then collapse extra whitespace.
        const raw = (await item.getLabel()).trim();
        const label = raw.replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();
        if (label === menuLabel) {
          return false;
        }
        if (label === `\u2713 ${menuLabel}`) {
          return true;
        }
      }
      return undefined;
    } finally {
      await menu.close().catch(() => {
        // Ignore close failures when menu auto-closes.
      });
    }
  }

  /**
   * Opens the "More Actions..." (...) menu on the Checkmarx One Results section
   * and clicks the group-by option whose menu label matches menuLabel exactly,
   * then polls until the menu itself confirms the toggle applied. Without this
   * confirmation, a slow CI render can leave the tree still grouped by this
   * option when the test (or a later test file sharing the same VS Code
   * session) moves on, breaking any direct child-node lookup downstream.
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
    let desiredActive = false;
    for (const item of items) {
      const raw = (await item.getLabel()).trim();
      const label = raw.replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();
      if (label === menuLabel || label === `\u2713 ${menuLabel}`) {
        target = item;
        // Read the current state from this same menu open: toggling flips it.
        desiredActive = label === menuLabel;
        break;
      }
    }
    if (!target) {
      await menu.close().catch(() => { /* ignore */ });
      throw new Error(`Group-by option "${menuLabel}" not found in More Actions menu`);
    }
    await target.select();
    await menu.close().catch(() => {
      // Ignore close failures when menu auto-closes.
    });

    const giveUpAt = Date.now() + GROUP_BY_TOGGLE_CONFIRM_TIMEOUT_MS;
    while (Date.now() < giveUpAt) {
      await sleepFor(GROUP_BY_TOGGLE_POLL_DELAY_MS);
      const latestActive = await readGroupByOptionActive(menuLabel);
      if (latestActive === desiredActive) {
        return;
      }
    }

    throw new Error(
      `Group-by option "${menuLabel}" did not flip to ${desiredActive ? "active" : "inactive"} ` +
      `after toggling from the More Actions menu.`
    );
  }

  /**
   * Polls readGroupingLabels() until `done` accepts the labels or the timeout passes, and
   * returns the last labels read. Reads that hit the tree mid-rebuild (stale or detached
   * elements) are retried, since a group-by toggle re-renders every node.
   */
  async function waitForGroupingLabels(
    done: (labels: string[]) => boolean,
    timeoutMs = GROUP_BY_TREE_UPDATE_TIMEOUT_MS
  ): Promise<string[]> {
    const deadline = Date.now() + timeoutMs;
    let labels: string[] = [];
    for (;;) {
      try {
        labels = await readGroupingLabels();
        if (done(labels)) {
          return labels;
        }
      } catch {
        // Tree re-rendered while reading; read again.
      }
      if (Date.now() >= deadline) {
        return labels;
      }
      await sleepFor(1000);
    }
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
  async function findSeverityAction(severityLabel: string): Promise<ViewPanelAction> {
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
    return action as ViewPanelAction;
  }

  // Whether results of this severity are shown. Each click swaps the header button between the
  // "...Untoggle" command (icon <severity>_untoggle.svg, results shown) and the "...Toggle" one
  // (<severity>_toggle.svg, results hidden); both are labelled with the severity name.
  async function isSeverityShown(severityLabel: string): Promise<boolean> {
    const action = await findSeverityAction(severityLabel);
    const icon = await action.findElement(By.css(".action-label")).catch(() => action);
    const style = `${await icon.getAttribute("style")}`.toLowerCase();
    if (!style.includes(`${severityLabel.toLowerCase()}_`)) {
      throw new Error(`Cannot read the ${severityLabel} filter state from its icon (style: ${style})`);
    }
    return style.includes("_untoggle.svg");
  }

  // Clicks the severity button and waits until its icon shows the flipped state. A click can be
  // lost while the panel re-renders; a second click is made only after a fresh read shows the
  // state is still unchanged, so it can never undo a click that did land.
  async function toggleSeverityFilterFromHeader(severityLabel: string): Promise<boolean> {
    await focusResultsPanelAndSelectScan();
    const before = await isSeverityShown(severityLabel);

    for (let attempt = 1; attempt <= 2; attempt++) {
      await (await findSeverityAction(severityLabel)).click();
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        await sleepFor(500);
        try {
          if ((await isSeverityShown(severityLabel)) !== before) {
            return !before;
          }
        } catch {
          // Header re-rendered while reading - read again.
        }
      }
    }
    throw new Error(`${severityLabel} filter did not change after two clicks (still ${before ? "shown" : "hidden"})`);
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

  // Clicks the named filter, waits until the menu confirms the state flipped, and returns
  // the state read before the click together with the confirmed new state, so callers
  // don't need a separate menu read (each read opens and closes the menu).
  async function toggleStateFilterFromDropdown(
    filterLabel: string,
    // State already confirmed by the caller (e.g. by the previous toggle); skips one menu read.
    knownActive?: boolean
  ): Promise<{ before: boolean; after: boolean }> {
    // Read the current state first so we know exactly which direction we're toggling.
    let initialEntry: { label: string; isActive: boolean } | undefined;
    if (knownActive === undefined) {
      await focusResultsPanelAndSelectScan();
      const initialStates = await readStateFilterStatuses();
      initialEntry = initialStates.find((s) => s.label === filterLabel);
    } else {
      initialEntry = { label: filterLabel, isActive: knownActive };
    }
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
          return { before: initialEntry.isActive, after: desiredActiveState };  // First click landed late — no second click needed.
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
          return { before: initialEntry.isActive, after: desiredActiveState };  // Change confirmed — done.
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
    this.timeout(300000); // 10 header toggles + 5 full-tree checks; ~2 min on a 4k-result real scan, 180 s was too tight

    await openScanById(SCAN_ID);
    const severityLabels = [
      "INFO",
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ];

    for (const severityLabel of severityLabels) {
      expect(await isSeverityShown(severityLabel), `${severityLabel} results should be shown before filtering`).to.equal(true);
      expect(await toggleSeverityFilterFromHeader(severityLabel), `${severityLabel} filter should switch to hidden`).to.equal(false);
      const scan = await waitForScanRootItem();
      const isValidated = await validateSeverities(scan, severityLabel);

      expect(isValidated, `${severityLabel} results should be hidden from every engine`).to.equal(true);
      // Reset this severity filter before testing the next one.
      expect(await toggleSeverityFilterFromHeader(severityLabel), `${severityLabel} filter should switch back to shown`).to.equal(true);
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
      const labelsBeforeToggle = await waitForGroupingLabels((labels) => labels.length > 0);
      expect(
        labelsBeforeToggle.length,
        `${menuLabel}: should have visible grouping nodes before toggle`
      ).to.be.greaterThan(0);

      // Toggle group-by ON via the ... context menu
      await toggleGroupByOptionFromMoreActions(menuLabel);

      // Capture grouping labels after toggle — they must have changed. Wait for the
      // rebuilt tree rather than a fixed delay: the rebuild time depends on the scan size.
      const before = labelsBeforeToggle.join("|");
      const labelsAfterToggle = await waitForGroupingLabels(
        (labels) => labels.length > 0 && labels.join("|") !== before
      );
      expect(
        labelsAfterToggle.length,
        `${menuLabel}: should have visible grouping nodes after toggle`
      ).to.be.greaterThan(0);
      expect(
        labelsAfterToggle.join("|"),
        `${menuLabel}: grouping nodes should change after enabling group-by`
      ).to.not.equal(labelsBeforeToggle.join("|"));

      // Restore — toggle the same option off, and wait for the original grouping so the
      // next option starts from the same tree.
      await toggleGroupByOptionFromMoreActions(menuLabel);
      await waitForGroupingLabels((labels) => labels.join("|") === before);
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
    this.timeout(480000); // 18 toggles, each rebuilding the tree; ~17 s each on a large real scan

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
      // The toggle reads the state before clicking and confirms the new one, so no
      // extra menu read is needed to assert the flip.
      const firstToggle = await toggleStateFilterFromDropdown(filterLabel);
      const wasActive = firstToggle.before;
      expect(
        firstToggle.after,
        `${filterLabel} should flip its selected state after toggle`
      ).to.equal(!wasActive);

      const secondToggle = await toggleStateFilterFromDropdown(filterLabel, firstToggle.after);
      expect(
        secondToggle.after,
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