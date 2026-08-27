import {
  By,
  CustomTreeSection,
  EditorView,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
  focusPanelAndCollapseOthers,
  initializeSCA,
  loginWithMockToken,
  logoutIfVisible,
  retryTest,
  sleep,
} from "./utils/utils";
import { CX_CLEAR, CX_SCA_CLEAR, CX_SCA_SCAN } from "./utils/constants";

/**
 * SCA Real-Time Scanner module (Regression Test Plan - VS Code Plugin):
 *   TC60 - Clicking the Play button on the SCA Real-Time Scanner initiates a scan
 *          and results populate in the SCA Realtime panel.
 *   TC61 - The results are grouped by severity (Critical / High / Medium / Low).
 *   TC63 - The vulnerability detail panel header shows CVE/Cx ID, severity,
 *          manifest file and package name.
 *   TC66 - The vulnerability detail panel shows the CVSS metrics.
 *
 * Why this suite needs an open project
 * ------------------------------------
 * Unlike the "Checkmarx One Results" tests (which load a scan by ID), the SCA
 * Real-Time Scanner scans the OPEN workspace: createSCAScan reads
 * workspace.workspaceFolders[0] and runs only if the folder has files. The UI
 * tests open `packages/checkmarx` as the workspace (see its .vscode/settings.json),
 * so that requirement is already met - no extra fixture is needed. Under the mock
 * CLI cx.scaScanCreate returns one deterministic finding regardless of the actual
 * manifest content:
 *   package "decode-uri-component" in "package.json", HIGH severity,
 *   CVE-2022-38900, CVSS v2 score 7.5 (Attack Vector NETWORK, Complexity LOW).
 *
 * How the pieces map to the UI
 * ----------------------------
 * - Play button  -> command "ast-results: Run SCA Realtime Scan" (createSCAScan).
 * - Results tree -> "Checkmarx SCA Realtime Scanner" panel, grouped
 *   fileName -> severity -> vulnerability (SCAResultsProvider.activeGroupBy).
 * - Detail panel -> selecting a leaf fires newDetails(result, "realtime"), which
 *   renders the SCA webview (<body class="body-sca">) with the triage tab omitted.
 */

const SCA_PANEL_TITLE = "Checkmarx SCA Realtime Scanner";

// SCA details panel markers (shared with the SCA webview - see details.ts scaHeader()/scaContent()).
const SCA_BODY_SELECTOR = "body.body-sca";
const SCA_HEADER_TITLE_CLASS = "header-title"; // result label, e.g. "CVE-2022-38900 (package.json)"
const SCA_HEADER_NAME_CLASS = "header-name";   // package identifier, e.g. "decode-uri-component"
const SCA_CVSS_BUTTON_CLASS = "cvss-button-selected";
const SCA_SCORE_CARD_CLASS = "score-card";

// The results root and the severity buckets the tree may render.
const SCA_RESULTS_ROOT_LABEL = "Vulnerabilities";
const SEVERITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

// Placeholder shown while the scan is in progress (messages.scaScanning). The
// realtime scan first walks the whole workspace (findFiles "**"), so this row can
// stay up for a while - we wait until it disappears before reading results.
const SCA_SCANNING_LABEL = "Scanning project for vulnerabilities";
// Terminal outcome rows shown once the scan finishes.
const SCA_NO_VULNS_LABEL = "Checkmarx found no vulnerabilities";

const SUITE_SETUP_TIMEOUT_MS = 360000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 300000;
// The realtime scan can be slow on a large workspace; give it plenty of headroom.
const SCAN_RESULT_TIMEOUT_MS = 240000;
const SCANNING_POLL_INTERVAL_MS = 2000;

type TreeSnapshot = { labels: string[]; leaves: { item: any; label: string; depth: number }[] };

describe("SCA Real-Time Scanner (TC60, TC61, TC63, TC66)", () => {
  let workbench: Workbench;
  let driver: WebDriver;

  // Retries a VS Code command to absorb transient command-palette delays.
  async function runCommand(command: string, retries = 3): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await workbench.executeCommand(command);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retries) await sleep(2000);
      }
    }
    throw lastError;
  }

  // Walks the SCA tree depth-first, expanding every node, and records each
  // label plus the leaf nodes (with their depth). Leaves deep in the tree are
  // the clickable vulnerabilities; the shallow leaves are the status/summary rows.
  async function collectTree(items: any[], snapshot: TreeSnapshot, depth = 0): Promise<void> {
    for (const item of items) {
      let label = "";
      try {
        label = await item.getLabel();
      } catch {
        continue;
      }
      snapshot.labels.push(label);

      let children: any[] = [];
      try {
        await item.expand();
        await sleep(250);
        children = await item.getChildren();
      } catch {
        // Leaf or transiently unavailable - treat as leaf.
      }

      if (children && children.length > 0) {
        await collectTree(children, snapshot, depth + 1);
      } else {
        snapshot.leaves.push({ item, label, depth });
      }
    }
  }

  // Cheap read of just the SCA panel's top-level row labels (no expansion). Used to
  // poll the scan state without repeatedly walking the whole tree.
  async function readScaTopLevelLabels(): Promise<string[]> {
    await focusPanelAndCollapseOthers(SCA_PANEL_TITLE);
    const tree: CustomTreeSection = await initializeSCA();
    if (!tree) {
      return [];
    }
    const items = await tree.getVisibleItems();
    const labels: string[] = [];
    for (const item of items) {
      try {
        labels.push(await item.getLabel());
      } catch {
        // Row was re-rendered mid-read - ignore and let the next poll catch it.
      }
    }
    return labels;
  }

  // Blocks until the scan finishes, i.e. the "Scanning project for vulnerabilities..."
  // placeholder is gone and the panel shows a terminal outcome (the "Vulnerabilities"
  // results root, or the "no vulnerabilities" message). The realtime scan walks the
  // whole workspace first, so this can take a while - hence the generous timeout.
  // Returns the final top-level row labels.
  async function waitUntilScanningFinished(timeoutMs: number): Promise<string[]> {
    const giveUpAt = Date.now() + timeoutMs;
    let lastLabels: string[] = [];
    while (Date.now() < giveUpAt) {
      lastLabels = await readScaTopLevelLabels();
      const stillScanning = lastLabels.some((label) => label.includes(SCA_SCANNING_LABEL));
      const hasOutcome = lastLabels.some(
        (label) => label.includes(SCA_RESULTS_ROOT_LABEL) || label.includes(SCA_NO_VULNS_LABEL)
      );

      // Done only once the "Scanning..." row is gone and a real outcome is shown.
      if (!stillScanning && hasOutcome) {
        return lastLabels;
      }
      await sleep(SCANNING_POLL_INTERVAL_MS);
    }
    throw new Error(
      `SCA Real-Time scan never cleared "${SCA_SCANNING_LABEL}". Last panel rows: ${JSON.stringify(lastLabels)}`
    );
  }

  // Waits for the scan to finish (see above), then expands the tree into a snapshot.
  async function waitForScaResultsSnapshot(timeoutMs: number): Promise<TreeSnapshot> {
    const finalLabels = await waitUntilScanningFinished(timeoutMs);
    expect(
      finalLabels.some((label) => label.includes(SCA_RESULTS_ROOT_LABEL)),
      `SCA Real-Time scan finished without vulnerabilities. Panel rows: ${JSON.stringify(finalLabels)}`
    ).to.be.true;

    const tree: CustomTreeSection = await initializeSCA();
    const snapshot: TreeSnapshot = { labels: [], leaves: [] };
    await collectTree(await tree.getVisibleItems(), snapshot);
    return snapshot;
  }

  // The clickable vulnerability is the deepest leaf (fileName -> severity ->
  // vulnerability); the status/summary rows sit at the top level.
  function getDeepestVulnerabilityLeaf(snapshot: TreeSnapshot): { item: any; label: string } {
    expect(snapshot.leaves.length, "SCA tree should contain leaf nodes").to.be.greaterThan(0);
    const deepest = snapshot.leaves.reduce((a, b) => (b.depth > a.depth ? b : a));
    expect(deepest.depth, "A nested vulnerability leaf should exist under severity grouping").to.be.greaterThan(0);
    return deepest;
  }

  // Enters the nested webview iframes of the SCA details panel and leaves the
  // driver inside its content frame. The panel is identified by <body class="body-sca">.
  async function enterScaDetailsFrame(): Promise<boolean> {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        await driver.switchTo().defaultContent();
        const readyFrames = await driver.findElements(By.css(".webview.ready"));
        const framesToCheck = readyFrames.length > 0
          ? readyFrames
          : await driver.findElements(By.css(".webview"));
        for (const webviewFrame of framesToCheck) {
          try {
            await driver.switchTo().defaultContent();
            await driver.switchTo().frame(webviewFrame);
            const contentFrame = await driver.findElement(By.css("#active-frame"));
            await driver.switchTo().frame(contentFrame);
            await driver.findElement(By.css(SCA_BODY_SELECTOR));
            return true;
          } catch {
            await driver.switchTo().defaultContent();
          }
        }
      } catch { /* outer frame lookup failed — retry */ }
      await sleep(1000);
    }
    return false;
  }

  // Reads the full visible text of the SCA details panel body (used for substring
  // assertions on CVSS metric labels/values). Must run inside the details frame.
  async function getScaDetailsBodyText(): Promise<string> {
    const body = await driver.findElement(By.css(SCA_BODY_SELECTOR));
    return (await body.getText()).trim();
  }

  // Opens the detail panel for the first SCA Real-Time vulnerability and returns
  // its tree label. Editors are closed first so the details webview is the only
  // one present when we search for its frame.
  async function openScaVulnerabilityDetails(): Promise<string> {
    const snapshot = await waitForScaResultsSnapshot(SCAN_RESULT_TIMEOUT_MS);
    const leaf = getDeepestVulnerabilityLeaf(snapshot);

    await driver.switchTo().defaultContent();
    await new EditorView().closeAllEditors();
    await leaf.item.click();
    await sleep(5000);

    const isOpen = await enterScaDetailsFrame();
    expect(isOpen, "SCA Real-Time vulnerability details panel did not open").to.be.true;
    await driver.switchTo().defaultContent();
    return leaf.label;
  }

  // Authenticate, clear state and trigger the Real-Time scan once for the suite.
  before(async function () {
    this.timeout(SUITE_SETUP_TIMEOUT_MS);
    workbench = new Workbench();
    driver = VSBrowser.instance.driver;

    await loginWithMockToken(workbench, { executeCommandWithRetry: runCommand, waitMs: 3000 });
    await runCommand(CX_SCA_CLEAR);
    await runCommand(CX_CLEAR);

    // Click the Play button (Run SCA Realtime Scan) and wait for results to load.
    await focusPanelAndCollapseOthers(SCA_PANEL_TITLE);
    await runCommand(CX_SCA_SCAN);
    await waitForScaResultsSnapshot(SCAN_RESULT_TIMEOUT_MS);
  });

  // Clear the SCA tree, logout and close editors so nothing leaks into later suites.
  after(async function () {
    this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
    try { await driver.switchTo().defaultContent(); } catch { /* ignore */ }
    try {
      await runCommand(CX_SCA_CLEAR);
      await logoutIfVisible(workbench, driver, { executeCommandWithRetry: runCommand });
    } catch {
      // Keep teardown resilient.
    }
    await runCommand(CX_CLEAR);
    await new EditorView().closeAllEditors();
  });

  // TC60: the Play button initiates a scan that completes and populates results.
  it(
    "TC60 - should initiate a scan and populate results in the SCA Real-Time panel",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      const snapshot = await waitForScaResultsSnapshot(SCAN_RESULT_TIMEOUT_MS);

      // The results root must be present and at least one vulnerability leaf below it.
      expect(
        snapshot.labels.some((label) => label.includes(SCA_RESULTS_ROOT_LABEL)),
        "SCA Real-Time panel should show the Vulnerabilities results node after scanning"
      ).to.be.true;

      const deepest = getDeepestVulnerabilityLeaf(snapshot);
      expect(deepest.label, "A scanned vulnerability leaf should be present").to.not.be.empty;
    }, 2)
  );

  // TC61: scanned results are grouped under a severity bucket (Critical/High/Medium/Low).
  it(
    "TC61 - should group SCA Real-Time results by severity",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      const snapshot = await waitForScaResultsSnapshot(SCAN_RESULT_TIMEOUT_MS);

      const severityNodes = snapshot.labels.filter((label) =>
        SEVERITY_LEVELS.includes(label.trim().toUpperCase())
      );
      expect(
        severityNodes.length,
        `Results should be grouped under a severity level, but tree had: ${JSON.stringify(snapshot.labels)}`
      ).to.be.greaterThan(0);
    }, 2)
  );

  // TC63: the detail panel header shows CVE/Cx ID, manifest file, package name and severity.
  it(
    "TC63 - should show CVE/Cx ID, severity, manifest file and package name in the detail header",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await driver.switchTo().defaultContent();
      const vulnLabel = await openScaVulnerabilityDetails();

      // header-title carries the result label, which includes the CVE/Cx ID and manifest.
      const headerTitle = (await driver.findElement(By.className(SCA_HEADER_TITLE_CLASS)).then((e) => e.getText())).trim();
      expect(headerTitle, "Header title should reference the selected vulnerability").to.contain(vulnLabel);

      // The label is "<CVE/Cx ID> (<manifest file>)" - assert both parts are shown.
      const manifestMatch = vulnLabel.match(/\(([^()]+)\)\s*$/);
      const cveOrId = vulnLabel.split(" (")[0].trim();
      expect(cveOrId, "CVE/Cx ID should be present in the header").to.not.be.empty;
      expect(headerTitle, "CVE/Cx ID should be displayed").to.contain(cveOrId);
      if (manifestMatch) {
        expect(headerTitle, "Manifest file should be displayed in the header").to.contain(manifestMatch[1]);
      }

      // header-name carries the package identifier.
      const packageName = (await driver.findElement(By.className(SCA_HEADER_NAME_CLASS)).then((e) => e.getText())).trim();
      expect(packageName, "Package name should be displayed in the header").to.not.be.empty;

      // Severity must be shown (the CVSS score card renders the severity label).
      const bodyText = await getScaDetailsBodyText();
      const hasSeverity = SEVERITY_LEVELS.some((level) => bodyText.toUpperCase().includes(level));
      expect(hasSeverity, "Severity should be displayed in the detail panel").to.be.true;

      await driver.switchTo().defaultContent();
    }, 2)
  );

  // TC66: the detail panel shows the CVSS metrics (version button, score card, score, vector).
  it(
    "TC66 - should display the CVSS metrics in the detail panel",
    retryTest(async function () {
      this.timeout(TEST_TIMEOUT_MS);

      await driver.switchTo().defaultContent();
      await openScaVulnerabilityDetails();

      // CVSS version button (e.g. "CVSS 2").
      const cvssButton = await driver.findElement(By.className(SCA_CVSS_BUTTON_CLASS));
      expect((await cvssButton.getText()).trim(), "CVSS version button should be labelled 'CVSS'").to.contain("CVSS");

      // The score card with the numeric CVSS score.
      const scoreCards = await driver.findElements(By.className(SCA_SCORE_CARD_CLASS));
      expect(scoreCards.length, "CVSS score card should be present").to.be.greaterThan(0);

      // The metric breakdown (score value + Attack Vector) should render.
      const bodyText = await getScaDetailsBodyText();
      expect(bodyText, "CVSS score card should show a Score").to.contain("Score");
      expect(bodyText, "CVSS metrics should include the Attack Vector").to.contain("Attack Vector");

      await driver.switchTo().defaultContent();
    }, 2)
  );
});
