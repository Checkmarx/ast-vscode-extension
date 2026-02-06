import { ExTester, ReleaseQuality, VSBrowser } from 'vscode-extension-tester';

const testExtensionsDir = 'out/test/';
const vscodeVersion: ReleaseQuality = ReleaseQuality.Insider;
const tester: ExTester = new ExTester(undefined, vscodeVersion, testExtensionsDir);

// Configure VSBrowser with longer default timeout for CI environments
before(async function () {
	this.timeout(120000);
	const browser = VSBrowser.instance;
	// Set default timeout to 30 seconds for finding elements
	await browser.driver.manage().setTimeouts({ implicit: 30000 });
});

tester.setupAndRunTests(testExtensionsDir);