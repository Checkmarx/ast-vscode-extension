/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
import mockRequire from "mock-require";
import { constants } from "../../utils/common/constants";
import * as sinon from "sinon";

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
            return Promise.resolve();
        },
        getCommands: () => Promise.resolve([]),
        registerCommand: (command: string, callback: (...args: any[]) => any) => {
            return { dispose: () => {} };
        }
    },

    languages: {
        createDiagnosticCollection: () => mockDiagnosticCollection
    },

    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },

    Position: class Position {
        constructor(public line: number, public character: number) {}
        translate() { return this; }
        with() { return this; }
    },

    Range: class Range {
        constructor(
            public start: { line: number; character: number },
            public end: { line: number; character: number }
        ) {}
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
        ) {}
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
        })
    }
};

mockRequire("vscode", mock);

export { mockDiagnosticCollection, resetMocks };
export const getCommandsExecuted = () => commandsExecuted;
export const clearCommandsExecuted = () => { commandsExecuted = []; };
