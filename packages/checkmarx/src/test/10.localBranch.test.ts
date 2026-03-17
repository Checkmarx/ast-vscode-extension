import {
	CustomTreeSection,
	EditorView,
	VSBrowser,
	WebDriver,
	Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
	initialize,
	loginWithMockToken,
	logoutIfVisible,
	retryTest,
	selectItem,
	sleep,
	waitForNotificationWithTimeout,
} from "./utils/utils";
import {
	BRANCH_KEY_TREE,
	CX_CLEAR,
	CX_SELECT_BRANCH,
	CX_SELECT_PROJECT,
	CX_SELECT_SCAN,
	FIVE_SECONDS,
	LOCAL_BRANCH_CONSTANT,
	MESSAGES,
	PROJECT_KEY_TREE,
	SCAN_KEY_TREE_LABEL,
	THREE_SECONDS,
	TWO_SECONDS,
} from "./utils/constants";
import { CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";
import { execSync } from "child_process";
import * as fs from "fs";

const SUITE_SETUP_TIMEOUT_MS = 300000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;

// Checks out an existing local branch, or creates and switches to it if missing.
function switchToBranch(branchName: string): void {
	try {
		execSync(`git show-ref --verify --quiet refs/heads/${branchName}`);
		execSync(`git checkout ${branchName}`);
	} catch {
		execSync(`git checkout -b ${branchName}`);
	}
}

describe("Using a local branch if Git exists", () => {
	let bench: Workbench;
	let treeScans: CustomTreeSection;
	let driver: WebDriver;
	// Tracks prior git state so the after() hook can restore it cleanly.
	let originalBranch: string | undefined;
	let gitExistedBefore: boolean;

	// Runs a VS Code command with retries to handle transient UI delays.
	async function runCommandWithRetry(command: string, retries = 3): Promise<void> {
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

	// Saves git state, switches to a non-existent remote branch, logs in, and opens the scan picker.
	before(async function () {
		this.timeout(SUITE_SETUP_TIMEOUT_MS);

		const testBranchName = "branch-not-exist-in-cx";

		// Record existing git state so after() can restore it.
		try {
			execSync("git status", { stdio: "ignore" });
			gitExistedBefore = true;
			originalBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
		} catch {
			gitExistedBefore = false;
			execSync("git init");
			execSync("git commit --allow-empty -m 'Initial commit'");
		}
		switchToBranch(testBranchName);

		bench = new Workbench();
		driver = VSBrowser.instance.driver;

		await loginWithMockToken(bench, {
			executeCommandWithRetry: runCommandWithRetry,
			waitMs: THREE_SECONDS,
		});
		await runCommandWithRetry(CX_SELECT_SCAN);
	});


	// Restores the git branch, logs out, and clears the VS Code scan state.
	after(async function () {
		this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);

		if (gitExistedBefore && originalBranch) {
			switchToBranch(originalBranch);
		} else if (!gitExistedBefore) {
			await fs.promises.rm(".git", { recursive: true, force: true });
		}

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
	it("should select project and get local branch", retryTest(async function () {
		// Reload the window so the extension picks up the newly switched branch.
		await runCommandWithRetry("workbench.action.reloadWindow");
		await sleep(THREE_SECONDS);
		treeScans = await initialize();
		await runCommandWithRetry(CX_SELECT_PROJECT);

		const projectName = await selectItem(CX_TEST_SCAN_PROJECT_NAME);

		const project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
		const branch = await treeScans?.findItem(BRANCH_KEY_TREE + LOCAL_BRANCH_CONSTANT);
		expect(project, `Should select ${projectName}`).is.not.undefined;
		expect(branch, `Should display ${LOCAL_BRANCH_CONSTANT}`).is.not.undefined;
	}, 3));



	it.skip("should exist local branch in branches list", retryTest(async function () {
		const treeScans = await initialize();
		await runCommandWithRetry(CX_SELECT_BRANCH);

		const branchName = await selectItem(LOCAL_BRANCH_CONSTANT);

		const branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
		expect(branch).is.not.undefined;
	}, 3));

	it.skip("should not get a scans with local branch", retryTest(async function () {
		const treeScans = await initialize();
		const scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
		expect(scan).is.undefined;
	}, 3));

	it.skip("should run scan with local branch", retryTest(async function () {
		await runCommandWithRetry("ast-results.createScan");

		let firstNotification = await waitForNotificationWithTimeout(FIVE_SECONDS);
		const message = await firstNotification?.getMessage();
		if (message === MESSAGES.scanProjectNotMatch) {
			const actions = await firstNotification?.getActions();
			await actions[0].click();
			firstNotification = await waitForNotificationWithTimeout(FIVE_SECONDS);
		}
		expect(firstNotification).is.not.undefined;
	}, 3));

	it.skip("should select project and get branch main with scan", retryTest(async function () {
		const branchName = "main";
		switchToBranch(branchName);
		await runCommandWithRetry("workbench.action.reloadWindow");
		await sleep(THREE_SECONDS);

		treeScans = await initialize();
		await runCommandWithRetry(CX_SELECT_PROJECT);

		const projectName = await selectItem(CX_TEST_SCAN_PROJECT_NAME);

		const project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
		const branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
		const scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
		await scan?.expand();
		const scanChildren = await scan?.getChildren();
		const scanResults = await scanChildren[0].getChildren();
		expect(project).is.not.undefined;
		expect(branch).is.not.undefined;
		expect(scanResults).not.to.be.undefined;
	}, 3));
});
