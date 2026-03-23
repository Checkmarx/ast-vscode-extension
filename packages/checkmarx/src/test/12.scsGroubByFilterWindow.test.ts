import {
	By,
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
	getResults,
	initialize,
	loginWithMockToken,
	logoutIfVisible,
	openDetailsFrame,
	selectDetailsTab,
	sleep,
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
	SCAN_KEY_TREE_LABEL,
	SCS_SECRET_DETECTION_Type,
} from "./utils/constants";
import { SCAN_ID } from "./utils/envs";

const SUITE_SETUP_TIMEOUT_MS = 120000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 120000;

const COMMAND_RETRIES = 3;
const INPUTBOX_RETRIES = 30;
const INPUTBOX_RETRY_DELAY_MS = 800;
const TREE_RETRIES = 30;
const TREE_RETRY_DELAY_MS = 700;
const MENU_OPEN_RETRIES = 6;

const OPEN_PICKER_DELAY_MS = 1000;
const POST_SELECTION_DELAY_MS = 2500;
const AUTH_WAIT_MS = 3000;
const MENU_REFRESH_DELAY_MS = 1000;
const MENU_TOGGLE_TIMEOUT_MS = 8000;
const LONG_TEST_TIMEOUT_MS = 300000;

const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";

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

type MenuStatus = { label: string; isActive: boolean };

describe("Secret detection results tests (OAuth flow)", () => {
	let workbench: Workbench;
	let resultsTree: CustomTreeSection;
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
				resultsTree = tree;
				return tree;
			}

			await sleep(TREE_RETRY_DELAY_MS);
		}

		throw new Error("Could not initialize Checkmarx results tree");
	}

	// Waits for InputBox to become available, retrying on transient failures.
	async function waitForInputBox(contextLabel: string): Promise<InputBox> {
		for (let attempt = 1; attempt <= INPUTBOX_RETRIES; attempt++) {
			try {
				return await InputBox.create();
			} catch {
				if (attempt < INPUTBOX_RETRIES) {
					await sleep(INPUTBOX_RETRY_DELAY_MS);
				}
			}
		}

		throw new Error(`${contextLabel} InputBox did not open in time`);
	}

	// Waits for a named tree item to appear in the results tree.
	async function waitForTreeItem(treeItemLabel: string, contextLabel: string): Promise<any> {
		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			try {
				const item = await resultsTree?.findItem(treeItemLabel);
				if (item) {
					return item;
				}
			} catch {
				// Continue retrying while tree is refreshing.
			}

			await sleep(TREE_RETRY_DELAY_MS);
		}

		throw new Error(`Could not find ${contextLabel} in results tree`);
	}

	// Opens a scan by ID using the look-for-scan command and input box.
	async function openScanById(scanId: string): Promise<void> {
		await runCommand(CX_LOOK_SCAN);
		await sleep(OPEN_PICKER_DELAY_MS);

		const input = await waitForInputBox("scan id");
		await input.setText(scanId);
		await input.confirm();
		await sleep(5000);
	}

	function normalizeMenuItemLabel(rawLabel: string): string {
		return rawLabel.replace(/\u00AD/g, "").replace(/\s+/g, " ").trim();
	}

	function parseMenuItemLabel(rawLabel: string): MenuStatus {
		const normalizedLabel = normalizeMenuItemLabel(rawLabel);
		const isActive = normalizedLabel.startsWith("\u2713 ");

		return {
			label: isActive ? normalizedLabel.slice(2).trim() : normalizedLabel,
			isActive,
		};
	}

	// Focuses the Checkmarx results panel and selects the scan root node.
	async function focusResultsPanelAndSelectScan(): Promise<void> {
		await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);

		try {
			resultsTree = await initialize();
			const scan = await resultsTree?.findItem(SCAN_KEY_TREE_LABEL);
			if (scan) {
				await scan.select();
				await sleep(300);
			}
		} catch {
			// Best-effort: continue even if focus/select fails.
		}
	}

	// Opens the "More Actions" overflow menu of the results panel.
	async function openResultsMoreActionsMenu(): Promise<any | undefined> {
		for (let attempt = 1; attempt <= MENU_OPEN_RETRIES; attempt++) {
			await focusResultsPanelAndSelectScan();

			const section = await initialize();
			if (!section) {
				await sleep(MENU_REFRESH_DELAY_MS);
				continue;
			}

			try {
				const menu = await section.moreActions();
				if (menu) {
					return menu;
				}
			} catch {
				// Retry while panel actions are still initializing.
			}

			await sleep(MENU_REFRESH_DELAY_MS);
		}

		return undefined;
	}

	// Reads the current active/inactive state of all Group By menu items.
	async function readGroupByStatuses(): Promise<MenuStatus[]> {
		const menu = await openResultsMoreActionsMenu();
		if (!menu) {
			return [];
		}

		try {
			const items = await menu.getItems();
			const statuses: MenuStatus[] = [];

			for (const item of items) {
				const parsed = parseMenuItemLabel(await item.getLabel());
				if (GROUP_BY_MENU_LABELS.includes(parsed.label)) {
					statuses.push(parsed);
				}
			}

			return statuses;
		} catch {
			return [];
		} finally {
			await menu.close().catch(() => {
				// Ignore close failures when menu auto-closes.
			});
		}
	}

	// Toggles a Group By option and confirms the state flipped.
	async function tryToggleGroupByOption(menuLabel: string): Promise<boolean> {
		const initialStatuses = await readGroupByStatuses();
		const initialEntry = initialStatuses.find((status) => status.label === menuLabel);
		if (!initialEntry) {
			return false;
		}

		const desiredState = !initialEntry.isActive;

		for (let attempt = 1; attempt <= 2; attempt++) {
			if (attempt > 1) {
				const midStatuses = await readGroupByStatuses();
				const midEntry = midStatuses.find((status) => status.label === menuLabel);
				if (midEntry && midEntry.isActive === desiredState) {
					return true;
				}
			}

			const menu = await openResultsMoreActionsMenu();
			if (!menu) {
				return false;
			}

			try {
				const items = await menu.getItems();
				let targetItem: any;

				for (const item of items) {
					const parsed = parseMenuItemLabel(await item.getLabel());
					if (parsed.label === menuLabel) {
						targetItem = item;
						break;
					}
				}

				if (!targetItem) {
					return false;
				}

				await targetItem.select();
			} catch {
				return false;
			} finally {
				await menu.close().catch(() => {
					// Ignore close failures when menu auto-closes after selection.
				});
			}

			const giveUpAt = Date.now() + MENU_TOGGLE_TIMEOUT_MS;
			while (Date.now() < giveUpAt) {
				await sleep(MENU_REFRESH_DELAY_MS);
				const latestStatuses = await readGroupByStatuses();
				const latestEntry = latestStatuses.find((status) => status.label === menuLabel);
				if (latestEntry && latestEntry.isActive === desiredState) {
					return true;
				}
			}
		}

		return false;
	}

	// Opens the state filter dropdown from the panel header.
	async function openFilterDropdownFromHeader(): Promise<any | undefined> {
		for (let attempt = 1; attempt <= MENU_OPEN_RETRIES; attempt++) {
			await focusResultsPanelAndSelectScan();

			const section = await initialize();
			if (!section) {
				await sleep(MENU_REFRESH_DELAY_MS);
				continue;
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
				await sleep(MENU_REFRESH_DELAY_MS);
				continue;
			}

			try {
				const filterMenu = await filterAction.open();
				if (filterMenu) {
					return filterMenu;
				}
			} catch {
				// Retry while panel actions are still initializing.
			}

			await sleep(MENU_REFRESH_DELAY_MS);
		}

		return undefined;
	}

	// Reads the current active/inactive state of all state filter items.
	async function readStateFilterStatuses(): Promise<MenuStatus[]> {
		const filterMenu = await openFilterDropdownFromHeader();
		if (!filterMenu) {
			return [];
		}

		try {
			const items = await filterMenu.getItems();
			const statuses: MenuStatus[] = [];

			for (const item of items) {
				const parsed = parseMenuItemLabel(await item.getLabel());
				if (STATE_FILTER_MENU_LABELS.includes(parsed.label)) {
					statuses.push(parsed);
				}
			}

			return statuses;
		} catch {
			return [];
		} finally {
			await filterMenu.close().catch(() => {
				// Ignore close failures when menu auto-closes.
			});
		}
	}

	// Toggles a state filter option and confirms the state flipped.
	async function tryToggleStateFilterOption(filterLabel: string): Promise<boolean> {
		const initialStatuses = await readStateFilterStatuses();
		const initialEntry = initialStatuses.find((status) => status.label === filterLabel);
		if (!initialEntry) {
			return false;
		}

		const desiredState = !initialEntry.isActive;

		for (let attempt = 1; attempt <= 2; attempt++) {
			if (attempt > 1) {
				const midStatuses = await readStateFilterStatuses();
				const midEntry = midStatuses.find((status) => status.label === filterLabel);
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
				let targetItem: any;

				for (const item of items) {
					const parsed = parseMenuItemLabel(await item.getLabel());
					if (parsed.label === filterLabel) {
						targetItem = item;
						break;
					}
				}

				if (!targetItem) {
					return false;
				}

				await targetItem.select();
			} catch {
				return false;
			} finally {
				await filterMenu.close().catch(() => {
					// Ignore close failures when menu auto-closes.
				});
			}

			const giveUpAt = Date.now() + MENU_TOGGLE_TIMEOUT_MS;
			while (Date.now() < giveUpAt) {
				await sleep(MENU_REFRESH_DELAY_MS);
				const latestStatuses = await readStateFilterStatuses();
				const latestEntry = latestStatuses.find((status) => status.label === filterLabel);
				if (latestEntry && latestEntry.isActive === desiredState) {
					return true;
				}
			}
		}

		return false;
	}

	// Waits until the secret detection node appears under the scan root.
	async function waitForSecretDetectionNode(scan: any): Promise<any> {
		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			try {
				const secretDetectionNode = await scan?.findChildItem(SCS_SECRET_DETECTION_Type);
				if (secretDetectionNode) {
					return secretDetectionNode;
				}
			} catch {
				// Keep retrying while tree elements are being refreshed.
			}

			await sleep(TREE_RETRY_DELAY_MS);
		}

		throw new Error("Could not find secret detection node");
	}

	// Returns individual vulnerabilities from the secret detection node with retry.
	// Uses getResults() which does a two-level expand: node → severity group → vulnerabilities.
	async function getSecretVulnerabilitiesForCurrentScan(): Promise<any[]> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			try {
				await focusResultsPanelAndSelectScan();
				const scan = await waitForTreeItem(SCAN_KEY_TREE_LABEL, `scan "${SCAN_KEY_TREE_LABEL}"`);
				await scan?.expand();
				const secretDetectionNode = await waitForSecretDetectionNode(scan);
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
		await openScanById(SCAN_ID);
		// Keep the Checkmarx results panel focused before traversing the tree.
		await focusResultsPanelAndSelectScan();

		const scan = await waitForTreeItem(SCAN_KEY_TREE_LABEL, `scan "${SCAN_KEY_TREE_LABEL}"`);
		return await waitForSecretDetectionNode(scan);
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

	before(async function () {
		this.timeout(SUITE_SETUP_TIMEOUT_MS);
		workbench = new Workbench();
		driver = VSBrowser.instance.driver;

		await loginWithMockToken(workbench, {
			executeCommandWithRetry: runCommand,
			waitMs: AUTH_WAIT_MS,
		});

		await runCommand(CX_CLEAR);
	});

	after(async function () {
		this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
		// Exit any webview frame before interacting with VS Code UI.
		try { await driver.switchTo().defaultContent(); } catch { /* ignore */ }

		try {
			await logoutIfVisible(workbench, driver, {
				executeCommandWithRetry: runCommand,
			});
		} catch {
			// Keep teardown resilient.
		}

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

	it("should toggle available Group By options for secret results", async function () {
		this.timeout(LONG_TEST_TIMEOUT_MS);

		await loadSecretDetectionNode();

		const initialStatuses = await readGroupByStatuses();
		const availableLabels = GROUP_BY_MENU_LABELS.filter((label) =>
			initialStatuses.some((status) => status.label === label)
		);

		expect(availableLabels.length, "Expected Group By options in results panel").to.be.greaterThan(0);

		const toggledLabels: string[] = [];
		let toggledCount = 0;

		try {
			for (const label of availableLabels) {
				const toggled = await tryToggleGroupByOption(label);
				if (toggled) {
					toggledLabels.push(label);
					toggledCount++;
				}
			}

			expect(toggledCount, "All available Group By options should toggle").to.equal(availableLabels.length);
		} finally {
			for (const label of toggledLabels) {
				await tryToggleGroupByOption(label).catch(() => {
					// Best-effort revert to reduce suite side effects.
				});
			}
		}
	});

	it("should toggle available State filters for secret results", async function () {
		this.timeout(LONG_TEST_TIMEOUT_MS);

		await loadSecretDetectionNode();

		const initialStatuses = await readStateFilterStatuses();
		const availableLabels = STATE_FILTER_MENU_LABELS.filter((label) =>
			initialStatuses.some((status) => status.label === label)
		);

		expect(availableLabels.length, "Expected state filter options in Filter dropdown").to.be.greaterThan(0);

		const toggledLabels: string[] = [];
		let toggledCount = 0;

		try {
			for (const label of availableLabels) {
				const toggled = await tryToggleStateFilterOption(label);
				if (toggled) {
					toggledLabels.push(label);
					toggledCount++;
				}
			}

			expect(toggledCount, "All available state filters should toggle").to.equal(availableLabels.length);
		} finally {
			for (const label of toggledLabels) {
				await tryToggleStateFilterOption(label).catch(() => {
					// Best-effort revert to reduce suite side effects.
				});
			}
		}
	});
});
