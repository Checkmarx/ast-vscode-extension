import { ExTester } from 'vscode-extension-tester';

const testExtensionsDir: string = 'out/test/';
const tester: ExTester = new ExTester(undefined, undefined, testExtensionsDir);
tester.setupAndRunTests(testExtensionsDir);