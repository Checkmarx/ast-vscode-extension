import * as prod from "./cx";
import * as testEnv from "./cxMock";
import * as vscode from "vscode";

let context: vscode.ExtensionContext;
let cx: prod.Cx | testEnv.CxMock;

export function initialize(extensionContext: vscode.ExtensionContext) {
    context = extensionContext;
    //prettier-ignore
    cx = process.env.TEST && process.env.TEST === "true"
        ? new testEnv.CxMock(context)
        : process.env.TEST === "uiEndToEnd"
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