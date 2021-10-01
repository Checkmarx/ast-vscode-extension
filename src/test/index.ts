import { ExTester } from 'vscode-extension-tester';

const testExtensionsDir: string = 'out/test/vscodeUiTest/extensions';
const tester: ExTester = new ExTester(undefined, undefined, testExtensionsDir);
tester.setupAndRunTests(testExtensionsDir);