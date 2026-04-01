/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
import mockRequire from "mock-require";
import { constants } from "../../utils/common/constants";
import * as sinon from "sinon";

let commandsExecuted: string[] = [];
const registeredCallbacks: Record<string, (...args: any[]) => any> = {};

const mockDiagnosticCollection = {
    set: sinon.stub(),
    delete: sinon.stub(),
    clear: sinon.stub()
};

function resetMocks() {
    mockDiagnosticCollection.set.reset();
    mockDiagnosticCollection.delete.reset();
    mockDiagnosticCollection.clear.reset();
}

const mock = {
    workspace: {
        getConfiguration: (section: string) => {
            if (section === "checkmarxOne") {
                return {
                    get: (key: string) => {
                        if (key === constants.apiKey) {
                            return "valid-api-key";
                        }
                        if (key === "additionalParams") {
                            return "valid-api-key";
                        }
                        return undefined;
                    },
                };
            }
            if (section === constants.cxKics) {
                return {
                    get: (key: string) => {
                        if (key === constants.cxKicsAutoScan) {
                            return false; // autoscan disabled by default in tests
                        }
                        return undefined;
                    }
                };
            }
            return undefined;
        },
        workspaceFolders: [{ uri: { fsPath: "/mock/path" } }],
        getWorkspaceFolder: (uri: any) => {
            return { uri: { fsPath: "/mock/path" } };
        },
        openTextDocument: () => Promise.resolve({
            // Mock document properties
        }),
        findFiles: () => Promise.resolve([])
    },

    window: {
        showErrorMessage: () => Promise.resolve(),
        showInformationMessage: () => Promise.resolve(),
        createOutputChannel: () => ({
            append: () => { },
            appendLine: () => { },
            clear: () => { },
            show: () => { },
            hide: () => { },
            dispose: () => { },
            replace: () => { },
            name: "Test"
        }),
        createWebviewPanel: () => ({
            webview: {
                html: "",
                asWebviewUri: (uri: any) => uri,
                onDidReceiveMessage: () => ({ dispose: () => { } }),
                postMessage: () => Promise.resolve()
            },
            reveal: () => { },
            dispose: () => { },
            onDidDispose: () => ({ dispose: () => { } })
        }),
        createTextEditorDecorationType: () => ({
            dispose: () => { }
        }),
        visibleTextEditors: []
    },

    commands: {
        executeCommand: (command: string, ..._args: any[]) => {
            commandsExecuted.push(command);
            return Promise.resolve();
        },
        getCommands: () => Promise.resolve([]),
        registerCommand: (command: string, callback: (...args: any[]) => any) => {
            registeredCallbacks[command] = callback;
            return { dispose: () => { delete registeredCallbacks[command]; } };
        }
    },

    languages: {
        createDiagnosticCollection: () => mockDiagnosticCollection
    },

    secrets: {
        get: sinon.stub().resolves("valid-api-key"),
        store: sinon.stub().resolves(undefined),
        delete: sinon.stub().resolves(undefined),
    },

    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },

    Position: class Position {
        constructor(public line: number, public character: number) { }
        translate() { return this; }
        with() { return this; }
    },

    Range: class Range {
        constructor(
            public start: { line: number; character: number },
            public end: { line: number; character: number }
        ) { }
        with() { return this; }
    },

    Diagnostic: class Diagnostic {
        source: string | undefined;
        code?: string | number;
        relatedInformation?: any[];
        tags?: any[];

        constructor(
            public range: { start: { line: number; character: number }; end: { line: number; character: number } },
            public message: string,
            public severity: number
        ) { }
    },

    ProgressLocation: {
        Notification: "Notification",
    },

    Uri: {
        file: (path: string) => ({
            fsPath: path,
            scheme: 'file',
            path: path
        }),
        parse: (path: string) => ({
            fsPath: path,
            scheme: 'file',
            path: path
        }),
        joinPath: (uri: any, ...pathSegments: string[]) => ({
            fsPath: pathSegments.join('/'),
            scheme: 'file',
            path: pathSegments.join('/')
        })
    },

    TreeItem: class {
        label: string;
        collapsibleState: any;

        constructor(label: string, collapsibleState: any) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    },

    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2
    },

    DecorationRangeBehavior: {
        ClosedClosed: 0,
        OpenOpen: 1,
        OpenClosed: 2,
        ClosedOpen: 3
    }
};

mockRequire("vscode", mock);

export { mock, mockDiagnosticCollection, resetMocks };
export const getCommandsExecuted = () => commandsExecuted;
export const clearCommandsExecuted = () => { commandsExecuted = []; };
export const getRegisteredCommandCallback = (command: string) => registeredCallbacks[command];