import {
	By,
	EditorView,
	until,
	VSBrowser,
	WebDriver,
	Workbench,
} from "vscode-extension-tester";
import {
	CX_CLEAR,
	CX_SELECT_PROJECT,
	CX_SELECT_BRANCH,
	QuickPickPaginationButtons,
	TEN_SECONDS,
	THREE_SECONDS,
	TWO_SECONDS,
} from "./utils/constants";
import { CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";
import {
	loginWithMockToken,
	logoutIfVisible,
	retryTest,
	selectItem,
	sleep,
} from "./utils/utils";
import { expect } from "chai";

const SUITE_SETUP_TIMEOUT_MS = 100000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 60000;

describe("Get items with pagination", () => {
	let bench: Workbench;
	let driver: WebDriver;

	async function executeCommandWithRetry(command: string, retries = 3): Promise<void> {
		let lastError: unknown;
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				await bench.executeCommand(command);
				return;
			} catch (error) {
				lastError = error;
				if (attempt < retries) {
					await sleep(TWO_SECONDS);
				}
			}
		}

		throw lastError;
	}

	async function openProjectQuickPick(): Promise<void> {
		await executeCommandWithRetry(CX_SELECT_PROJECT);
	}

	async function openBranchQuickPick(projectName: string): Promise<void> {
		await openProjectQuickPick();
		await selectItem(projectName);
		await executeCommandWithRetry(CX_SELECT_BRANCH);
	}

	async function assertFirstPageButtons(): Promise<void> {
		await verifyPaginationButtons(driver, false, true);
	}

	async function assertSecondPageButtons(): Promise<void> {
		await verifyPaginationButtons(driver, true, false);
	}

	before(async function () {
		this.timeout(SUITE_SETUP_TIMEOUT_MS);
		bench = new Workbench();
		driver = VSBrowser.instance.driver;

		await loginWithMockToken(bench, {
			executeCommandWithRetry,
			waitMs: THREE_SECONDS,
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

	it("should display pagination buttons in Project selection", retryTest(async function () {
		this.timeout(TEST_TIMEOUT_MS);

		await openProjectQuickPick();

		await assertFirstPageButtons();

		await clickPaginationButton(driver, QuickPickPaginationButtons.nextPage);

		await assertSecondPageButtons();
	}, 3));

	it("should display pagination buttons in Branch selection", retryTest(async function () {
		this.timeout(TEST_TIMEOUT_MS);

		await openBranchQuickPick(CX_TEST_SCAN_PROJECT_NAME);

		await assertFirstPageButtons();

		await clickPaginationButton(driver, QuickPickPaginationButtons.nextPage);

		await assertSecondPageButtons();
	}, 3));
});

function getPaginationButtonLocator(label: QuickPickPaginationButtons): By {
	return By.xpath(`//*[contains(@aria-label, '${label}')]`);
}

async function clickPaginationButton(driver: WebDriver, label: QuickPickPaginationButtons): Promise<void> {
	const button = await driver.wait(until.elementLocated(getPaginationButtonLocator(label)), TEN_SECONDS);
	await button.click();
	await sleep(TWO_SECONDS);
}

async function isPaginationButtonVisible(driver: WebDriver, label: QuickPickPaginationButtons): Promise<boolean> {
	const elements = await driver.findElements(getPaginationButtonLocator(label));
	return elements.length > 0;
}

async function assertPaginationButtonVisibility(
	driver: WebDriver,
	label: QuickPickPaginationButtons,
	expectedVisible: boolean,
): Promise<void> {
	const buttonVisible = await isPaginationButtonVisible(driver, label);
	expect(buttonVisible, `${label} button should ${expectedVisible ? "" : "not "}be displayed`).to.equal(expectedVisible);
}

async function verifyPaginationButtons(driver: WebDriver, isPrevExpected: boolean, isNextExpected: boolean): Promise<void> {
	await assertPaginationButtonVisibility(driver, QuickPickPaginationButtons.nextPage, isNextExpected);
	await assertPaginationButtonVisibility(driver, QuickPickPaginationButtons.previousPage, isPrevExpected);
}