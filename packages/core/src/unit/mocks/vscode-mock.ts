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
    clear: sinon.stub(),
    dispose: sinon.stub(),
};

function resetMocks() {
    mockDiagnosticCollection.set.reset();
    mockDiagnosticCollection.delete.reset();
    mockDiagnosticCollection.clear.reset();
    mockDiagnosticCollection.dispose.reset();
}

class EventEmitter<T> {
    private listeners: Array<(e: T) => unknown> = [];

    readonly event = (listener: (e: T) => unknown) => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                this.listeners = this.listeners.filter((l) => l !== listener);
            },
        };
    };

    fire(data: T): void {
        this.listeners.forEach((listener) => listener(data));
    }

    dispose(): void {
        this.listeners = [];
    }
}

class CodeActionKind {
    static readonly QuickFix = new CodeActionKind("quickfix");
    static readonly Empty = new CodeActionKind("");

    value: string;

    constructor(value: string) {
        this.value = value;
    }

    contains(other: CodeActionKind): boolean {
        return other.value.startsWith(this.value);
    }

    append(part: string): CodeActionKind {
        const next = this.value ? `${this.value}.${part}` : part;
        return new CodeActionKind(next);
    }
}

const mock = {
    EventEmitter,

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
                            return false;
                        }
                        return undefined;
                    },
                };
            }
            return {
                get: (_key: string, defaultValue?: unknown) => defaultValue,
                update: () => Promise.resolve(),
            };
        },
        workspaceFolders: [{ uri: { fsPath: "/mock/path" } }],
        getWorkspaceFolder: (uri: any) => ({ uri: { fsPath: uri?.fsPath ?? "/mock/path" } }),
        openTextDocument: () => Promise.resolve({ uri: { fsPath: "/mock/path" } }),
        findFiles: () => Promise.resolve([]),
        textDocuments: [],
        fs: {
            readFile: () => Promise.resolve(new Uint8Array()),
            writeFile: () => Promise.resolve(),
            stat: () => Promise.resolve({ type: 1, size: 0, ctime: 0, mtime: 0 }),
            createDirectory: () => Promise.resolve(),
            readDirectory: () => Promise.resolve([]),
        },
        onDidChangeTextDocument: () => ({ dispose: () => { } }),
        onDidSaveTextDocument: () => ({ dispose: () => { } }),
        onDidChangeWorkspaceFolders: () => ({ dispose: () => { } }),
        onDidChangeConfiguration: () => ({ dispose: () => { } }),
        onDidOpenTextDocument: () => ({ dispose: () => { } }),
        onDidCloseTextDocument: () => ({ dispose: () => { } }),
        applyEdit: () => Promise.resolve(true),
        asRelativePath: (uri: any) => uri?.fsPath ?? "",
    },

    window: {
        showErrorMessage: () => Promise.resolve(undefined),
        showInformationMessage: () => Promise.resolve(undefined),
        showWarningMessage: () => Promise.resolve(undefined),
        showInputBox: () => Promise.resolve(undefined),
        showQuickPick: () => Promise.resolve(undefined),
        showOpenDialog: () => Promise.resolve(undefined),
        showSaveDialog: () => Promise.resolve(undefined),
        withProgress: (_options: unknown, task: (progress: { report: () => void }, token: { isCancellationRequested: boolean; onCancellationRequested: (cb: () => void) => { dispose: () => void } }) => unknown) => {
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: (_cb: () => void) => ({ dispose: () => { } }),
            };
            return Promise.resolve(task({ report: () => { } }, token));
        },
        createOutputChannel: () => ({
            append: () => { },
            appendLine: () => { },
            clear: () => { },
            show: () => { },
            hide: () => { },
            dispose: () => { },
            replace: () => { },
            name: "Test",
        }),
        createWebviewPanel: () => ({
            webview: {
                html: "",
                asWebviewUri: (uri: any) => uri,
                onDidReceiveMessage: () => ({ dispose: () => { } }),
                postMessage: () => Promise.resolve(true),
                cspSource: "vscode-webview:",
            },
            reveal: () => { },
            dispose: () => { },
            onDidDispose: () => ({ dispose: () => { } }),
            visible: true,
            title: "Test",
            viewType: "test",
        }),
        createTextEditorDecorationType: () => ({ dispose: () => { } }),
        createStatusBarItem: () => ({
            text: "",
            tooltip: undefined,
            command: undefined,
            show: () => { },
            hide: () => { },
            dispose: () => { },
        }),
        visibleTextEditors: [],
        activeTextEditor: undefined as any,
        tabGroups: { all: [] },
        onDidChangeActiveTextEditor: () => ({ dispose: () => { } }),
        onDidChangeTextEditorSelection: () => ({ dispose: () => { } }),
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
        },
    },

    languages: {
        createDiagnosticCollection: () => mockDiagnosticCollection,
        registerCodeActionsProvider: () => ({ dispose: () => { } }),
        registerCompletionItemProvider: () => ({ dispose: () => { } }),
        registerHoverProvider: () => ({ dispose: () => { } }),
        getDiagnostics: (_uri?: unknown) => [],
    },

    extensions: {
        getExtension: (_id: string) => undefined,
        all: [],
        onDidChange: () => ({ dispose: () => { } }),
    },

    env: {
        appName: "Visual Studio Code",
        openExternal: () => Promise.resolve(true),
        clipboard: {
            writeText: () => Promise.resolve(),
            readText: () => Promise.resolve(""),
        },
    },

    secrets: {
        get: sinon.stub().resolves("valid-api-key"),
        store: sinon.stub().resolves(undefined),
        delete: sinon.stub().resolves(undefined),
        onDidChange: () => ({ dispose: () => { } }),
    },

    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
    },

    Position: class Position {
        line: number;
        character: number;

        constructor(line: number, character: number) {
            this.line = line;
            this.character = character;
        }
        translate() { return this; }
        with() { return this; }
        isAfter() { return false; }
        isBefore() { return false; }
        isEqual() { return true; }
    },

    Range: class Range {
        start: { line: number; character: number };
        end: { line: number; character: number };

        constructor(
            start: { line: number; character: number },
            end: { line: number; character: number }
        ) {
            this.start = start;
            this.end = end;
        }
        with() { return this; }
        get isEmpty() {
            return this.start.line === this.end.line && this.start.character === this.end.character;
        }
        contains() { return true; }
    },

    Selection: class Selection {
        anchor: { line: number; character: number };
        active: { line: number; character: number };

        constructor(
            anchor: { line: number; character: number },
            active: { line: number; character: number }
        ) {
            this.anchor = anchor;
            this.active = active;
        }
        isEmpty = false;
    },

    Diagnostic: class Diagnostic {
        source: string | undefined;
        code?: string | number | { value: string; valueOf: () => { value: string } };
        relatedInformation?: any[];
        tags?: any[];
        range: { start: { line: number; character: number }; end: { line: number; character: number } };
        message: string;
        severity: number;

        constructor(
            range: { start: { line: number; character: number }; end: { line: number; character: number } },
            message: string,
            severity: number
        ) {
            this.range = range;
            this.message = message;
            this.severity = severity;
            this.source = undefined;
            this.code = undefined;
            this.relatedInformation = undefined;
        }
    },

    CodeAction: class CodeAction {
        command?: { command: string; title: string; tooltip?: string; arguments?: unknown[] };
        diagnostics?: any[];
        isPreferred?: boolean;
        title: string;
        kind?: CodeActionKind;

        constructor(title: string, kind?: CodeActionKind) {
            this.title = title;
            this.kind = kind;
        }
    },

    CodeActionKind,

    CodeActionTriggerKind: {
        Invoke: 1,
        Automatic: 2,
    },

    CancellationTokenSource: class CancellationTokenSource {
        token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => { } }) };
        cancel() { this.token.isCancellationRequested = true; }
        dispose() { }
    },

    ProgressLocation: {
        Notification: 15,
        Window: 10,
        SourceControl: 1,
    },

    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3,
        Active: -1,
        Beside: -2,
    },

    StatusBarAlignment: {
        Left: 1,
        Right: 2,
    },

    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2,
    },

    ColorThemeKind: {
        Light: 1,
        Dark: 2,
        HighContrast: 3,
        HighContrastLight: 4,
    },

    DecorationRangeBehavior: {
        ClosedClosed: 0,
        OpenOpen: 1,
        OpenClosed: 2,
        ClosedOpen: 3,
    },

    ThemeColor: class ThemeColor {
        id: string;
        constructor(id: string) {
            this.id = id;
        }
    },

    ThemeIcon: class ThemeIcon {
        id: string;
        constructor(id: string) {
            this.id = id;
        }
    },

    MarkdownString: class MarkdownString {
        value = "";
        isTrusted?: boolean;
        supportHtml?: boolean;
        constructor(value?: string) {
            this.value = value ?? "";
        }
        appendText(text: string) {
            this.value += text;
            return this;
        }
        appendMarkdown(text: string) {
            this.value += text;
            return this;
        }
        appendCodeblock(code: string, _language?: string) {
            this.value += code;
            return this;
        }
    },

    Hover: class Hover {
        contents: unknown;
        range?: unknown;

        constructor(contents: unknown, range?: unknown) {
            this.contents = contents;
            this.range = range;
        }
    },

    Uri: {
        file: (path: string) => ({
            fsPath: path,
            scheme: "file",
            path,
            toString: () => path,
        }),
        parse: (path: string) => ({
            fsPath: path,
            scheme: "file",
            path,
            toString: () => path,
        }),
        joinPath: (uri: any, ...pathSegments: string[]) => {
            const joined = [uri?.fsPath ?? "", ...pathSegments].filter(Boolean).join("/");
            return { fsPath: joined, scheme: "file", path: joined, toString: () => joined };
        },
    },

    TreeItem: class {
        label: string;
        collapsibleState: any;
        children?: any[];
        command?: any;
        tooltip?: any;
        iconPath?: any;
        contextValue?: string;

        constructor(label: string, collapsibleState?: any) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    },

    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
    },

    FileType: {
        Unknown: 0,
        File: 1,
        Directory: 2,
        SymbolicLink: 64,
    },
};

mockRequire("vscode", mock);

export { mock, mockDiagnosticCollection, resetMocks };
export const getCommandsExecuted = () => commandsExecuted;
export const clearCommandsExecuted = () => { commandsExecuted = []; };
export const getRegisteredCommandCallback = (command: string) => registeredCallbacks[command];
