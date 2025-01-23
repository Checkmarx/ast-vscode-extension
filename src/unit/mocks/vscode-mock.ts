import mockRequire from "mock-require";
import { constants } from "../../utils/common/constants";
import sinon from "sinon";

let commandsExecuted: string[] = [];

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

const mockVscode = {
    workspace: {
        getConfiguration: (section: string) => {
            if (section === "checkmarxOne") {
                return {
                    get: (key: string) => {
                        if (key === constants.apiKey) {
                            return constants.apiKey;
                        }
                        return undefined;
                    },
                };
            }
            return undefined;
        },
        workspaceFolders: [{ uri: { fsPath: "/mock/path" } }]
    },

    languages: {
        createDiagnosticCollection: () => mockDiagnosticCollection
    },

    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2
    },

    Position: class Position {
        constructor(public line: number, public character: number) {}
    },

    Range: class Range {
        constructor(
            public start: { line: number; character: number },
            public end: { line: number; character: number }
        ) {}
    },

    Diagnostic: class Diagnostic {
        source: string | undefined;
        constructor(
            public range: { start: { line: number; character: number }; end: { line: number; character: number } },
            public message: string,
            public severity: number
        ) {}
    }
};


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
            return undefined;
        },
        workspaceFolders: [{ uri: { fsPath: "/mock/path" } }]
    },

    window: {
        showErrorMessage: () => Promise.resolve(),
        showInformationMessage: () => Promise.resolve(),
        createOutputChannel: () => ({
            append: () => {},
            appendLine: () => {},
            clear: () => {},
            show: () => {},
            hide: () => {},
            dispose: () => {},
            replace: () => {},
            name: "Test"
        })
    },

    commands: {
        executeCommand: (command: string) => {
            commandsExecuted.push(command);
        },
        getCommands: () => Promise.resolve([]),
        registerCommand: (command: string, callback: (...args: any[]) => any) => {
            return { dispose: () => {} };
        }
    },

    ProgressLocation: {
        Notification: "Notification",
    },

    Uri: {
        file: (path: string) => ({ fsPath: path })
    }
};


mockRequire("vscode", mock);
mockRequire("vscode", mockVscode);

export { mockDiagnosticCollection, mockVscode, resetMocks };
export const getCommandsExecuted = () => commandsExecuted;
export const clearCommandsExecuted = () => { commandsExecuted = []; };
