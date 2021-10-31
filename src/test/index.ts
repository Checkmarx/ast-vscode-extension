import { ExTester, ReleaseQuality } from 'vscode-extension-tester';

const testExtensionsDir: string = 'out/test/';
const vscodeVersion: ReleaseQuality = ReleaseQuality.Insider;
const tester: ExTester = new ExTester(undefined, vscodeVersion, testExtensionsDir);
tester.setupAndRunTests(testExtensionsDir);