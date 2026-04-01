"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitByClassName = exports.waitByLinkText = exports.waitStatusBar = void 0;
const vscode_extension_tester_1 = require("vscode-extension-tester");
async function waitStatusBar() {
    const statusbar = new vscode_extension_tester_1.StatusBar();
    let chekmarx = await statusbar.getItem('Checkmarx kics real-time scan');
    while (chekmarx !== undefined) {
        chekmarx = await statusbar.getItem('Checkmarx kics real-time scan');
    }
}
exports.waitStatusBar = waitStatusBar;
async function waitByLinkText(driver, text, timeout) {
    driver.wait(vscode_extension_tester_1.until.elementLocated(vscode_extension_tester_1.By.linkText(text)), timeout);
}
exports.waitByLinkText = waitByLinkText;
async function waitByClassName(driver, text, timeout) {
    driver.wait(vscode_extension_tester_1.until.elementLocated(vscode_extension_tester_1.By.className(text)), timeout);
}
exports.waitByClassName = waitByClassName;
//# sourceMappingURL = waiters.js.map