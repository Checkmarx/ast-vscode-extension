import {
  By,
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
  focusResultsPanelAndSelectScan,
  initialize,
  loginWithMockToken,
  logoutIfVisible,
  pollUntil,
  readResultsMenu,
  ResultsMenu,
  toggleResultsMenuOption,
  validateRootNodeBool,
  validateSeverities,
  waitForTreeItem,
} from "./utils/utils";
import {
  CX_CLEAR,
  CX_LOOK_SCAN,
  SCAN_KEY_TREE_LABEL,
} from "./utils/constants";
import { SCAN_ID } from "./utils/envs";

const COMMAND_RETRY_DELAY_MS = 2000;
const INPUT_READY_DELAY_MS = 1000;
const SCAN_POLL_TIMEOUT_MS = 15000;
const SCAN_LOAD_TIMEOUT_MS = 120000;
const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";
// A group-by change rebuilds the whole tree; on a large real scan that takes several seconds.
const GROUP_BY_TREE_UPDATE_TIMEOUT_MS = 30000;

// Tiny sleep helper to make async test steps easier to read.
async function sleepFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("filter and groups actions tests", () => {
  let bench: Workbench;
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
    const loaded = await pollUntil(async () => {
      const scan = await (await initialize())?.findItem(SCAN_KEY_TREE_LABEL);
      await scan?.expand();
      return scan !== undefined && (await scan.getChildren()).length > 0;
    }, Boolean, SCAN_LOAD_TIMEOUT_MS);
    if (!loaded) {
      throw new Error(`Scan ${scanId} did not load into the results tree within ${SCAN_LOAD_TIMEOUT_MS} ms`);
    }
  }

  // Polls the tree until the scan root node appears, or fails.
  async function waitForScanRootItem(): Promise<any> {
    const scan = await waitForTreeItem(await initialize(), SCAN_KEY_TREE_LABEL, SCAN_POLL_TIMEOUT_MS);
    expect(scan).is.not.undefined;
    return scan;
  }

  // Throws unless a fresh menu read confirms the flip.
  async function toggleMenuOption(kind: ResultsMenu, label: string): Promise<{ before: boolean; after: boolean }> {
    const toggled = await toggleResultsMenuOption(kind, label, { refocus: false });
    if (!toggled) {
      throw new Error(`"${label}" did not flip after clicking it in the ${kind} menu`);
    }
    return toggled;
  }

  async function waitForGroupingLabels(done: (labels: string[]) => boolean): Promise<string[]> {
    return (await pollUntil(readGroupingLabels, done, GROUP_BY_TREE_UPDATE_TIMEOUT_MS)) ?? [];
  }

  /**
   * Expands the scan's first engine node and returns the sorted labels of its
   * direct children — these are the active grouping nodes (e.g. HIGH, MEDIUM
   * for severity; JavaScript for language, etc.).
   */
  async function readGroupingLabels(maxLabels = 20): Promise<string[]> {
    // Always re-acquire all tree references — never reuse stale DOM objects.
    const treeScans = await initialize();
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
      if (await pollUntil(async () => (await isSeverityShown(severityLabel)) !== before, Boolean, 15000, 500)) {
        return !before;
      }
    }
    throw new Error(`${severityLabel} filter did not change after two clicks (still ${before ? "shown" : "hidden"})`);
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
      await toggleMenuOption("More Actions", menuLabel);

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
      await toggleMenuOption("More Actions", menuLabel);
      const labelsAfterRestore = await waitForGroupingLabels((labels) => labels.join("|") === before);
      expect(
        labelsAfterRestore.join("|"),
        `${menuLabel}: grouping nodes should return after disabling group-by`
      ).to.equal(before);
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

    const currentStates = await readResultsMenu("Filter", false);

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

    const readFilterStates = async (): Promise<string[]> => {
      const menu = await readResultsMenu("Filter", false);
      return allFilterLabels.map((label) => `${label}: ${menu.find((s) => s.label === label)?.isActive}`);
    };
    const initialStates = await readFilterStates();

    for (const filterLabel of allFilterLabels) {
      await focusResultsPanelAndSelectScan();
      const firstToggle = await toggleMenuOption("Filter", filterLabel);
      const secondToggle = await toggleMenuOption("Filter", filterLabel);
      expect(
        secondToggle.before,
        `${filterLabel} should still show its flipped state when toggled back`
      ).to.equal(firstToggle.after);
    }

    expect(await readFilterStates(), "every state filter should be back to its original state").to.deep.equal(initialStates);

    // Single tree-health check is enough and avoids repeated polling overhead.
    await focusResultsPanelAndSelectScan();
    const scan = await waitForScanRootItem();
    const isValidated = await validateRootNodeBool(scan);
    expect(isValidated, "root node should be valid after all filter toggles").to.equal(true);
  });
});