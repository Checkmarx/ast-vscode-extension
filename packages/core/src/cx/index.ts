import * as prod from "./cx";
import * as testEnv from "./cxMock";
import * as vscode from "vscode";

let context: vscode.ExtensionContext;
let cx: prod.Cx | testEnv.CxMock;

export function initialize(extensionContext: vscode.ExtensionContext, testMode?: string) {
    context = extensionContext;

    // Use explicitly passed testMode parameter if provided, otherwise fall back to process.env.TEST
    // This ensures test mode works correctly in monorepo structure where environment variables
    // may not be visible across package boundaries
    const mode = testMode !== undefined ? testMode : process.env.TEST;

    //prettier-ignore
    cx = mode && mode === "true"
        ? new testEnv.CxMock(context)
        : mode === "uiEndToEnd"
            ? new prod.Cx(context)
            : new prod.Cx(context);
}

export function getCx(): prod.Cx | testEnv.CxMock {
    if (!cx) {
        throw new Error('Cx not initialized. Call initialize() first');
    }
    return cx;
}

export { cx };