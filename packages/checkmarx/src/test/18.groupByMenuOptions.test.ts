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
  SCAN_KEY_TREE_LABEL,
} from "./utils/constants";
import { SCAN_ID } from "./utils/envs";

// TC15: Group By options appear in the correct order (Severity, Vulnerability Type,
//       State, Status, Language, File, Direct Dependency).
// TC23: Disabling "Group by: Severity" changes how the tree is grouped.
// TC16: Groupings nest in the selected order (Severity stays outermost by default).
//
// Driven through the "..." overflow menu. No real scan - uses the in-memory CxMock.

const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";

const SUITE_SETUP_TIMEOUT_MS = 120000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 180000;

const COMMAND_RETRY_DELAY_MS = 2000;
const INPUT_READY_DELAY_MS = 1000;
const SCAN_LOAD_DELAY_MS = 5000;
const SCAN_POLL_DELAY_MS = 500;
const SCAN_POLL_MAX_ATTEMPTS = 30;
const TREE_SETTLE_MS = 600;
const MENU_REFRESH_DELAY_MS = 1000;
const MENU_TOGGLE_TIMEOUT_MS = 8000;

// labels shown under an engine node when grouped by severity
const SEVERITY_BUCKET_LABELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

// Expected group-by order, exactly as fixed by the package.json sort keys.
const EXPECTED_GROUP_BY_ORDER = [
  "Group by: Severity",
  "Group by: Vulnerability Type",
  "Group by: State",
  "Group by: Status",
  "Group by: Language",
  "Group by: File",
  "Group by: Direct Dependency",
];

// core options (everything except the SCA-only "Direct Dependency")
const CORE_GROUP_BY_OPTIONS = [
  "Group by: Severity",
  "Group by: Vulnerability Type",
  "Group by: State",
  "Group by: Status",
  "Group by: Language",
  "Group by: File",
];

type MenuStatus = { label: string; isActive: boolean };

describe("Group By menu options (TC15, TC23, TC16)", () => {
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

    expect(scan, "Scan root node should load after opening the scan").is.not.undefined;
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

  // strips U+00AD padding VS Code injects and reads the "✓ " active marker
  function parseMenuItemLabel(rawLabel: string): MenuStatus {
    const normalizedLabel = rawLabel.replace(/­/g, "").replace(/\s+/g, " ").trim();
    const isActive = normalizedLabel.startsWith("✓ ");
    return {
      label: isActive ? normalizedLabel.slice(2).trim() : normalizedLabel,
      isActive,
    };
  }

  // opens the "..." overflow menu
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

  // reads group-by entries from the overflow menu
  async function readGroupByStatusesInOrder(): Promise<MenuStatus[]> {
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
      await menu.close().catch(() => {
        // Ignore close failures when the menu auto-closes.
      });
    }
  }

  // toggles a group-by option and waits for the state to flip
  async function toggleGroupByOption(menuLabel: string): Promise<boolean> {
    const initial = await readGroupByStatusesInOrder();
    const initialEntry = initial.find((status) => status.label === menuLabel);
    if (!initialEntry) {
      return false;
    }
    const desiredState = !initialEntry.isActive;

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) {
        const mid = await readGroupByStatusesInOrder();
        const midEntry = mid.find((status) => status.label === menuLabel);
        if (midEntry && midEntry.isActive === desiredState) {
          return true; // First click landed late — no second click needed.
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
        await menu.close().catch(() => {
          // Ignore close failures when the menu auto-closes after selection.
        });
      }

      const giveUpAt = Date.now() + MENU_TOGGLE_TIMEOUT_MS;
      while (Date.now() < giveUpAt) {
        await sleep(MENU_REFRESH_DELAY_MS);
        const latest = await readGroupByStatusesInOrder();
        const latestEntry = latest.find((status) => status.label === menuLabel);
        if (latestEntry && latestEntry.isActive === desiredState) {
          return true;
        }
      }
    }
    return false;
  }

  // returns direct children of the first engine node (severity buckets when grouped by severity)
  async function readFirstEngineChildLabels(): Promise<string[]> {
    treeScans = await initialize();
    if (!treeScans) {
      return [];
    }
    const scan = await treeScans.findItem(SCAN_KEY_TREE_LABEL);
    if (!scan) {
      return [];
    }
    await scan.expand();
    await sleep(TREE_SETTLE_MS);

    const engines = await scan.getChildren();
    if (!engines || engines.length === 0) {
      return [];
    }
    const firstEngine = engines[0];
    await firstEngine.expand();
    await sleep(TREE_SETTLE_MS);

    const children = await firstEngine.getChildren();
    const labels: string[] = [];
    for (const child of children ?? []) {
      labels.push(((await child.getLabel()) as string).trim());
    }
    return labels;
  }

  // returns second-level grouping labels (one level under the first severity bucket)
  async function readSecondLevelGroupingLabels(): Promise<string[]> {
    treeScans = await initialize();
    if (!treeScans) {
      return [];
    }
    const scan = await treeScans.findItem(SCAN_KEY_TREE_LABEL);
    if (!scan) {
      return [];
    }
    await scan.expand();
    await sleep(TREE_SETTLE_MS);

    const engines = await scan.getChildren();
    if (!engines || engines.length === 0) {
      return [];
    }
    await engines[0].expand();
    await sleep(TREE_SETTLE_MS);

    const firstGroup = (await engines[0].getChildren())?.[0];
    if (!firstGroup) {
      return [];
    }
    await firstGroup.expand();
    await sleep(TREE_SETTLE_MS);

    const deeper = await firstGroup.getChildren();
    const labels: string[] = [];
    for (const child of deeper ?? []) {
      labels.push(((await child.getLabel()) as string).trim());
    }
    return labels;
  }

  function isSeverityBucketSet(labels: string[]): boolean {
    if (labels.length === 0) {
      return false;
    }
    return labels.every((label) =>
      SEVERITY_BUCKET_LABELS.includes(label.toUpperCase())
    );
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

  // TC15: options must be in order; compare on the present subset (Direct Dependency may be absent)
  it(
    "should list Group By options in the expected order (TC15)",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await openScanById(SCAN_ID);
      await focusResultsPanelAndSelectScan();

      const observed = (await readGroupByStatusesInOrder()).map((s) => s.label);
      expect(observed.length, "Group By options should be present in the menu").to.be.greaterThan(0);

      // Every core option must be offered.
      for (const option of CORE_GROUP_BY_OPTIONS) {
        expect(
          observed.includes(option),
          `Group By menu should offer "${option}", but saw: ${JSON.stringify(observed)}`
        ).to.be.true;
      }

      // entries must follow the canonical order for whatever's present
      const expectedForObserved = EXPECTED_GROUP_BY_ORDER.filter((option) =>
        observed.includes(option)
      );
      expect(
        observed,
        `Group By options should appear in the order ${JSON.stringify(expectedForObserved)}`
      ).to.deep.equal(expectedForObserved);
    })
  );

  // TC23: disabling Severity grouping should change the engine's direct children
  it(
    "should stop grouping by severity when 'Group by: Severity' is disabled (TC23)",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await openScanById(SCAN_ID);
      await focusResultsPanelAndSelectScan();

      // By default the tree is grouped by severity.
      const labelsGroupedBySeverity = await readFirstEngineChildLabels();
      expect(
        isSeverityBucketSet(labelsGroupedBySeverity),
        `By default the engine's children should be severity buckets, ` +
        `but were: ${JSON.stringify(labelsGroupedBySeverity)}`
      ).to.be.true;

      let disabled = false;
      try {
        disabled = await toggleGroupByOption("Group by: Severity");
        expect(disabled, "'Group by: Severity' should be toggleable off").to.be.true;
        await sleep(MENU_REFRESH_DELAY_MS);

        const labelsWithoutSeverity = await readFirstEngineChildLabels();
        // grouping must change and top level must no longer be severity buckets
        expect(
          labelsWithoutSeverity.join("|"),
          "Disabling Group by: Severity should change the grouping nodes"
        ).to.not.equal(labelsGroupedBySeverity.join("|"));
        expect(
          isSeverityBucketSet(labelsWithoutSeverity),
          `With severity grouping off the children should not be severity buckets, ` +
          `but were: ${JSON.stringify(labelsWithoutSeverity)}`
        ).to.be.false;
      } finally {
        // Restore the default so later tests start from a known state.
        if (disabled) {
          await toggleGroupByOption("Group by: Severity").catch(() => {
            // Best-effort revert.
          });
        }
      }
    })
  );

  // TC16: Severity stays outermost; adding State should introduce a sub-grouping beneath it
  it(
    "should group in the selected order when an extra Group By option is added (TC16)",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await openScanById(SCAN_ID);
      await focusResultsPanelAndSelectScan();

      // Default grouping: Severity at the top level.
      const topLevelLabels = await readFirstEngineChildLabels();
      expect(
        isSeverityBucketSet(topLevelLabels),
        `Severity should be the outermost grouping by default, ` +
        `but the top level was: ${JSON.stringify(topLevelLabels)}`
      ).to.be.true;

      // Children one level deeper, before adding the extra grouping.
      const deeperBefore = await readSecondLevelGroupingLabels();

      let enabled = false;
      try {
        enabled = await toggleGroupByOption("Group by: State");
        expect(enabled, "'Group by: State' should be toggleable on").to.be.true;
        await sleep(MENU_REFRESH_DELAY_MS);

        // Severity must still be the outermost grouping (it is selected first).
        const topLevelAfter = await readFirstEngineChildLabels();
        expect(
          isSeverityBucketSet(topLevelAfter),
          `Severity should remain the outermost grouping after adding State, ` +
          `but the top level was: ${JSON.stringify(topLevelAfter)}`
        ).to.be.true;

        // State sub-grouping should now appear under each severity
        const deeperAfter = await readSecondLevelGroupingLabels();
        expect(
          deeperAfter.join("|"),
          "Adding Group by: State should introduce a deeper grouping level under severity"
        ).to.not.equal(deeperBefore.join("|"));
      } finally {
        // Restore the default grouping for the next test/suite.
        if (enabled) {
          await toggleGroupByOption("Group by: State").catch(() => {
            // Best-effort revert.
          });
        }
      }
    })
  );
});
