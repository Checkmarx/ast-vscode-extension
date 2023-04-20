"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_extension_tester_1 = require("vscode-extension-tester");
const testExtensionsDir = 'out/test/';
const vscodeVersion = vscode_extension_tester_1.ReleaseQuality.Insider;
const tester = new vscode_extension_tester_1.ExTester(undefined, vscodeVersion, testExtensionsDir);
tester.setupAndRunTests(testExtensionsDir);
//# sourceMappingURL=index.js.map