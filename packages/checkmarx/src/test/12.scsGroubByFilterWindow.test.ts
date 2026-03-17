import {
	By,
	CustomTreeSection,
	EditorView,
	InputBox,
	VSBrowser,
	WebDriver,
	WebView,
	Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
	focusPanelAndCollapseOthers,
	getDetailsView,
	initialize,
	loginWithMockToken,
	logoutIfVisible,
	sleep,
} from "./utils/utils";
import {
	CHANGES_LABEL,
	CX_CLEAR,
	CX_LOOK_SCAN,
	GENERAL_LABEL,
	LEARN_MORE_LABEL,
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
const QUICK_PICK_RETRIES = 20;
const QUICK_PICK_RETRY_DELAY_MS = 500;
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
	let bench: Workbench;
	let treeScans: CustomTreeSection;
	let driver: WebDriver;

	async function executeCommandWithRetry(command: string, retries = COMMAND_RETRIES): Promise<void> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				await bench.executeCommand(command);
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

	async function initializeTree(): Promise<CustomTreeSection> {
		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			const tree = await initialize();
			if (tree) {
				treeScans = tree;
				return tree;
			}

			await sleep(TREE_RETRY_DELAY_MS);
		}

		throw new Error("Could not initialize Checkmarx results tree");
	}

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

	async function waitForTreeItem(treeItemLabel: string, contextLabel: string): Promise<any> {
		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			try {
				const item = await treeScans?.findItem(treeItemLabel);
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

	async function openScanById(scanId: string): Promise<void> {
		await executeCommandWithRetry(CX_LOOK_SCAN);
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
			// Best-effort: continue even if focus/select fails.
		}
	}

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

	async function getSecretVulnerabilitiesForCurrentScan(): Promise<any[]> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			try {
				await focusResultsPanelAndSelectScan();
				const scan = await waitForTreeItem(SCAN_KEY_TREE_LABEL, `scan "${SCAN_KEY_TREE_LABEL}"`);
				const secretDetectionNode = await waitForSecretDetectionNode(scan);
				return await secretDetectionNode.getChildren();
			} catch (error) {
				lastError = error;
				if (attempt < TREE_RETRIES) {
					await sleep(TREE_RETRY_DELAY_MS);
				}
			}
		}

		throw lastError ?? new Error("Could not read secret detection vulnerabilities");
	}

	async function waitForDetailsTab(detailsView: WebView, tabId: string): Promise<any> {
		for (let attempt = 1; attempt <= QUICK_PICK_RETRIES; attempt++) {
			try {
				const tabs = await detailsView.findWebElements(By.id(tabId));
				if (tabs.length > 0) {
					return tabs[0];
				}
			} catch {
				// Continue retrying while details view is loading.
			}

			await sleep(QUICK_PICK_RETRY_DELAY_MS);
		}

		throw new Error(`Could not find details tab with id ${tabId}`);
	}

	async function clickTabByScanningIframes(tabId: string): Promise<boolean> {
		try {
			await driver.switchTo().defaultContent();
			const topLevelFrames = await driver.findElements(By.css("iframe"));

			for (const topFrame of topLevelFrames) {
				try {
					await driver.switchTo().defaultContent();
					await driver.switchTo().frame(topFrame);

					let tabs = await driver.findElements(By.id(tabId));
					if (tabs.length > 0) {
						await tabs[0].click();
						await driver.switchTo().defaultContent();
						return true;
					}

					const nestedFrames = await driver.findElements(By.css("iframe"));
					for (const nestedFrame of nestedFrames) {
						try {
							await driver.switchTo().frame(nestedFrame);
							tabs = await driver.findElements(By.id(tabId));
							if (tabs.length > 0) {
								await tabs[0].click();
								await driver.switchTo().defaultContent();
								return true;
							}
							await driver.switchTo().parentFrame();
						} catch {
							await driver.switchTo().defaultContent();
							await driver.switchTo().frame(topFrame);
						}
					}
				} catch {
					// Continue scanning other frames.
				}
			}
		} catch {
			// Continue with regular failure handling.
		} finally {
			await driver.switchTo().defaultContent().catch(() => {
				// Best-effort reset to root context.
			});
		}

		return false;
	}

	async function clickDetailsTabById(tabId: string): Promise<void> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= MENU_OPEN_RETRIES; attempt++) {
			const detailsView = await getDetailsView();
			if (detailsView) {
				try {
					const tab = await waitForDetailsTab(detailsView, tabId);
					expect(tab).to.not.be.undefined;
					await tab.click();
					return;
				} catch (error) {
					lastError = error;
				} finally {
					await detailsView.switchBack().catch(() => {
						// Best-effort cleanup if frame/context already changed.
					});
				}
			}

			const clickedViaIframeScan = await clickTabByScanningIframes(tabId);
			if (clickedViaIframeScan) {
				return;
			}

			await sleep(MENU_REFRESH_DELAY_MS);
		}

		throw lastError ?? new Error(`Could not find details tab with id ${tabId}`);
	}

	async function loadSecretDetectionNode(): Promise<any> {
		await initializeTree();
		await openScanById(SCAN_ID);
		// Keep the Checkmarx results panel focused and collapse other panels
		// before traversing the secret detection tree.
		await focusResultsPanelAndSelectScan();

		const scan = await waitForTreeItem(SCAN_KEY_TREE_LABEL, `scan "${SCAN_KEY_TREE_LABEL}"`);
		return await waitForSecretDetectionNode(scan);
	}

	async function openFirstSecretResult(): Promise<void> {
		await loadSecretDetectionNode();

		let lastError: unknown;
		for (let attempt = 1; attempt <= TREE_RETRIES; attempt++) {
			try {
				const vulnerabilities = await getSecretVulnerabilitiesForCurrentScan();
				expect(vulnerabilities.length, "Secret detection should contain at least one vulnerability").to.be.greaterThan(0);

				await vulnerabilities[0].click();
				await sleep(POST_SELECTION_DELAY_MS);
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
		bench = new Workbench();
		driver = VSBrowser.instance.driver;

		await loginWithMockToken(bench, {
			executeCommandWithRetry,
			waitMs: AUTH_WAIT_MS,
		});

		await executeCommandWithRetry(CX_CLEAR);
	});

	after(async function () {
		this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);

		try {
			await logoutIfVisible(bench, driver, {
				executeCommandWithRetry,
			});
		} catch {
			// Keep teardown resilient.
		}

		await executeCommandWithRetry(CX_CLEAR);
		await new EditorView().closeAllEditors();
	});

	it.skip("should load secret detection results from scan id", async function () {
		this.timeout(TEST_TIMEOUT_MS);

		const secretDetectionNode = await loadSecretDetectionNode();
		expect(secretDetectionNode).to.not.be.undefined;

		const vulnerabilities = await getSecretVulnerabilitiesForCurrentScan();
		expect(vulnerabilities.length, "Secret detection should contain vulnerabilities").to.be.greaterThan(0);
	});

	it.skip("should open first secret result in details view", async function () {
		this.timeout(TEST_TIMEOUT_MS);

		await openFirstSecretResult();

		const detailsView = await getDetailsView();
		expect(detailsView, "Details view should open after selecting a secret vulnerability").to.not.be.undefined;
		await detailsView.switchBack();
	});

	it.skip("should navigate all details tabs for secret result", async function () {
		this.timeout(LONG_TEST_TIMEOUT_MS);

		await openFirstSecretResult();
		await clickDetailsTabById(GENERAL_LABEL);
		await openFirstSecretResult();
		await clickDetailsTabById(LEARN_MORE_LABEL);
		await openFirstSecretResult();
		await clickDetailsTabById(CHANGES_LABEL);
	});

	it.skip("should toggle available Group By options for secret results", async function () {
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

	it.skip("should toggle available State filters for secret results", async function () {
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