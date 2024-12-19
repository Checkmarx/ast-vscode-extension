import {
	CustomTreeSection,
	EditorView,
	InputBox,
	VSBrowser,
	WebDriver,
	Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { getQuickPickSelector, initialize } from "./utils/utils";
import {
	BRANCH_KEY_TREE,
	CX_CLEAR,
	CX_SELECT_BRANCH,
	CX_SELECT_PROJECT,
	CX_SELECT_SCAN,
	PROJECT_KEY_TREE,
	SCAN_KEY_TREE_LABEL,
} from "./utils/constants";
import { CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";
import { constants } from "../utils/common/constants";
import { execSync } from "child_process";
import * as fs from "fs";


function retryTest(testFn, retries = 3) {
	return async function () {
		let lastError;
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				await testFn();
				return;
			} catch (error) {
				lastError = error;
				console.warn(`Retrying test... Attempt ${attempt} of ${retries}`);
				if (attempt === retries) {
					throw lastError;
				}
			}
		}
	};
}

function switchToBranch(branchName: string) {
	try {
		execSync(`git show-ref --verify --quiet refs/heads/${branchName}`);
		execSync(`git checkout ${branchName}`);

	} catch (error) {
		execSync(`git checkout -b ${branchName}`);
	}

}

async function sleep(ms: number) {
	return await new Promise(resolve => setTimeout(resolve, ms));
}

async function selectItem(text) {
	const input = await InputBox.create();
	await input.setText(text);
	let item = await getQuickPickSelector(input);
	await input.setText(item);
	await input.confirm();
	return item;
}

async function waitForNotificationWithTimeout(timeout) {
	let firstNotification;
	let isTimeout = false;

	const timer = setTimeout(() => {
		isTimeout = true;
	}, timeout);

	while (!firstNotification) {
		if (isTimeout) {
			break;
		}
		const resultsNotifications = await new Workbench().getNotifications();
		firstNotification = resultsNotifications[0];

		await sleep(100);
	}

	clearTimeout(timer);
	return firstNotification;
}

describe("Using a local branch if Git exists", () => {
	let bench: Workbench;
	let treeScans: CustomTreeSection;
	let driver: WebDriver;
	let originalBranch: string | undefined;
	let gitExistedBefore: boolean;

	before(async function () {
		this.timeout(300000);

		const branchName = "branch-not-exist-in-cx";
		// check if git repository exists
		try {
			execSync("git status", { stdio: "ignore" });
			originalBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
		} catch (error) {
			gitExistedBefore = false;
			execSync("git init");
			execSync("git commit --allow-empty -m 'Initial commit'");
		}
		switchToBranch(branchName);

		bench = new Workbench();
		driver = VSBrowser.instance.driver;
		await bench.executeCommand(CX_SELECT_SCAN);
	});


	after(async function () {
		if (gitExistedBefore && originalBranch) {
			switchToBranch(originalBranch);
		}
		else if (!gitExistedBefore) {
			await fs.promises.rm(".git", { recursive: true, force: true });
		}
		await new EditorView().closeAllEditors();
		await bench.executeCommand(CX_CLEAR);

	});
	it("should select project and get local branch", retryTest(async function () {
		//reload window to ensure the not exist branch is the git current branch
		await bench.executeCommand("workbench.action.reloadWindow");
		await sleep(3000);
		treeScans = await initialize();
		await bench.executeCommand(CX_SELECT_PROJECT);
		
		const projectName = await selectItem(CX_TEST_SCAN_PROJECT_NAME);
		
		let project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
		let branch = await treeScans?.findItem(BRANCH_KEY_TREE + constants.localBranch);
		expect(project, `Should select ${projectName}`).is.not.undefined;
		expect(branch, `Sould display ${constants.localBranch}`).is.not.undefined;
	}, 3));



	it("should exist local branch in branches list", retryTest(async function () {
		let treeScans = await initialize();
		await bench.executeCommand(CX_SELECT_BRANCH);
		
		const branchName = await selectItem(constants.localBranch);
		
		let branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
		expect(branch).is.not.undefined;
	}, 3));

	it("should not get a scans with local branch", retryTest(async function () {
		let treeScans = await initialize();
		let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
		expect(scan).is.undefined;

	}, 3));

	it("should run scan with local branch", retryTest(async function () {
		await bench.executeCommand("ast-results.createScan");

		const firstNotification = waitForNotificationWithTimeout(5000)
		expect(firstNotification).is.not.undefined;

	}, 3));

	it("should select project and get branch main with scan", retryTest(async function () {
		const branchName = "main";
		switchToBranch(branchName);
		await bench.executeCommand("workbench.action.reloadWindow");
		await sleep(3000);

		treeScans = await initialize();
		await bench.executeCommand(CX_SELECT_PROJECT);

		const projectName = await selectItem(CX_TEST_SCAN_PROJECT_NAME);

		let project = await treeScans?.findItem(PROJECT_KEY_TREE + projectName);
		let branch = await treeScans?.findItem(BRANCH_KEY_TREE + branchName);
		let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
		await scan?.expand();
		let scanChildren = await scan?.getChildren();
		let scanResults = await scanChildren[0].getChildren();
		expect(project).is.not.undefined;
		expect(branch).is.not.undefined;
		expect(scanResults).not.to.be.undefined;
	}, 3));

});