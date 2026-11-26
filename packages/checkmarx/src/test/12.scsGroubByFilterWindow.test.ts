import * as fs from "fs";
import * as path from "path";
import {
	By,
	CustomTreeSection,
	EditorView,
	TextEditor,
	VSBrowser,
	WebDriver,
	Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
	ensureWorkspaceFolderOpen,
	focusResultsPanelAndSelectScan,
	getResults,
	initialize,
	loginWithMockToken,
	logoutIfVisible,
	openDetailsFrame,
	pollUntil,
	readResultsMenu,
	ResultsMenu,
	selectDetailsTab,
	sleep,
	toggleResultsMenuOption,
	waitForInputBox,
	waitForScanChild,
} from "./utils/utils";
import {
	CHANGES_LABEL,
	CHANGES_TAB_INPUT,
	CX_CLEAR,
	CX_LOOK_SCAN,
	GENERAL_LABEL,
	GENERAL_TAB_INPUT,
	LEARN_MORE_LABEL,
	LEARN_TAB_INPUT,
	RESULT_FILE_LINK,
	SCAN_KEY_TREE_LABEL,
	SCS_SECRET_DETECTION_Type,
} from "./utils/constants";
import { SECRETS_SCAN_ID } from "./utils/envs";

const SUITE_SETUP_TIMEOUT_MS = 120000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 120000;

// Matches the scan's recorded path for every secret-detection result in this
// fixture; copied into out/test/resources by the copytestproject build step.
// The only copy VS Code can find: test-vscode-settings.json excludes node_modules.
const SECRETS_FIXTURE_PATH = path.join(__dirname, "resources", "secrets.go");
// Workspace folder the test VS Code opens (packages/checkmarx).
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");

const COMMAND_RETRIES = 3;
const TREE_RETRIES = 30;
const TREE_RETRY_DELAY_MS = 700;

const OPEN_PICKER_DELAY_MS = 1000;
const POST_SELECTION_DELAY_MS = 2500;
const AUTH_WAIT_MS = 3000;
const LONG_TEST_TIMEOUT_MS = 300000;

const GROUP_BY_MENU_LABELS = [
	"Group by: Language",
	"Group by: Status",
	"Group by: State",
	"Group by: Vulnerability Type",
	"Group by: File",
	"Group by: Severity",
];

const STATE_FILTER_MENU_LABELS = [
	"Filter: Not Exploitable",
	"Filter: Proposed Not Exploitable",
	"Filter: Confirmed",
	"Filter: To Verify",
	"Filter: Urgent",
	"Filter: Not Ignored",
];

describe("Secret detection results tests (OAuth flow)", () => {
	let workbench: Workbench;
	let driver: WebDriver;

	// Retries a VS Code command up to `retries` times to absorb transient UI delays.
	async function runCommand(command: string, retries = COMMAND_RETRIES): Promise<void> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				await workbench.executeCommand(command);
				return;
			} catch (error) {
				lastError = error;
				if (attempt < retries) {
					await sleep(POST_SELECTION_DELAY_MS);
				}
			}
		}

		throw lastError;
	}

	// Retries `initialize()` until a valid tree section is returned.
	async function initializeTree(): Promise<CustomTreeSection> {
		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			const tree = await initialize();
			if (tree) {
				return tree;
			}

			await sleep(TREE_RETRY_DELAY_MS);
		}

		throw new Error("Could not initialize Checkmarx results tree");
	}

	// Opens a scan by ID using the look-for-scan command and input box.
	async function openScanById(scanId: string): Promise<void> {
		await runCommand(CX_LOOK_SCAN);
		await sleep(OPEN_PICKER_DELAY_MS);

		const input = await waitForInputBox();
		await input.setText(scanId);
		await input.confirm();
		await sleep(5000);
	}

	async function waitForSecretDetectionNode(): Promise<any> {
		const node = await waitForScanChild(await initializeTree(), SCAN_KEY_TREE_LABEL, SCS_SECRET_DETECTION_Type);
		if (!node) {
			throw new Error("Could not find secret detection node");
		}
		return node;
	}

	// Returns individual vulnerabilities from the secret detection node with retry.
	// Uses getResults() which does a two-level expand: node → severity group → vulnerabilities.
	async function getSecretVulnerabilitiesForCurrentScan(): Promise<any[]> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			try {
				await focusResultsPanelAndSelectScan();
				const secretDetectionNode = await waitForSecretDetectionNode();
				await secretDetectionNode.expand();
				await sleep(500);
				// getResults expands the first severity/type group and returns its children (actual vulnerabilities).
				return await getResults(secretDetectionNode);
			} catch (error) {
				lastError = error;
				if (attempt < TREE_RETRIES) {
					await sleep(TREE_RETRY_DELAY_MS);
				}
			}
		}

		throw lastError ?? new Error("Could not read secret detection vulnerabilities");
	}

	// Loads the scan by ID and returns the secret detection node from the results tree.
	async function loadSecretDetectionNode(): Promise<any> {
		await initializeTree();
		await openScanById(SECRETS_SCAN_ID);
		// Keep the Checkmarx results panel focused before traversing the tree.
		await focusResultsPanelAndSelectScan();

		return await waitForSecretDetectionNode();
	}

	// Loads the scan, expands the secret detection node, and clicks the first vulnerability.
	// Closes all editors first to prevent competing webviews from blocking the details panel.
	async function openFirstSecretResult(): Promise<void> {
		await loadSecretDetectionNode();

		let lastError: unknown;
		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			try {
				const vulnerabilities = await getSecretVulnerabilitiesForCurrentScan();
				expect(vulnerabilities.length, "Secret detection should contain at least one vulnerability").to.be.greaterThan(0);

				// Exit any webview iframe and close all editors before clicking to ensure
				// only one webview exists when the details panel opens.
				await driver.switchTo().defaultContent();
				await new EditorView().closeAllEditors();

				await vulnerabilities[0].click();
				// Allow the details webview panel time to open and inject its HTML content.
				await sleep(5000);
				return;
			} catch (error) {
				lastError = error;
				if (attempt < TREE_RETRIES) {
					await sleep(TREE_RETRY_DELAY_MS);
				}
			}
		}

		throw lastError ?? new Error("Could not open first secret vulnerability");
	}

	// Polls for an editor tab titled `title` to appear, instead of a fixed sleep -
	// CI runners are slower than local dev machines, so opening a file after
	// clicking the link can take longer than a fixed wait accounts for.
	async function waitForEditorTitle(title: string, timeoutMs = 20000): Promise<void> {
		const titles = await pollUntil(() => new EditorView().getOpenEditorTitles(), (open) => open.includes(title), timeoutMs, 500);
		if (titles?.includes(title)) {
			return;
		}
		// The extension reports a file it cannot locate with a "not found in workspace" toast, so
		// listing the visible toasts tells a lookup failure apart from a failed open.
		const toasts: string[] = [];
		for (const notification of await new Workbench().getNotifications().catch(() => [])) {
			toasts.push(await notification.getMessage().catch(() => "<unreadable>"));
		}
		throw new Error(
			`Timed out waiting for editor tab "${title}" to open (last seen: ${JSON.stringify(titles)}; notifications: ${JSON.stringify(toasts)})`
		);
	}

	// Selects the tab first: the status bar shows Ln/Col only for the active editor.
	async function waitForCursorLine(title: string, line: number, timeoutMs = 15000): Promise<number[]> {
		const coordinates = await pollUntil(async () => {
			for (const tab of await new EditorView().getOpenTabs()) {
				if ((await tab.getTitle()) === title) {
					await tab.select();
					return new TextEditor().getCoordinates();
				}
			}
			return undefined;
		}, (seen) => seen?.[0] === line, timeoutMs, 500);
		if (coordinates?.[0] !== line) {
			throw new Error(`Timed out waiting for cursor at line ${line} in "${title}" (last seen: ${JSON.stringify(coordinates)})`);
		}
		return coordinates;
	}

	async function toggleAvailableOptions(kind: ResultsMenu, labels: string[]): Promise<void> {
		await closeEditorsWithoutPalette();
		await loadSecretDetectionNode();

		const initialMenu = await readResultsMenu(kind);
		const states = (menu = initialMenu): string[] =>
			labels.map((label) => `${label}: ${menu.find((status) => status.label === label)?.isActive}`);
		const availableLabels = labels.filter((label) => initialMenu.some((status) => status.label === label));
		expect(availableLabels.length, `Expected options in the ${kind} menu of the results panel`).to.be.greaterThan(0);

		const toggledLabels: string[] = [];
		try {
			for (const label of availableLabels) {
				if (await toggleResultsMenuOption(kind, label)) {
					toggledLabels.push(label);
				}
			}
			expect(toggledLabels.length, `All available ${kind} options should toggle`).to.equal(availableLabels.length);
		} finally {
			for (const label of toggledLabels) {
				await toggleResultsMenuOption(kind, label).catch(() => undefined);
			}
		}
		expect(states(await readResultsMenu(kind)), `${kind} options should be back to their original state`).to.deep.equal(states());
	}

	// While any webview is open, extest opens the command palette by sending F1 to the active editor
	// tab instead of pressing Ctrl+Shift+P. On the Linux runners that keypress can be lost when the
	// details webview holds focus, and every later palette command then times out ("Waiting until
	// element is visible"), including the next suites' hooks. Closing the editors with the mouse
	// first leaves no webview, so the palette opens with the normal shortcut.
	async function closeEditorsWithoutPalette(): Promise<void> {
		try { await driver.switchTo().defaultContent(); } catch { /* not in a frame */ }
		try {
			await new EditorView().closeAllEditors();
		} catch (error) {
			console.log(`[ui-tests] Could not close all editors: ${String(error).slice(0, 200)}`);
		}
	}

	before(async function () {
		this.timeout(SUITE_SETUP_TIMEOUT_MS);
		driver = VSBrowser.instance.driver;
		// The file-link tests resolve the result's path against the workspace folder. Opening it
		// reloads the window, so do it before anything else in this suite.
		await ensureWorkspaceFolderOpen(WORKSPACE_ROOT);
		workbench = new Workbench();

		await loginWithMockToken(workbench, {
			executeCommandWithRetry: runCommand,
			waitMs: AUTH_WAIT_MS,
		});

		await runCommand(CX_CLEAR);
	});

	after(async function () {
		this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
		// Close the details webview before any palette command (see closeEditorsWithoutPalette).
		await closeEditorsWithoutPalette();

		try {
			await logoutIfVisible(workbench, driver, {
				executeCommandWithRetry: runCommand,
			});
		} catch {
			// Keep teardown resilient.
		}

		// logout opened the authentication webview; close it before the palette again
		await closeEditorsWithoutPalette();
		await runCommand(CX_CLEAR);
		await new EditorView().closeAllEditors();
	});

	// Loads the scan and verifies the secret detection node with vulnerabilities is present.
	it("should load secret detection results from scan id", async function () {
		this.timeout(TEST_TIMEOUT_MS);

		const secretDetectionNode = await loadSecretDetectionNode();
		expect(secretDetectionNode).to.not.be.undefined;

		const vulnerabilities = await getSecretVulnerabilitiesForCurrentScan();
		expect(vulnerabilities.length, "Secret detection should contain vulnerabilities").to.be.greaterThan(0);
	});

	// Clicks the first secret vulnerability and confirms the details webview opens.
	it("should open first secret result in details view", async function () {
		this.timeout(TEST_TIMEOUT_MS);

		await openFirstSecretResult();
		// Allow the details webview panel time to open and inject its HTML content.
		await sleep(5000);

		const isOpen = await openDetailsFrame(driver);
		expect(isOpen, "Details view should open after selecting a secret vulnerability").to.be.true;

		await driver.switchTo().defaultContent();
	});

	// Opens the details panel once, then navigates General → Description → Changes tabs and
	// verifies each tab's label element is present.
	it("should navigate all details tabs for secret result", async function () {
		this.timeout(LONG_TEST_TIMEOUT_MS);

		// Open vulnerability and wait for details panel.
		await openFirstSecretResult();
		await sleep(3000);

		const isOpen = await openDetailsFrame(driver);
		expect(isOpen, "Vulnerability details panel did not open").to.be.true;

		// General tab.
		await selectDetailsTab(driver, GENERAL_TAB_INPUT);
		const generalLabel = await driver.findElement(By.id(GENERAL_LABEL));
		expect(generalLabel, "General tab label not found").to.not.be.undefined;

		// Description tab.
		await selectDetailsTab(driver, LEARN_TAB_INPUT);
		const learnLabel = await driver.findElement(By.id(LEARN_MORE_LABEL));
		expect(learnLabel, "Description tab label not found").to.not.be.undefined;

		// Changes tab.
		await selectDetailsTab(driver, CHANGES_TAB_INPUT);
		const changesLabel = await driver.findElement(By.id(CHANGES_LABEL));
		expect(changesLabel, "Changes tab label not found").to.not.be.undefined;

		await driver.switchTo().defaultContent();
	});

	// TC84: a local fixture file (secrets.go) matches the scan's recorded path, so
	// clicking the link should open the real file and land on the correct line.
	it("should open the correct file at the correct line when the file path link is clicked", async function () {
		this.timeout(TEST_TIMEOUT_MS);

		await openFirstSecretResult();
		await sleep(3000);

		const isOpen = await openDetailsFrame(driver);
		expect(isOpen, "Vulnerability details panel did not open").to.be.true;

		await selectDetailsTab(driver, GENERAL_TAB_INPUT);

		const fileLink = await driver.findElement(By.className(RESULT_FILE_LINK));
		expect(fileLink, "Clickable file path link not found on General tab").to.not.be.undefined;
		const filename = await fileLink.getAttribute("data-filename");
		const expectedLine = Number(await fileLink.getAttribute("data-line"));
		expect(filename, "File path link should carry the scan's recorded file path").to.equal("/secrets.go");

		await fileLink.click();
		await driver.switchTo().defaultContent();
		await waitForEditorTitle("secrets.go");

		const coordinates = await waitForCursorLine("secrets.go", expectedLine);
		expect(coordinates[0], "Cursor should land on the result's recorded line").to.equal(expectedLine);
	});

	// TC86: verify the not-found path is still exercised for real - temporarily
	// rename the fixture file out of the way so the file genuinely doesn't exist.
	it("should show a not-found error when the file no longer exists in the workspace", async function () {
		this.timeout(TEST_TIMEOUT_MS);

		await openFirstSecretResult();
		await sleep(3000);

		// Drop toasts left by earlier tests: an earlier click that failed to find the file shows
		// the same "not found in workspace" message, which would let this test pass on its own.
		await driver.switchTo().defaultContent();
		const center = await new Workbench().openNotificationsCenter();
		await center.clearAllNotifications();
		await center.close();

		const isOpen = await openDetailsFrame(driver);
		expect(isOpen, "Vulnerability details panel did not open").to.be.true;

		await selectDetailsTab(driver, GENERAL_TAB_INPUT);
		const fileLink = await driver.findElement(By.className(RESULT_FILE_LINK));
		expect(fileLink, "Clickable file path link not found on General tab").to.not.be.undefined;

		fs.renameSync(SECRETS_FIXTURE_PATH, `${SECRETS_FIXTURE_PATH}.bak`);
		try {
			await fileLink.click();
			await driver.switchTo().defaultContent();

			// Other toasts (e.g. "Successfully authenticated") can be shown at the same time, so
			// look for the not-found message among all of them rather than taking the first one.
			const seen = new Set<string>();
			const found = await pollUntil(async () => {
				for (const notification of await new Workbench().getNotifications()) {
					const text = await notification.getText().catch(() => "");
					if (text.includes("not found in workspace")) {
						return true;
					}
					seen.add(text);
				}
				return false;
			}, Boolean, 10000, 500);
			expect(found, `Expected a "not found in workspace" notification. Seen: ${[...seen].join(" | ") || "none"}`).to.be.true;
		} finally {
			fs.renameSync(`${SECRETS_FIXTURE_PATH}.bak`, SECRETS_FIXTURE_PATH);
		}
	});

	// TC87: each result's file-path link must navigate to its own correct line in the
	// real file, not a stale or shared value left over from a previously opened one.
	it("should navigate to the correct line for different vulnerabilities in the same file", async function () {
		this.timeout(LONG_TEST_TIMEOUT_MS);

		await loadSecretDetectionNode();
		const vulnerabilities = await getSecretVulnerabilitiesForCurrentScan();
		if (vulnerabilities.length < 2) {
			this.skip();
		}

		async function openAndVerify(vulnItem: any): Promise<{ filename: string; line: string }> {
			await driver.switchTo().defaultContent();
			await new EditorView().closeAllEditors();
			await vulnItem.click();
			await sleep(5000);

			const isOpen = await openDetailsFrame(driver);
			expect(isOpen, "Vulnerability details panel did not open").to.be.true;
			await selectDetailsTab(driver, GENERAL_TAB_INPUT);

			const fileLink = await driver.findElement(By.className(RESULT_FILE_LINK));
			const filename = await fileLink.getAttribute("data-filename");
			const line = await fileLink.getAttribute("data-line");

			await fileLink.click();
			await driver.switchTo().defaultContent();
			await waitForEditorTitle("secrets.go");

			const coordinates = await waitForCursorLine("secrets.go", Number(line));
			expect(coordinates[0], `Cursor should land on line ${line}`).to.equal(Number(line));

			return { filename, line };
		}

		const first = await openAndVerify(vulnerabilities[0]);
		const second = await openAndVerify(vulnerabilities[1]);

		expect(
			first.filename === second.filename && first.line === second.line,
			"Each result should carry its own file/line, not a shared or stale value"
		).to.be.false;
	});

	it("should toggle available Group By options for secret results", async function () {
		this.timeout(LONG_TEST_TIMEOUT_MS);
		await toggleAvailableOptions("More Actions", GROUP_BY_MENU_LABELS);
	});

	it("should toggle available State filters for secret results", async function () {
		this.timeout(LONG_TEST_TIMEOUT_MS);
		await toggleAvailableOptions("Filter", STATE_FILTER_MENU_LABELS);
	});
});
