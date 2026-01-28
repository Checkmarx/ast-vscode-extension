import {
	By,
	until,
	VSBrowser,
	WebDriver,
	Workbench,
} from "vscode-extension-tester";
import { CX_CLEAR, CX_SELECT_PROJECT, CX_SELECT_BRANCH } from "./utils/constants";
import { CX_TEST_SCAN_PROJECT_NAME, SCAN_ID } from "./utils/envs";
import { retryTest, selectItem } from "./utils/utils";
import { expect } from "chai";
import { QuickPickPaginationButtons } from "@checkmarx/vscode-core/utils/common/constants";


describe("Get items with pagination", () => {
	let bench: Workbench;
	let driver: WebDriver;

	before(async function () {
		this.timeout(100000);
		bench = new Workbench();
		driver = VSBrowser.instance.driver;
	});

	after(async () => {
		await bench.executeCommand(CX_CLEAR);
	});

	it("should display pagination buttons in Project selection", retryTest(async function () {

		await bench.executeCommand(CX_SELECT_PROJECT);

		await verifyPaginationButtons(driver, QuickPickPaginationButtons.nextPage, QuickPickPaginationButtons.previousPage, false, true);

		const nextButton = await driver.wait(until.elementLocated(By.xpath(`//*[contains(@aria-label, '${QuickPickPaginationButtons.nextPage}')]`)), 10000);
		await nextButton.click();

		await verifyPaginationButtons(driver, QuickPickPaginationButtons.nextPage, QuickPickPaginationButtons.previousPage, true, false);
	}, 3));

	it("should display pagination buttons in Branch selection", retryTest(async function () {

		await bench.executeCommand(CX_SELECT_PROJECT);

		await selectItem(CX_TEST_SCAN_PROJECT_NAME);
		await bench.executeCommand(CX_SELECT_BRANCH);

		await verifyPaginationButtons(driver, QuickPickPaginationButtons.nextPage, QuickPickPaginationButtons.previousPage, false, true);

		const nextButton = await driver.wait(until.elementLocated(By.xpath(`//*[contains(@aria-label, '${QuickPickPaginationButtons.nextPage}')]`)), 10000);
		await nextButton.click();

		await verifyPaginationButtons(driver, QuickPickPaginationButtons.nextPage, QuickPickPaginationButtons.previousPage, true, false);
	}, 3));
});

async function verifyPaginationButtons(driver, nextLabel, prevLabel, isPrevExpected, isNextExpected) {
	const nextButtonExists = await driver
		.findElements(By.xpath(`//*[contains(@aria-label, '${nextLabel}')]`))
		.then(elements => elements.length > 0);
	expect(nextButtonExists, `Next button should ${isNextExpected ? '' : 'not '}be displayed`).to.equal(isNextExpected);

	const prevButtonExists = await driver
		.findElements(By.xpath(`//*[contains(@aria-label, '${prevLabel}')]`))
		.then(elements => elements.length > 0);
	expect(prevButtonExists, `Prev button should ${isPrevExpected ? '' : 'not '}be displayed`).to.equal(isPrevExpected);
}